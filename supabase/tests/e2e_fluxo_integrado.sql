-- Venddi - Roteiro E2E integrado (banco), jornada completa da loja:
--   entrada de estoque -> vendas (dinheiro e cartão, desconto válido e inválido)
--   -> suprimento e sangria -> estorno -> inventário com venda e entrada durante a contagem
--   -> conclusão -> painel -> permissões e isolamento.
-- Todos os valores esperados foram calculados à mão ANTES da execução (comentários).
-- Executar com migrations 001..026 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/e2e_fluxo_integrado.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('81111111-1111-1111-1111-111111111111', 'Loja E2E', '81.111.111/0001-81', 'starter', 'active'),
  ('82222222-2222-2222-2222-222222222222', 'Outra E2E', '82.222.222/0001-82', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('81111111-1111-1111-1111-111111111111', 'starter', 'active', 15),
  ('82222222-2222-2222-2222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('81000000-0000-4000-8000-000000000001', '81111111-1111-1111-1111-111111111111', '81000000-0000-4000-8000-0000000000a1', 'owner@e2e.test', 'Owner', 'owner', true),
  ('81000000-0000-4000-8000-000000000002', '81111111-1111-1111-1111-111111111111', '81000000-0000-4000-8000-0000000000a2', 'caixa@e2e.test', 'Caixa', 'cashier', true),
  ('81000000-0000-4000-8000-000000000003', '81111111-1111-1111-1111-111111111111', '81000000-0000-4000-8000-0000000000a3', 'gerente@e2e.test', 'Gerente', 'manager', true),
  ('82000000-0000-4000-8000-000000000001', '82222222-2222-2222-2222-222222222222', '82000000-0000-4000-8000-0000000000b1', 'owner@outra.test', 'Owner Outra', 'owner', true);

-- Produtos: A (preço 20, saldo 10, mín 2), B (preço 30, saldo 5, mín 2), C (preço 10, saldo 1, mín 2)
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('81100000-0000-4000-8000-000000000001', '81111111-1111-1111-1111-111111111111', 'E-A', 'Produto A', 5, 20, 10, 2, true),
  ('81100000-0000-4000-8000-000000000002', '81111111-1111-1111-1111-111111111111', 'E-B', 'Produto B', 10, 30, 5, 2, true),
  ('81100000-0000-4000-8000-000000000003', '81111111-1111-1111-1111-111111111111', 'E-C', 'Produto C', 3, 10, 1, 2, true);

-- Caixa aberto pelo operador, valor inicial 100
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
  ('81200000-0000-4000-8000-000000000001', '81111111-1111-1111-1111-111111111111', '81000000-0000-4000-8000-000000000002', 'open', 100);

CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- RPCs de venda devolvem {"success": ...}; RPCs de inventário e entrada lançam exceção
CREATE OR REPLACE FUNCTION pg_temp.expect_json_fail(p_auth UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  EXECUTE p_sql INTO v;
  RESET ROLE;
  IF (v->>'success')::boolean OR v->>'error' NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU (esperado "%"): %', p_msg, v;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_exc(p_auth UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  EXECUTE p_sql;
  RESET ROLE;
  RAISE EXCEPTION 'FALHOU: deveria recusar (%)', p_msg;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU (esperado "%"): %', p_msg, SQLERRM;
  END IF;
END;
$$;

DO $$
DECLARE
  OWNER CONSTANT UUID := '81000000-0000-4000-8000-0000000000a1';
  CAIXA CONSTANT UUID := '81000000-0000-4000-8000-0000000000a2';
  GERENTE CONSTANT UUID := '81000000-0000-4000-8000-0000000000a3';
  OWNER_OUTRA CONSTANT UUID := '82000000-0000-4000-8000-0000000000b1';
  U_OWNER CONSTANT UUID := '81000000-0000-4000-8000-000000000001';
  U_CAIXA CONSTANT UUID := '81000000-0000-4000-8000-000000000002';
  U_GERENTE CONSTANT UUID := '81000000-0000-4000-8000-000000000003';
  CO CONSTANT UUID := '81111111-1111-1111-1111-111111111111';
  CR CONSTANT UUID := '81200000-0000-4000-8000-000000000001';
  A CONSTANT UUID := '81100000-0000-4000-8000-000000000001';
  B CONSTANT UUID := '81100000-0000-4000-8000-000000000002';
  C CONSTANT UUID := '81100000-0000-4000-8000-000000000003';
  r JSONB;
  v_v1 UUID; v_v2 UUID; v_v5 UUID; v_inv UUID;
  v_stock INTEGER; v_saldo NUMERIC; v_n INTEGER; v_total NUMERIC;
BEGIN
  -- 1. Entrada de estoque pelo gerente: A 10 -> 15
  PERFORM pg_temp.as_auth(GERENTE);
  r := registrar_entrada_estoque(A, 5, 'Compra NF E2E');
  RESET ROLE;
  IF (r->>'new_balance')::int <> 15 THEN RAISE EXCEPTION 'FALHOU 1: entrada %', r; END IF;

  -- 2. Venda V1 (caixa): 2x A (20) + 1x B (30) = 70; pagamento 50 dinheiro + 20 cartão
  --    Esperado: total 70; A 15->13; B 5->4; movimento de caixa só do dinheiro (50)
  PERFORM pg_temp.as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":2,"unitPrice":20,"discount":0},
      {"productId":"81100000-0000-4000-8000-000000000002","quantity":1,"unitPrice":30,"discount":0}]'::jsonb,
    '[{"method":"cash","amount":50},{"method":"credit_card","amount":20}]'::jsonb);
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 2: venda V1 recusada %', r; END IF;
  v_v1 := (r->>'sale_id')::UUID;
  SELECT total INTO v_total FROM sales WHERE id = v_v1;
  IF v_total <> 70 THEN RAISE EXCEPTION 'FALHOU 2: total V1 % (esperado 70)', v_total; END IF;
  IF (SELECT stock_quantity FROM products WHERE id = A) <> 13 OR (SELECT stock_quantity FROM products WHERE id = B) <> 4 THEN
    RAISE EXCEPTION 'FALHOU 2: saldos após V1';
  END IF;
  IF (SELECT amount FROM cash_movements WHERE reference_id = v_v1 AND type = 'sale') <> 50 THEN
    RAISE EXCEPTION 'FALHOU 2: movimento de caixa da V1 deveria ser 50 (dinheiro)';
  END IF;

  -- 3. Venda V2 (caixa): 1x A (20), desconto 1 (= 5%), pago em dinheiro 19. Esperado: total 19; A 13->12
  PERFORM pg_temp.as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":20,"discount":0}]'::jsonb,
    '[{"method":"cash","amount":19}]'::jsonb, NULL, 1);
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 3: desconto válido recusado %', r; END IF;
  v_v2 := (r->>'sale_id')::UUID;
  IF (SELECT total FROM sales WHERE id = v_v2) <> 19 THEN RAISE EXCEPTION 'FALHOU 3: total V2'; END IF;

  -- 4. Desconto acima de 5% é recusado e não baixa estoque (A continua 12)
  PERFORM pg_temp.expect_json_fail(CAIXA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,%s)', CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":20,"discount":0}]',
    '[{"method":"cash","amount":15}]', 5),
    'Desconto acima de 5%');
  IF (SELECT stock_quantity FROM products WHERE id = A) <> 12 THEN RAISE EXCEPTION 'FALHOU 4: estoque mudou na recusa'; END IF;

  -- 5. Desconto com cartão é recusado (só em dinheiro)
  PERFORM pg_temp.expect_json_fail(CAIXA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,%s)', CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":20,"discount":0}]',
    '[{"method":"credit_card","amount":19}]', 1),
    'só pode ser paga em dinheiro');

  -- 6. Suprimento (+30) e sangria (-20) do caixa, como a tela grava (balance_after = 0)
  INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after, description)
  VALUES (CR, CO, U_CAIXA, 'deposit', 30, 0, 'Suprimento E2E'),
         (CR, CO, U_CAIXA, 'withdrawal', 20, 0, 'Sangria E2E');

  -- 7. Estorno de V1 pelo gerente: estoque volta (A 12->14, B 4->5); devolve 50 do caixa
  PERFORM pg_temp.as_auth(GERENTE);
  r := cancel_sale_with_reversal(v_v1, CO, U_GERENTE, 'Cliente desistiu');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 7: estorno recusado %', r; END IF;
  IF (SELECT stock_quantity FROM products WHERE id = A) <> 14 OR (SELECT stock_quantity FROM products WHERE id = B) <> 5 THEN
    RAISE EXCEPTION 'FALHOU 7: saldos após estorno';
  END IF;
  IF (SELECT status FROM sales WHERE id = v_v1) <> 'cancelled' THEN RAISE EXCEPTION 'FALHOU 7: status'; END IF;

  -- 8. Inventário (gerente): contagens A=13 (sistema 14 -> falta 1), B=5 (0), C=1 (0)
  PERFORM pg_temp.as_auth(GERENTE);
  v_inv := (iniciar_inventario('Inventário E2E')->>'count_id')::UUID;
  PERFORM registrar_contagem_item(v_inv, A, 13);
  PERFORM registrar_contagem_item(v_inv, B, 5);
  PERFORM registrar_contagem_item(v_inv, C, 1);
  RESET ROLE;

  -- 9. Durante a contagem: venda V5 do caixa (2x A = 40 dinheiro) e entrada de 3 em B
  PERFORM pg_temp.as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":2,"unitPrice":20,"discount":0}]'::jsonb,
    '[{"method":"cash","amount":40}]'::jsonb);
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 9: venda durante inventário %', r; END IF;
  v_v5 := (r->>'sale_id')::UUID;
  PERFORM pg_temp.as_auth(GERENTE);
  PERFORM registrar_entrada_estoque(B, 3, 'Reposição durante inventário');
  RESET ROLE;
  -- A: 14 -> 12 (V5). B: 5 -> 8 (entrada). Saldos antes do ajuste: A 12, B 8, C 1.

  -- 10. Conclusão: A ajusta -1 (13 - 14) sobre o saldo atual 12 -> 11. B: diferença 0 -> 8. C: 0 -> 1.
  PERFORM pg_temp.as_auth(GERENTE);
  r := concluir_inventario(v_inv);
  RESET ROLE;
  IF (r->>'adjusted_items')::int <> 1 OR (r->>'already_completed')::boolean THEN RAISE EXCEPTION 'FALHOU 10: conclusão %', r; END IF;
  IF (SELECT stock_quantity FROM products WHERE id = A) <> 11 THEN RAISE EXCEPTION 'FALHOU 10: A deveria ser 11 (venda -2 e falta -1 sobre 14)'; END IF;
  IF (SELECT stock_quantity FROM products WHERE id = B) <> 8 THEN RAISE EXCEPTION 'FALHOU 10: B deveria ser 8'; END IF;
  IF (SELECT stock_quantity FROM products WHERE id = C) <> 1 THEN RAISE EXCEPTION 'FALHOU 10: C deveria ser 1'; END IF;
  SELECT count(*) INTO v_n FROM stock_movements WHERE reference_id = v_inv AND type = 'adjustment';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 10: ajustes do inventário = % (esperado 1)', v_n; END IF;

  -- 11. Conclusão repetida é idempotente
  PERFORM pg_temp.as_auth(GERENTE);
  r := concluir_inventario(v_inv);
  RESET ROLE;
  IF NOT (r->>'already_completed')::boolean THEN RAISE EXCEPTION 'FALHOU 11: idempotência %', r; END IF;
  SELECT count(*) INTO v_n FROM stock_movements WHERE reference_id = v_inv;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 11: movimentos duplicados (%)', v_n; END IF;

  -- 12. Painel (dono). Vendas de hoje concluídas: V2 (19) e V5 (40) = 59, 2 pedidos.
  --     Estoque baixo: C (1 <= mín 2) = 1. Saldo do caixa: 100 + V2 19 + V5 40 + suprimento 30 - sangria 20
  --     (V1 entrou com 50 e saiu com 50 no estorno) = 169.
  PERFORM pg_temp.as_auth(OWNER);
  r := metricas_dashboard(date_trunc('day', now()) - interval '1 day', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
  RESET ROLE;
  IF (r->'vendas_hoje'->>'total')::numeric <> 59 OR (r->'vendas_hoje'->>'count')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU 12: vendas de hoje %', r->'vendas_hoje';
  END IF;
  IF (r->>'estoque_baixo')::int <> 1 THEN RAISE EXCEPTION 'FALHOU 12: estoque baixo %', r->>'estoque_baixo'; END IF;
  IF (r->>'saldo_caixa')::numeric <> 169 THEN RAISE EXCEPTION 'FALHOU 12: saldo do caixa % (esperado 169)', r->>'saldo_caixa'; END IF;
  -- Saldo calculado = saldo gravado pelo fluxo (último balance_after só é confiável nas vendas)
  SELECT initial_amount INTO v_saldo FROM cash_registers WHERE id = CR;
  IF v_saldo <> 100 THEN RAISE EXCEPTION 'FALHOU 12: valor inicial alterado'; END IF;

  -- 13. Permissões: caixa não inicia inventário, não registra entrada, não cancela venda
  PERFORM pg_temp.expect_exc(CAIXA, format('SELECT iniciar_inventario(%L)', 'x'), 'Papel sem permissão para realizar inventário');
  PERFORM pg_temp.expect_exc(CAIXA, format('SELECT registrar_entrada_estoque(%L, 1, %L)', A, 'x'), 'Papel sem permissão para registrar entrada de estoque');
  PERFORM pg_temp.expect_json_fail(CAIXA, format('SELECT cancel_sale_with_reversal(%L,%L,%L,%L)', v_v2, CO, U_CAIXA, 'caixa'),
    'Papel sem permissão para cancelar venda');

  -- 14. Isolamento: owner da outra empresa não vende, não cancela, não vê o painel nem o estoque da loja
  PERFORM pg_temp.expect_json_fail(OWNER_OUTRA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb)', CO, U_CAIXA, CR,
    '[{"productId":"81100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":20,"discount":0}]',
    '[{"method":"cash","amount":20}]'),
    'Acesso negado');
  PERFORM pg_temp.expect_json_fail(OWNER_OUTRA, format('SELECT cancel_sale_with_reversal(%L,%L,%L,%L)', v_v2, CO, U_OWNER, 'outra'),
    'Acesso negado');
  PERFORM pg_temp.as_auth(OWNER_OUTRA);
  r := metricas_dashboard(date_trunc('day', now()) - interval '1 day', date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
  IF (r->'vendas_hoje'->>'count')::int <> 0 OR (r->>'saldo_caixa')::numeric <> 0 OR (r->>'estoque_baixo')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU 14: painel da outra empresa vazou %', r;
  END IF;
  IF (SELECT count(*) FROM products WHERE company_id = CO) <> 0 THEN RAISE EXCEPTION 'FALHOU 14: produtos vazaram'; END IF;
  RESET ROLE;
END $$;

SELECT 'E2E INTEGRADO OK' AS r;
ROLLBACK;
