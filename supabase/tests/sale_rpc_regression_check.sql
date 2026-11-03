-- Venddi - Regressão das RPCs de venda (migrations 021 e 022)
-- Cobre os dois defeitos reais encontrados na homologação local:
--   021: create_atomic_sale falhava sempre (FOR UPDATE com agregado) e a venda com
--        dinheiro não preenchia cash_movements.user_id (NOT NULL);
--   022: cancel_sale_with_reversal não preenchia cash_movements.user_id.
-- Executar com migrations 001..022 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/sale_rpc_regression_check.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('33333333-3333-3333-3333-333333333333', 'Loja Venda', '33.333.333/0001-33', 'starter', 'active');
-- Sem assinatura ativa a empresa não resolve (controle de trial, migration 016).
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('33333333-3333-3333-3333-333333333333', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('e3000000-0000-4000-8000-000000000001', '33333333-3333-3333-3333-333333333333', 'e3000000-0000-4000-8000-0000000000a1', 'owner@venda.test', 'Owner Venda', 'owner', true),
  ('e3000000-0000-4000-8000-000000000002', '33333333-3333-3333-3333-333333333333', 'e3000000-0000-4000-8000-0000000000a2', 'caixa@venda.test', 'Caixa Venda', 'cashier', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('e3000000-0000-4000-8000-000000000011', '33333333-3333-3333-3333-333333333333', 'V-1', 'Produto Venda', 10, 20, 10, 1, true);
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
  ('e3000000-0000-4000-8000-000000000021', '33333333-3333-3333-3333-333333333333', 'e3000000-0000-4000-8000-000000000002', 'open', 100);

DO $$
DECLARE
  CO CONSTANT UUID := '33333333-3333-3333-3333-333333333333';
  OWNER_AUTH CONSTANT UUID := 'e3000000-0000-4000-8000-0000000000a1';
  CAIXA_AUTH CONSTANT UUID := 'e3000000-0000-4000-8000-0000000000a2';
  CAIXA CONSTANT UUID := 'e3000000-0000-4000-8000-000000000002';
  OWNER CONSTANT UUID := 'e3000000-0000-4000-8000-000000000001';
  CR CONSTANT UUID := 'e3000000-0000-4000-8000-000000000021';
  P CONSTANT UUID := 'e3000000-0000-4000-8000-000000000011';
  r JSONB;
  v_sale UUID;
  v_stock INTEGER;
  n INTEGER;
BEGIN
  -- 1. Venda com dinheiro pelo caixa (create_atomic_sale)
  PERFORM set_config('request.jwt.claim.sub', CAIXA_AUTH::text, true);
  SET LOCAL ROLE authenticated;
  r := create_atomic_sale(CO, CAIXA, CR,
    jsonb_build_array(jsonb_build_object('productId', P, 'quantity', 2, 'unitPrice', 20, 'discount', 0)),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 40)));
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: venda com dinheiro recusada: %', r; END IF;
  v_sale := (r->>'sale_id')::UUID;

  SELECT stock_quantity INTO v_stock FROM products WHERE id = P;
  IF v_stock <> 8 THEN RAISE EXCEPTION 'FALHOU: saldo após venda % (esperado 8)', v_stock; END IF;
  IF NOT EXISTS (SELECT 1 FROM cash_movements WHERE reference_id = v_sale AND type = 'sale' AND user_id = CAIXA) THEN
    RAISE EXCEPTION 'FALHOU: movimento de caixa da venda sem user_id';
  END IF;

  -- 2. Estorno com movimento de caixa (cancel_sale_with_reversal, como gerente/owner)
  PERFORM set_config('request.jwt.claim.sub', OWNER_AUTH::text, true);
  SET LOCAL ROLE authenticated;
  r := cancel_sale_with_reversal(v_sale, CO, OWNER, 'Teste de regressão');
  RESET ROLE;
  IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'FALHOU: estorno recusado: %', r; END IF;

  SELECT stock_quantity INTO v_stock FROM products WHERE id = P;
  IF v_stock <> 10 THEN RAISE EXCEPTION 'FALHOU: saldo após estorno % (esperado 10)', v_stock; END IF;
  SELECT count(*) INTO n FROM cash_movements WHERE reference_id = v_sale AND type = 'refund' AND user_id IS NOT NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: estorno de caixa sem user_id ou ausente (%)', n; END IF;
END $$;

SELECT 'SALE RPC REGRESSION OK' AS r;
ROLLBACK;
