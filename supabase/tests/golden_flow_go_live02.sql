-- Venddi - Golden Flow (Go-live 02), banco real com as RPCs que o app chama.
-- Diferente de e2e_fluxo_integrado.sql, aqui NADA é gravado direto nas tabelas do caixa/vendas:
-- abertura, vendas, sangria, suprimento, estorno e fechamento passam pelas RPCs.
-- Valores esperados calculados ANTES da execução (ver comentários de cada passo).
-- Executar com migrations 001..031 aplicadas (ver supabase/tests/run_local_db_tests.sh).
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('83111111-1111-1111-1111-111111111111', 'Mercadinho Golden', '83.111.111/0001-83', 'starter', 'active'),
  ('83222222-2222-2222-2222-222222222222', 'Outra Golden', '83.222.222/0001-83', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('83111111-1111-1111-1111-111111111111', 'starter', 'active', 15),
  ('83222222-2222-2222-2222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('83000000-0000-4000-8000-000000000001', '83111111-1111-1111-1111-111111111111', '83000000-0000-4000-8000-0000000000a1', 'owner@golden.test', 'Dono', 'owner', true),
  ('83000000-0000-4000-8000-000000000002', '83111111-1111-1111-1111-111111111111', '83000000-0000-4000-8000-0000000000a2', 'caixa@golden.test', 'Caixa', 'cashier', true),
  ('83000000-0000-4000-8000-000000000003', '83111111-1111-1111-1111-111111111111', '83000000-0000-4000-8000-0000000000a3', 'gerente@golden.test', 'Gerente', 'manager', true),
  ('83000000-0000-4000-8000-000000000004', '83222222-2222-2222-2222-222222222222', '83000000-0000-4000-8000-0000000000b1', 'dono@outra.test', 'Dono Outra', 'owner', true);

-- P1: preço 10, estoque 20. P2: preço 50, estoque 4.
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('83100000-0000-4000-8000-000000000001', '83111111-1111-1111-1111-111111111111', 'G-P1', 'Produto P1', 4, 10, 20, 2, true),
  ('83100000-0000-4000-8000-000000000002', '83111111-1111-1111-1111-111111111111', 'G-P2', 'Produto P2', 30, 50, 4, 1, true);

CREATE OR REPLACE FUNCTION pg_temp.g_as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- Espera que o SQL devolva {"success": false} com a mensagem, ou lance exceção com a mensagem.
CREATE OR REPLACE FUNCTION pg_temp.g_expect_refused(p_auth UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v JSONB;
BEGIN
  PERFORM pg_temp.g_as_auth(p_auth);
  BEGIN
    EXECUTE p_sql INTO v;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    IF SQLERRM NOT LIKE '%' || p_msg || '%' THEN
      RAISE EXCEPTION 'FALHOU (esperado "%"): %', p_msg, SQLERRM;
    END IF;
    RETURN;
  END;
  RESET ROLE;
  IF v IS NULL OR (v->>'success')::boolean OR COALESCE(v->>'error', '') NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU: deveria recusar (%) mas retornou %', p_msg, v;
  END IF;
END;
$$;

DO $$
DECLARE
  DONO CONSTANT UUID := '83000000-0000-4000-8000-0000000000a1';
  CAIXA CONSTANT UUID := '83000000-0000-4000-8000-0000000000a2';
  GERENTE CONSTANT UUID := '83000000-0000-4000-8000-0000000000a3';
  DONO_OUTRA CONSTANT UUID := '83000000-0000-4000-8000-0000000000b1';
  U_DONO CONSTANT UUID := '83000000-0000-4000-8000-000000000001';
  U_CAIXA CONSTANT UUID := '83000000-0000-4000-8000-000000000002';
  U_GERENTE CONSTANT UUID := '83000000-0000-4000-8000-000000000003';
  CO CONSTANT UUID := '83111111-1111-1111-1111-111111111111';
  P1 CONSTANT UUID := '83100000-0000-4000-8000-000000000001';
  P2 CONSTANT UUID := '83100000-0000-4000-8000-000000000002';
  r JSONB;
  v_cr UUID;
  v_s1 UUID; v_s2 UUID; v_s2_again UUID; v_s3 UUID; v_s4 UUID; v_s5 UUID;
  v_stock1 INTEGER; v_stock2 INTEGER; v_n INTEGER; v_status TEXT;
  v_bal NUMERIC; v_total NUMERIC; v_pay NUMERIC;
  items_p1_2 TEXT := '[{"productId":"83100000-0000-4000-8000-000000000001","quantity":2,"unitPrice":10,"discount":0}]';
  items_p2_1 TEXT := '[{"productId":"83100000-0000-4000-8000-000000000002","quantity":1,"unitPrice":50,"discount":0}]';
  items_p1_1 TEXT := '[{"productId":"83100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":10,"discount":0}]';
BEGIN
  -- 1. Abertura de caixa pela RPC (valor inicial 100). O operador abre o próprio caixa (o caixa
  --    pertence a quem abriu; só ele ou a gerência movimenta).
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := abrir_caixa(CO, 100, 'golden-abertura-1', 'turno manhã');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 1: abertura %', r; END IF;
  v_cr := (r->>'cash_register_id')::uuid;
  -- Reenvio da mesma abertura (mesma chave) não pode abrir outro caixa
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := abrir_caixa(CO, 100, 'golden-abertura-1', 'turno manhã');
  RESET ROLE;
  IF NOT COALESCE((r->>'replay')::boolean, false) THEN RAISE EXCEPTION 'FALHOU 1b: reenvio da abertura não foi idempotente %', r; END IF;
  SELECT COUNT(*) INTO v_n FROM cash_registers WHERE company_id = CO AND status = 'open';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 1c: caixas abertos = %', v_n; END IF;

  -- 2. Venda S1 em dinheiro, 2x P1 = 20 (caixa). Esperado: total 20, P1 20 -> 18.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p1_2::jsonb, '[{"method":"cash","amount":20}]'::jsonb,
                          NULL, 0, 0, NULL, '83aa0000-0000-4000-8000-000000000001');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 2: venda S1 %', r; END IF;
  v_s1 := (r->>'sale_id')::uuid;
  SELECT stock_quantity INTO v_stock1 FROM products WHERE id = P1;
  IF v_stock1 <> 18 THEN RAISE EXCEPTION 'FALHOU 2b: estoque P1 = % (esperado 18)', v_stock1; END IF;

  -- 3. Dinheiro com troco: P2 = 50, cliente entregou 100 e levou troco 50. Banco recebe só o aplicado (50).
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p2_1::jsonb, '[{"method":"cash","amount":50}]'::jsonb,
                          NULL, 0, 0, NULL, '83aa0000-0000-4000-8000-000000000002');
  RESET ROLE;
  v_s2 := (r->>'sale_id')::uuid;
  -- 3b. Reenvio após falha de rede: mesma chave, mesmo conteúdo. Não pode baixar estoque de novo.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p2_1::jsonb, '[{"method":"cash","amount":50}]'::jsonb,
                          NULL, 0, 0, NULL, '83aa0000-0000-4000-8000-000000000002');
  RESET ROLE;
  v_s2_again := (r->>'sale_id')::uuid;
  IF v_s2_again <> v_s2 THEN RAISE EXCEPTION 'FALHOU 3b: reenvio criou outra venda (% vs %)', v_s2_again, v_s2; END IF;
  SELECT stock_quantity INTO v_stock2 FROM products WHERE id = P2;
  IF v_stock2 <> 3 THEN RAISE EXCEPTION 'FALHOU 3c: reenvio baixou estoque de novo (P2=%, esperado 3)', v_stock2; END IF;
  SELECT COUNT(*) INTO v_n FROM sales WHERE idempotency_key = '83aa0000-0000-4000-8000-000000000002'::uuid;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 3d: vendas com a mesma chave = %', v_n; END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_pay FROM payments WHERE sale_id = v_s2;
  IF v_pay <> 50 THEN RAISE EXCEPTION 'FALHOU 3e: pagamentos da venda = % (esperado 50, troco fora)', v_pay; END IF;

  -- 4. PIX: 1x P1 = 10. Esperado: P1 18 -> 17.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p1_1::jsonb, '[{"method":"pix","amount":10}]'::jsonb,
                          NULL, 0, 0, NULL, '83aa0000-0000-4000-8000-000000000003');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 4: venda PIX %', r; END IF;
  v_s3 := (r->>'sale_id')::uuid;

  -- 5. Cartão: 1x P2 = 50. Esperado: P2 3 -> 2.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p2_1::jsonb, '[{"method":"credit_card","amount":50,"installments":1}]'::jsonb,
                          NULL, 0, 0, NULL, '83aa0000-0000-4000-8000-000000000004');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 5: venda cartão %', r; END IF;
  v_s4 := (r->>'sale_id')::uuid;

  -- 6. Desconto válido: 2x P1 = 20, desconto 1,00 (5%) em dinheiro. Total 19. P1 17 -> 15.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := create_atomic_sale(CO, U_CAIXA, v_cr, items_p1_2::jsonb, '[{"method":"cash","amount":19}]'::jsonb,
                          NULL, 1, 0, NULL, '83aa0000-0000-4000-8000-000000000005');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 6: desconto válido %', r; END IF;
  v_s5 := (r->>'sale_id')::uuid;

  -- 7. Desconto acima de 5% recusado (1,01 de 20). Nada muda no estoque.
  PERFORM pg_temp.g_expect_refused(CAIXA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,1.01,0,NULL,%L)',
    CO, U_CAIXA, v_cr, items_p1_2, '[{"method":"cash","amount":18.99}]', '83aa0000-0000-4000-8000-000000000006'),
    'Desconto');
  SELECT stock_quantity INTO v_stock1 FROM products WHERE id = P1;
  IF v_stock1 <> 15 THEN RAISE EXCEPTION 'FALHOU 7b: venda recusada mudou estoque (P1=%)', v_stock1; END IF;

  -- 8. Desconto com cartão recusado (0,50 de 10 pago no cartão).
  PERFORM pg_temp.g_expect_refused(CAIXA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,0.5,0,NULL,%L)',
    CO, U_CAIXA, v_cr, items_p1_1, '[{"method":"credit_card","amount":9.5}]', '83aa0000-0000-4000-8000-000000000007'),
    'dinheiro');

  -- 9. Suprimento 30 e sangria 20 pelas RPCs. Sangria acima do saldo recusada.
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := registrar_movimento_caixa(v_cr, 'deposit', 30, 'suprimento troco', 'golden-sup-1');
  RESET ROLE;
  IF NOT COALESCE((r->>'movement_id') IS NOT NULL, false) THEN RAISE EXCEPTION 'FALHOU 9a: suprimento %', r; END IF;
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := registrar_movimento_caixa(v_cr, 'withdrawal', 20, 'sangria pagamento fornecedor', 'golden-san-1');
  RESET ROLE;
  IF NOT COALESCE((r->>'movement_id') IS NOT NULL, false) THEN RAISE EXCEPTION 'FALHOU 9b: sangria %', r; END IF;
  -- reenvio da sangria: mesma chave, não pode sangrar duas vezes
  PERFORM pg_temp.g_as_auth(CAIXA);
  r := registrar_movimento_caixa(v_cr, 'withdrawal', 20, 'sangria pagamento fornecedor', 'golden-san-1');
  RESET ROLE;
  SELECT COUNT(*) INTO v_n FROM cash_movements WHERE cash_register_id = v_cr AND type = 'withdrawal';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALHOU 9c: sangria reenviada gravou % vezes', v_n; END IF;
  PERFORM pg_temp.g_expect_refused(CAIXA, format(
    'SELECT registrar_movimento_caixa(%L,%L,%s,%L,%L)', v_cr, 'withdrawal', 100000, 'sangria excessiva', 'golden-san-2'),
    'Sangria maior que o saldo');

  -- 10. Estorno da venda S1 (20, dinheiro) pelo gerente. Estoque P1 volta 15 -> 17. Caixa perde 20.
  PERFORM pg_temp.g_as_auth(GERENTE);
  r := cancel_sale_with_reversal(v_s1, CO, U_GERENTE, 'Cliente desistiu da compra');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 10: estorno %', r; END IF;
  SELECT status INTO v_status FROM sales WHERE id = v_s1;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FALHOU 10b: status após estorno = %', v_status; END IF;
  SELECT stock_quantity INTO v_stock1 FROM products WHERE id = P1;
  IF v_stock1 <> 17 THEN RAISE EXCEPTION 'FALHOU 10c: estoque P1 após estorno = % (esperado 17)', v_stock1; END IF;

  -- 11. Caixa não estorna venda; cross-company não vende nem estorna.
  PERFORM pg_temp.g_expect_refused(CAIXA, format(
    'SELECT cancel_sale_with_reversal(%L,%L,%L,%L)', v_s3, CO, U_CAIXA, 'caixa tenta estornar'), 'permiss');
  PERFORM pg_temp.g_expect_refused(DONO_OUTRA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,0,0,NULL,%L)',
    CO, U_CAIXA, v_cr, items_p1_1, '[{"method":"pix","amount":10}]', '83aa0000-0000-4000-8000-000000000008'),
    'Acesso negado');
  PERFORM pg_temp.g_expect_refused(DONO_OUTRA, format(
    'SELECT cancel_sale_with_reversal(%L,%L,%L,%L)', v_s4, CO, '83000000-0000-4000-8000-000000000004', 'outra'),
    'Acesso negado');

  -- 12. Saldo esperado do caixa: 100 inicial + vendas em dinheiro (S2 50 + S5 19) + suprimento 30
  --     - sangria 20 = 179. (S1 estornada: sem efeito. PIX e cartão não entram no caixa.)
  PERFORM pg_temp.g_as_auth(GERENTE);
  r := relatorio_fechamento_caixa(v_cr);
  RESET ROLE;
  v_bal := (r->>'expected_cash')::numeric;
  IF v_bal IS DISTINCT FROM 179 THEN
    RAISE EXCEPTION 'FALHOU 12: saldo esperado do caixa = % (esperado 179)', v_bal;
  END IF;

  -- 13. Fechamento pelo gerente com valor contado 179: diferença zero. Reenvio com mesma chave é replay.
  PERFORM pg_temp.g_as_auth(GERENTE);
  r := fechar_caixa(v_cr, 179, 'golden-fechamento-1', 'conferido');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU 13: fechamento %', r; END IF;
  IF (r->>'difference')::numeric <> 0 THEN RAISE EXCEPTION 'FALHOU 13b: diferença = %', r->>'difference'; END IF;
  PERFORM pg_temp.g_as_auth(GERENTE);
  r := fechar_caixa(v_cr, 179, 'golden-fechamento-1', 'conferido');
  RESET ROLE;
  IF NOT COALESCE((r->>'replay')::boolean, false) THEN RAISE EXCEPTION 'FALHOU 13c: reenvio do fechamento não é replay %', r; END IF;

  -- 14. Venda com caixa fechado é recusada.
  PERFORM pg_temp.g_expect_refused(CAIXA, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb,NULL,0,0,NULL,%L)',
    CO, U_CAIXA, v_cr, items_p1_1, '[{"method":"cash","amount":10}]', '83aa0000-0000-4000-8000-000000000009'),
    'Caixa fechado');

  RAISE NOTICE 'GOLDEN FLOW OK: 14 blocos, saldo final 179, estoque P1=17, P2=2';
END $$;

ROLLBACK;
