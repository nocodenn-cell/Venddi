BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES
 ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active'),
 ('22222222-2222-2222-2222-222222222222','B','22.222.222/2222-22','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
 ('11111111-1111-1111-1111-111111111111','starter','active',15),
 ('22222222-2222-2222-2222-222222222222','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','owner@a.com','Owner A','owner',true),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','d0000000-0000-4000-8000-00000000000d','gerente@a.com','Gerente A','manager',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','caixa@a.com','Caixa A','cashier',true),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','b0000000-0000-4000-8000-00000000000b','owner@b.com','Owner B','owner',true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock) VALUES
 ('d1000000-0000-4000-8000-000000000011','11111111-1111-1111-1111-111111111111','P1','Produto 1',5,20,8,1);
-- Caixa aberto do operador, com fundo de 100
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
 ('c2000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc','open',100);
-- Venda 1: dinheiro 40 (2 x Produto 1), com estoque já baixado para 8
INSERT INTO sales (id, company_id, sale_number, operator_id, cash_register_id, subtotal, discount, total, status, sale_date)
VALUES ('5a000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111',1,'cccccccc-cccc-cccc-cccc-cccccccccccc','c2000000-0000-4000-8000-000000000001',40,0,40,'completed',now());
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total, cost_price)
VALUES ('5a000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000011',2,20,0,40,5);
INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000001','cash',40,1);
INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, description, balance_after)
VALUES ('c2000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc','sale',40,'Venda 1',140);
-- Suprimento 20 e sangria 10
INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, description, balance_after)
VALUES ('c2000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc','deposit',20,'Suprimento',160);
INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, description, balance_after)
VALUES ('c2000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','cccccccc-cccc-cccc-cccc-cccccccccccc','withdrawal',10,'Sangria',150);
-- Venda 2: cartão 60 (sem dinheiro no caixa)
INSERT INTO sales (id, company_id, sale_number, operator_id, cash_register_id, subtotal, discount, total, status, sale_date)
VALUES ('5a000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111',2,'cccccccc-cccc-cccc-cccc-cccccccccccc','c2000000-0000-4000-8000-000000000001',60,0,60,'completed',now());
INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000002','credit_card',60,1);

DO $$ DECLARE r jsonb; n numeric; s text; BEGIN
  -- 1) Fechamento: saldo esperado = 100 + 40 + 20 - 10 = 150
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  r := relatorio_fechamento_caixa('c2000000-0000-4000-8000-000000000001');
  IF (r->>'expected_cash')::numeric <> 150 THEN RAISE EXCEPTION 'FALHOU: saldo esperado % (esperado 150)', r->>'expected_cash'; END IF;
  IF (r->'payments_by_method'->>'credit_card')::numeric <> 60 THEN RAISE EXCEPTION 'FALHOU: formas de pagamento'; END IF;
  IF (r->>'cash_consistent')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU: dinheiro dos pagamentos não bate com os movimentos'; END IF;
  RESET ROLE;

  -- 2) Operador vê o próprio caixa; outro caixa não
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  r := relatorio_fechamento_caixa('c2000000-0000-4000-8000-000000000001');
  IF r->>'cash_register_id' IS NULL THEN RAISE EXCEPTION 'FALHOU: operador não viu o próprio caixa'; END IF;
  RESET ROLE;

  -- 3) Caixa não cancela venda
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    PERFORM cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000001', 'Cliente desistiu');
    RAISE EXCEPTION 'FALHOU: caixa cancelou venda';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  -- 4) Motivo curto é recusado
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  BEGIN
    PERFORM cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000001', 'ok');
    RAISE EXCEPTION 'FALHOU: motivo curto aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;

  -- 5) Gerente cancela venda 1 (dinheiro): estoque volta, estorno de 40 no caixa
  r := cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000001', 'Cliente desistiu da compra');
  IF (r->>'cash_refund')::numeric <> 40 THEN RAISE EXCEPTION 'FALHOU: estorno % (esperado 40)', r->>'cash_refund'; END IF;
  RESET ROLE;
  SELECT stock_quantity INTO n FROM products WHERE id = 'd1000000-0000-4000-8000-000000000011';
  IF n <> 10 THEN RAISE EXCEPTION 'FALHOU: estoque não voltou (%)', n; END IF;
  SELECT count(*) INTO n FROM audit_logs WHERE action = 'sale.cancel' AND entity_id = '5a000000-0000-4000-8000-000000000001';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: auditoria do cancelamento ausente (%)', n; END IF;
  SELECT cancelled_by::text INTO s FROM sales WHERE id = '5a000000-0000-4000-8000-000000000001';
  IF s <> 'dddddddd-dddd-dddd-dddd-dddddddddddd' THEN RAISE EXCEPTION 'FALHOU: cancelled_by errado (%)', s; END IF;

  -- 6) Saldo esperado cai para 110 depois do estorno
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  r := relatorio_fechamento_caixa('c2000000-0000-4000-8000-000000000001');
  IF (r->>'expected_cash')::numeric <> 110 THEN RAISE EXCEPTION 'FALHOU: saldo após estorno % (esperado 110)', r->>'expected_cash'; END IF;
  RESET ROLE;

  -- 7) Cancelar de novo é recusado
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  BEGIN
    PERFORM cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000001', 'Tentativa repetida');
    RAISE EXCEPTION 'FALHOU: venda cancelada duas vezes';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  RESET ROLE;

  -- 8) Outra empresa não enxerga nem cancela a venda 2
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-00000000000b',true);
  BEGIN
    PERFORM cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000002', 'Outra empresa tenta');
    RAISE EXCEPTION 'FALHOU: empresa B cancelou venda da A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM relatorio_fechamento_caixa('c2000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FALHOU: empresa B viu fechamento da A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  RESET ROLE;

  -- 9) Venda no cartão cancela mesmo com o caixa fechado
  UPDATE cash_registers SET status = 'closed', final_amount = 105, closed_at = now() WHERE id = 'c2000000-0000-4000-8000-000000000001';
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  r := cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000002', 'Cliente trocou a forma de pagamento');
  IF (r->>'cash_refund')::numeric <> 0 THEN RAISE EXCEPTION 'FALHOU: estorno indevido no cartão'; END IF;
  RESET ROLE;

  -- 10) Venda em dinheiro com caixa já fechado não cancela (estorno só com caixa aberto)
  INSERT INTO sales (id, company_id, sale_number, operator_id, cash_register_id, subtotal, discount, total, status, sale_date)
  VALUES ('5a000000-0000-4000-8000-000000000003','11111111-1111-1111-1111-111111111111',3,'cccccccc-cccc-cccc-cccc-cccccccccccc','c2000000-0000-4000-8000-000000000001',10,0,10,'completed',now());
  INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000003','cash',10,1);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  BEGIN
    PERFORM cancel_sale_with_reversal('5a000000-0000-4000-8000-000000000003', 'Caixa fechado, tentativa');
    RAISE EXCEPTION 'FALHOU: estorno em dinheiro com caixa fechado aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  RESET ROLE;

  -- 11) Diferença no fechamento: informado 105 contra esperado 110 => -5
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  r := relatorio_fechamento_caixa('c2000000-0000-4000-8000-000000000001');
  IF (r->>'difference')::numeric <> -5 THEN RAISE EXCEPTION 'FALHOU: diferença % (esperado -5)', r->>'difference'; END IF;
  -- Relatório por período traz o caixa
  s := relatorio_caixas_periodo('2000-01-01'::timestamptz, '2100-01-01'::timestamptz)::text;
  IF s NOT LIKE '%c2000000-0000-4000-8000-000000000001%' THEN RAISE EXCEPTION 'FALHOU: caixa fora do relatório do período'; END IF;
  RESET ROLE;
END $$;
SELECT 'CASH CLOSING CANCEL OK' AS r;
ROLLBACK;
