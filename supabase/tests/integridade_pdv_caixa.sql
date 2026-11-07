-- Venddi - Integridade do PDV e do caixa (migrations 028 a 030).
-- Cobre: gravações diretas recusadas (vendas, pagamentos, auditoria, caixa), venda com chave
-- repetida sem duplicar, falha de venda sem gravação parcial, cancelamento por papel errado,
-- duplo cancelamento, trilha de auditoria e isolamento entre empresas.
-- Executar com migrations 001..030 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/integridade_pdv_caixa.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('c5111111-1111-4111-8111-111111111111', 'Integridade A', '96.111.111/0001-11', 'starter', 'active'),
  ('c5222222-2222-4222-8222-222222222222', 'Integridade B', '96.222.222/0001-22', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('c5111111-1111-4111-8111-111111111111', 'starter', 'active', 15),
  ('c5222222-2222-4222-8222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('c5000000-0000-4000-8000-000000000001', 'c5111111-1111-4111-8111-111111111111', 'c5000000-0000-4000-8000-0000000000a1', 'owner@int.test', 'Owner', 'owner', true),
  ('c5000000-0000-4000-8000-000000000002', 'c5111111-1111-4111-8111-111111111111', 'c5000000-0000-4000-8000-0000000000a2', 'caixa@int.test', 'Caixa', 'cashier', true),
  ('c5000000-0000-4000-8000-000000000003', 'c5111111-1111-4111-8111-111111111111', 'c5000000-0000-4000-8000-0000000000a3', 'vend@int.test', 'Vendedor', 'salesperson', true),
  ('c5000000-0000-4000-8000-000000000004', 'c5222222-2222-4222-8222-222222222222', 'c5000000-0000-4000-8000-0000000000a4', 'owner@intb.test', 'Owner B', 'owner', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('c5100000-0000-4000-8000-000000000001', 'c5111111-1111-4111-8111-111111111111', 'INT-1', 'Produto int', 1, 10, 5, 1, true);

CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- RPC que devolve {success:false} com a mensagem dada (venda e estorno).
CREATE OR REPLACE FUNCTION pg_temp.expect_json_fail(p_label TEXT, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_res JSONB;
BEGIN
  EXECUTE p_sql INTO v_res;
  IF (v_res->>'success') IS DISTINCT FROM 'false' OR POSITION(p_msg IN (v_res->>'error')) = 0 THEN
    RAISE EXCEPTION 'FALHOU %: resultado inesperado: %', p_label, v_res;
  END IF;
END;
$$;

DO $$
DECLARE
  OWNER_A CONSTANT UUID := 'c5000000-0000-4000-8000-0000000000a1';
  CAIXA CONSTANT UUID := 'c5000000-0000-4000-8000-0000000000a2';
  VEND CONSTANT UUID := 'c5000000-0000-4000-8000-0000000000a3';
  OWNER_B CONSTANT UUID := 'c5000000-0000-4000-8000-0000000000a4';
  U_OWNER_A CONSTANT UUID := 'c5000000-0000-4000-8000-000000000001';
  U_CAIXA CONSTANT UUID := 'c5000000-0000-4000-8000-000000000002';
  U_VEND CONSTANT UUID := 'c5000000-0000-4000-8000-000000000003';
  CO CONSTANT UUID := 'c5111111-1111-4111-8111-111111111111';
  PRODUTO CONSTANT UUID := 'c5100000-0000-4000-8000-000000000001';
  v_res JSONB;
  v_cr UUID;
  v_sale UUID;
  n INTEGER;
  v_total NUMERIC;
  v_status TEXT;
  v_items TEXT := format('[{"productId":"%s","quantity":1,"unitPrice":10,"discount":0}]', PRODUTO);
  v_pagos TEXT := '[{"method":"cash","amount":10}]';
BEGIN
  -- Caixa aberto pela RPC (como a tela faz)
  PERFORM pg_temp.as_auth(CAIXA);
  v_res := abrir_caixa(CO, 0, 'int-abrir-1', NULL);
  v_cr := (v_res->>'cash_register_id')::UUID;
  RESET ROLE;

  -- 1. Venda via RPC, com chave de idempotência
  PERFORM pg_temp.as_auth(CAIXA);
  v_res := create_atomic_sale(p_company_id => CO, p_operator_id => U_CAIXA, p_cash_register_id => v_cr,
    p_items => v_items::jsonb, p_payments => v_pagos::jsonb, p_idempotency_key => '11111111-1111-4111-8111-111111111111'::uuid);
  RESET ROLE;
  IF (v_res->>'success')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU 1: venda não registrada: %', v_res; END IF;
  v_sale := (v_res->>'sale_id')::UUID;

  -- 2. Mesma chave repetida: devolve a mesma venda, sem duplicar
  PERFORM pg_temp.as_auth(CAIXA);
  v_res := create_atomic_sale(p_company_id => CO, p_operator_id => U_CAIXA, p_cash_register_id => v_cr,
    p_items => v_items::jsonb, p_payments => v_pagos::jsonb, p_idempotency_key => '11111111-1111-4111-8111-111111111111'::uuid);
  RESET ROLE;
  IF (v_res->>'sale_id')::UUID <> v_sale THEN RAISE EXCEPTION 'FALHOU 2: repetição gerou outra venda: %', v_res; END IF;
  SELECT COUNT(*) INTO n FROM sales WHERE company_id = CO;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 2: venda duplicada (% vendas)', n; END IF;
  SELECT COUNT(*) INTO n FROM cash_movements WHERE cash_register_id = v_cr AND type = 'sale';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 2: movimento de venda duplicado (% movimentos)', n; END IF;
  SELECT total_sales INTO v_total FROM cash_registers WHERE id = v_cr;
  IF v_total <> 10 THEN RAISE EXCEPTION 'FALHOU 2: total de vendas duplicado (%)', v_total; END IF;

  -- 3. Gravações diretas pela API são recusadas ou não alteram nada (migration 030)
  PERFORM pg_temp.as_auth(VEND);
  BEGIN
    INSERT INTO sales (company_id, operator_id, cash_register_id, sale_number, subtotal, total, status)
    VALUES (CO, U_VEND, v_cr, 999, 1, 1, 'completed');
    RESET ROLE;
    RAISE EXCEPTION 'FALHOU 3: vendedor inseriu venda direto';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;
  PERFORM pg_temp.as_auth(CAIXA);
  BEGIN
    INSERT INTO payments (sale_id, method, amount) VALUES (v_sale, 'pix', 10);
    RESET ROLE;
    RAISE EXCEPTION 'FALHOU 3: pagamento inserido direto';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;
  PERFORM pg_temp.as_auth(OWNER_A);
  UPDATE sales SET status = 'cancelled' WHERE id = v_sale;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 3: venda alterada direto (% linhas)', n; END IF;
  PERFORM pg_temp.as_auth(OWNER_A);
  DELETE FROM sales WHERE id = v_sale;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 3: venda apagada direto (% linhas)', n; END IF;
  PERFORM pg_temp.as_auth(OWNER_A);
  UPDATE audit_logs SET action = 'x' WHERE company_id = CO;
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM audit_logs WHERE company_id = CO;
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RESET ROLE;
  IF n <> 0 OR v_total <> 0 THEN RAISE EXCEPTION 'FALHOU 3: trilha de auditoria alterada'; END IF;

  -- 4. Falha de venda não grava nada (estoque insuficiente)
  PERFORM pg_temp.as_auth(CAIXA);
  v_res := create_atomic_sale(p_company_id => CO, p_operator_id => U_CAIXA, p_cash_register_id => v_cr,
    p_items => format('[{"productId":"%s","quantity":99,"unitPrice":10,"discount":0}]', PRODUTO)::jsonb,
    p_payments => '[{"method":"cash","amount":990}]'::jsonb);
  RESET ROLE;
  IF (v_res->>'success') IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'FALHOU 4: venda sem estoque foi aceita: %', v_res; END IF;
  SELECT COUNT(*) INTO n FROM sales WHERE company_id = CO;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 4: venda recusada deixou registro (% vendas)', n; END IF;
  SELECT total_sales INTO v_total FROM cash_registers WHERE id = v_cr;
  IF v_total <> 10 THEN RAISE EXCEPTION 'FALHOU 4: total do caixa mudou (%)', v_total; END IF;
  SELECT stock_quantity INTO n FROM products WHERE id = PRODUTO;
  IF n <> 4 THEN RAISE EXCEPTION 'FALHOU 4: estoque alterado pela venda recusada (%)', n; END IF;

  -- 5. Pagamento diferente do total: recusado, sem registro
  PERFORM pg_temp.as_auth(CAIXA);
  v_res := create_atomic_sale(p_company_id => CO, p_operator_id => U_CAIXA, p_cash_register_id => v_cr,
    p_items => v_items::jsonb, p_payments => '[{"method":"cash","amount":7}]'::jsonb);
  RESET ROLE;
  IF (v_res->>'success') IS DISTINCT FROM 'false' THEN RAISE EXCEPTION 'FALHOU 5: pagamento incompleto aceito: %', v_res; END IF;
  SELECT COUNT(*) INTO n FROM sales WHERE company_id = CO;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 5: venda com pagamento errado gravada (% vendas)', n; END IF;

  -- 6. Cancelamento por caixa: recusado (papel sem permissão)
  PERFORM pg_temp.as_auth(CAIXA);
  PERFORM pg_temp.expect_json_fail('6 caixa cancela venda',
    format($q$SELECT cancel_sale_with_reversal('%s', '%s', '%s', 'Teste')$q$, v_sale, CO, U_CAIXA),
    'Papel sem permissão para cancelar venda');
  RESET ROLE;

  -- 7. Cancelamento pelo dono: estorna o dinheiro; repetir o cancelamento é recusado
  PERFORM pg_temp.as_auth(OWNER_A);
  v_res := cancel_sale_with_reversal(v_sale, CO, U_OWNER_A, 'Cliente desistiu');
  RESET ROLE;
  IF (v_res->>'success')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALHOU 7: cancelamento recusado: %', v_res; END IF;
  SELECT total_sales INTO v_total FROM cash_registers WHERE id = v_cr;
  IF v_total <> 0 THEN RAISE EXCEPTION 'FALHOU 7: total de vendas não voltou a zero (%)', v_total; END IF;
  SELECT COUNT(*) INTO n FROM cash_movements WHERE cash_register_id = v_cr AND type = 'refund';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 7: estorno no caixa ausente (% estornos)', n; END IF;
  PERFORM pg_temp.as_auth(OWNER_A);
  PERFORM pg_temp.expect_json_fail('7 cancelamento repetido',
    format($q$SELECT cancel_sale_with_reversal('%s', '%s', '%s', 'Teste')$q$, v_sale, CO, U_OWNER_A),
    'Sale already cancelled');
  RESET ROLE;
  SELECT total_sales INTO v_total FROM cash_registers WHERE id = v_cr;
  IF v_total <> 0 THEN RAISE EXCEPTION 'FALHOU 7: cancelamento repetido alterou o caixa (%)', v_total; END IF;

  -- 8. Outra empresa não cancela venda desta empresa
  PERFORM pg_temp.as_auth(OWNER_B);
  PERFORM pg_temp.expect_json_fail('8 dono de outra empresa cancela',
    format($q$SELECT cancel_sale_with_reversal('%s', '%s', '%s', 'Teste')$q$, v_sale, CO, 'c5000000-0000-4000-8000-000000000004'),
    'Acesso negado');
  RESET ROLE;

  -- 9. Trilha de auditoria das vendas (criação e cancelamento)
  SELECT COUNT(*) INTO n FROM audit_logs WHERE company_id = CO AND action = 'sale.create';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 9: auditoria de criação ausente ou duplicada (% linhas)', n; END IF;
  SELECT COUNT(*) INTO n FROM audit_logs WHERE company_id = CO AND action = 'sale.cancel';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 9: auditoria de cancelamento ausente ou duplicada (% linhas)', n; END IF;
  SELECT status INTO v_status FROM sales WHERE id = v_sale;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FALHOU 9: status da venda (%)', v_status; END IF;

  RAISE NOTICE 'INTEGRIDADE PDV CAIXA OK';
END $$;

SELECT 'INTEGRIDADE PDV CAIXA OK' AS r;
ROLLBACK;
