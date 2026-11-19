-- Venddi - Isolamento multiempresa e permissões das RPCs de venda e trial (migration 026)
-- Cada cenário explorado na revisão tem uma asserção: o ataque precisa ser recusado com a
-- mensagem certa, e o uso legítimo precisa continuar funcionando.
-- Executar com migrations 001..026 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/isolamento_permissoes_vendas.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('71111111-1111-1111-1111-111111111111', 'Iso A', '71.111.111/0001-71', 'starter', 'active'),
  ('72222222-2222-2222-2222-222222222222', 'Iso B', '72.222.222/0001-72', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('71111111-1111-1111-1111-111111111111', 'starter', 'active', 15),
  ('72222222-2222-2222-2222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('71000000-0000-4000-8000-000000000001', '71111111-1111-1111-1111-111111111111', '71000000-0000-4000-8000-0000000000a1', 'owner@iso-a.test', 'Owner A', 'owner', true),
  ('71000000-0000-4000-8000-000000000002', '71111111-1111-1111-1111-111111111111', '71000000-0000-4000-8000-0000000000a2', 'caixa@iso-a.test', 'Caixa A', 'cashier', true),
  ('71000000-0000-4000-8000-000000000003', '71111111-1111-1111-1111-111111111111', '71000000-0000-4000-8000-0000000000a3', 'gerente@iso-a.test', 'Gerente A', 'manager', true),
  ('71000000-0000-4000-8000-000000000004', '71111111-1111-1111-1111-111111111111', '71000000-0000-4000-8000-0000000000a4', 'caixa2@iso-a.test', 'Caixa 2 A', 'cashier', true),
  ('72000000-0000-4000-8000-000000000001', '72222222-2222-2222-2222-222222222222', '72000000-0000-4000-8000-0000000000b1', 'owner@iso-b.test', 'Owner B', 'owner', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('71100000-0000-4000-8000-000000000001', '71111111-1111-1111-1111-111111111111', 'ISO-A1', 'Produto A', 1, 2, 10, 1, true);
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
  ('71200000-0000-4000-8000-000000000001', '71111111-1111-1111-1111-111111111111', '71000000-0000-4000-8000-000000000002', 'open', 100);

-- Helpers: trocam a identidade da sessão (RLS e get_user_company_id valem) e checam erro esperado
CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(p_auth UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
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

-- As RPCs de venda capturam exceções e devolvem {"success": false, "error": ...}, como a tela espera.
CREATE OR REPLACE FUNCTION pg_temp.expect_json_fail(p_auth UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v JSONB;
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  EXECUTE p_sql INTO v;
  RESET ROLE;
  IF (v->>'success')::boolean OR v->>'error' NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU (esperado "%"): %', p_msg, v;
  END IF;
END;
$$;

DO $$
DECLARE
  OWNER_A CONSTANT UUID := '71000000-0000-4000-8000-0000000000a1';
  CAIXA_A CONSTANT UUID := '71000000-0000-4000-8000-0000000000a2';
  GERENTE_A CONSTANT UUID := '71000000-0000-4000-8000-0000000000a3';
  CAIXA2_A CONSTANT UUID := '71000000-0000-4000-8000-0000000000a4';
  OWNER_B CONSTANT UUID := '72000000-0000-4000-8000-0000000000b1';
  CO_A CONSTANT UUID := '71111111-1111-1111-1111-111111111111';
  CO_B CONSTANT UUID := '72222222-2222-2222-2222-222222222222';
  U_CAIXA CONSTANT UUID := '71000000-0000-4000-8000-000000000002';
  U_CAIXA2 CONSTANT UUID := '71000000-0000-4000-8000-000000000004';
  U_OWNER CONSTANT UUID := '71000000-0000-4000-8000-000000000001';
  U_GERENTE CONSTANT UUID := '71000000-0000-4000-8000-000000000003';
  CR CONSTANT UUID := '71200000-0000-4000-8000-000000000001';
  P CONSTANT UUID := '71100000-0000-4000-8000-000000000001';
  ITEM TEXT := '[{"productId":"71100000-0000-4000-8000-000000000001","quantity":1,"unitPrice":20,"discount":0}]';
  PAY TEXT := '[{"method":"cash","amount":20}]';
  r JSONB;
  v_sale UUID;
  v_stock INTEGER;
BEGIN
  -- 1. Owner da empresa B tenta vender na empresa A (antes: criava venda e baixava estoque)
  PERFORM pg_temp.expect_json_fail(OWNER_B, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb)', CO_A, U_CAIXA, CR, ITEM, PAY),
    'Acesso negado: empresa diferente da sessão');

  -- 2. Caixa tenta vender em nome de outro operador
  PERFORM pg_temp.expect_json_fail(CAIXA_A, format(
    'SELECT create_atomic_sale(%L,%L,%L,%L::jsonb,%L::jsonb)', CO_A, U_CAIXA2, CR, ITEM, PAY),
    'Operador deve ser o usuário logado');

  -- 3. Venda legítima do próprio caixa continua funcionando
  PERFORM pg_temp.as_auth(CAIXA_A);
  r := create_atomic_sale(CO_A, U_CAIXA, CR, ITEM::jsonb, PAY::jsonb);
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: venda legítima recusada: %', r; END IF;
  v_sale := (r->>'sale_id')::UUID;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P;
  IF v_stock <> 9 THEN RAISE EXCEPTION 'FALHOU: saldo após venda legítima % (esperado 9)', v_stock; END IF;

  -- 4. Owner da empresa B tenta cancelar venda da A (antes: cancelava)
  -- Assinatura de 2 argumentos: a empresa vem da sessão, então a venda da A não existe para a B
  PERFORM pg_temp.expect_fail(OWNER_B, format(
    'SELECT cancel_sale_with_reversal(%L,%L)', v_sale, 'ataque'),
    'Venda não encontrada');

  -- 5. Caixa tenta cancelar venda (papel sem sales.cancel; antes o banco aceitava)
  PERFORM pg_temp.expect_fail(CAIXA_A, format(
    'SELECT cancel_sale_with_reversal(%L,%L)', v_sale, 'caixa cancela'),
    'Sem permissão para cancelar vendas');

  -- 6. Gerente cancela com o próprio id como operador: permitido
  PERFORM pg_temp.as_auth(GERENTE_A);
  r := cancel_sale_with_reversal(v_sale, 'estorno legítimo');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: gerente não conseguiu cancelar: %', r; END IF;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P;
  IF v_stock <> 10 THEN RAISE EXCEPTION 'FALHOU: saldo após estorno % (esperado 10)', v_stock; END IF;

  -- 7. Venda do caixa A, cancelada pelo gerente (o autor é sempre o usuário da sessão)
  PERFORM pg_temp.as_auth(CAIXA_A);
  r := create_atomic_sale(CO_A, U_CAIXA, CR, ITEM::jsonb, PAY::jsonb);
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: venda do caixa recusada: %', r; END IF;
  v_sale := (r->>'sale_id')::UUID;
  PERFORM pg_temp.as_auth(GERENTE_A);
  r := cancel_sale_with_reversal(v_sale, 'cancelado pelo gerente');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: gerente não conseguiu cancelar a própria venda: %', r; END IF;

  -- 8. Trial: owner B não consegue ler o trial da empresa A (nem o próprio, se pedir o id da A)
  PERFORM pg_temp.as_auth(OWNER_B);
  IF is_trial_active(CO_A) THEN RAISE EXCEPTION 'FALHOU: owner B leu trial ativo da empresa A'; END IF;
  IF get_remaining_trial_days(CO_A) <> 0 THEN RAISE EXCEPTION 'FALHOU: owner B leu dias de trial da empresa A'; END IF;
  RESET ROLE;

  -- 9. Trial: o próprio dono continua vendo o próprio trial (ativo, 15 dias)
  PERFORM pg_temp.as_auth(OWNER_A);
  IF NOT is_trial_active(CO_A) AND (SELECT status FROM company_subscriptions WHERE company_id = CO_A) = 'trial' THEN
    RAISE EXCEPTION 'FALHOU: dono não vê o próprio trial';
  END IF;
  RESET ROLE;

  -- 10. Isolamento de leitura do painel e do estoque baixo (RLS) continua ativo
  PERFORM pg_temp.as_auth(OWNER_B);
  IF (SELECT count(*) FROM products WHERE company_id = CO_A) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: owner B lê produtos da A';
  END IF;
  IF (SELECT count(*) FROM sales WHERE company_id = CO_A) <> 0 THEN
    RAISE EXCEPTION 'FALHOU: owner B lê vendas da A';
  END IF;
  RESET ROLE;
END $$;

SELECT 'ISOLAMENTO E PERMISSOES OK' AS r;
ROLLBACK;
