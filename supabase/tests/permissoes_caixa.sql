-- Venddi - Permissões do caixa (migration 027). Reproduz o achado da homologação:
-- vendedor gravava sangria e zerava o valor inicial do caixa.
-- Executar com migrations 001..027 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/permissoes_caixa.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('a3333333-3333-3333-3333-333333333333', 'Caixa Perm', '93.333.333/0001-94', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('a3333333-3333-3333-3333-333333333333', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('a3000000-0000-4000-8000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'a3000000-0000-4000-8000-0000000000a1', 'owner@cx.test', 'Owner', 'owner', true),
  ('a3000000-0000-4000-8000-000000000002', 'a3333333-3333-3333-3333-333333333333', 'a3000000-0000-4000-8000-0000000000a2', 'caixa@cx.test', 'Caixa', 'cashier', true),
  ('a3000000-0000-4000-8000-000000000003', 'a3333333-3333-3333-3333-333333333333', 'a3000000-0000-4000-8000-0000000000a3', 'vendedor@cx.test', 'Vendedor', 'salesperson', true);
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
  ('a3200000-0000-4000-8000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'a3000000-0000-4000-8000-000000000002', 'open', 100);
INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after) VALUES
  ('a3200000-0000-4000-8000-000000000001', 'a3333333-3333-3333-3333-333333333333', 'a3000000-0000-4000-8000-000000000002', 'deposit', 10, 0);

CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

DO $$
DECLARE
  OWNER CONSTANT UUID := 'a3000000-0000-4000-8000-0000000000a1';
  CAIXA CONSTANT UUID := 'a3000000-0000-4000-8000-0000000000a2';
  VENDEDOR CONSTANT UUID := 'a3000000-0000-4000-8000-0000000000a3';
  CR CONSTANT UUID := 'a3200000-0000-4000-8000-000000000001';
  CO CONSTANT UUID := 'a3333333-3333-3333-3333-333333333333';
  U_VENDEDOR CONSTANT UUID := 'a3000000-0000-4000-8000-000000000003';
  U_CAIXA CONSTANT UUID := 'a3000000-0000-4000-8000-000000000002';
  n INTEGER;
  v_inicial NUMERIC;
  v_status TEXT;
BEGIN
  -- 1. Vendedor não grava sangria (RLS recusa o INSERT)
  PERFORM pg_temp.as_auth(VENDEDOR);
  BEGIN
    INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after)
    VALUES (CR, CO, U_VENDEDOR, 'withdrawal', 80, 0);
    RESET ROLE;
    RAISE EXCEPTION 'FALHOU 1: vendedor gravou movimento de caixa';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;

  -- 2. Vendedor não fecha nem altera o caixa (UPDATE sem política: 0 linhas)
  PERFORM pg_temp.as_auth(VENDEDOR);
  UPDATE cash_registers SET status = 'closed' WHERE id = CR;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 2: vendedor alterou o caixa (% linhas)', n; END IF;

  -- 3. Caixa registra suprimento (INSERT permitido)
  PERFORM pg_temp.as_auth(CAIXA);
  INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after)
  VALUES (CR, CO, U_CAIXA, 'withdrawal', 5, 0);
  RESET ROLE;

  -- 4. Razão imutável: ninguém atualiza nem apaga movimento (0 linhas, sem erro)
  PERFORM pg_temp.as_auth(OWNER);
  UPDATE cash_movements SET amount = 999 WHERE cash_register_id = CR;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 4: movimento atualizado (% linhas)', n; END IF;
  DELETE FROM cash_movements WHERE cash_register_id = CR;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 4: movimento apagado (% linhas)', n; END IF;
  RESET ROLE;

  -- 5. Caixa não altera o valor inicial (trigger); gerente pode
  PERFORM pg_temp.as_auth(CAIXA);
  BEGIN
    UPDATE cash_registers SET initial_amount = 0 WHERE id = CR;
    RESET ROLE;
    RAISE EXCEPTION 'FALHOU 5: caixa alterou valor inicial';
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
  END;
  SELECT initial_amount INTO v_inicial FROM cash_registers WHERE id = CR;
  IF v_inicial <> 100 THEN RAISE EXCEPTION 'FALHOU 5: valor inicial mudou para %', v_inicial; END IF;

  PERFORM pg_temp.as_auth(OWNER);
  UPDATE cash_registers SET initial_amount = 120 WHERE id = CR;
  RESET ROLE;
  SELECT initial_amount INTO v_inicial FROM cash_registers WHERE id = CR;
  IF v_inicial <> 120 THEN RAISE EXCEPTION 'FALHOU 5b: gerente não conseguiu alterar valor inicial'; END IF;

  -- 6. Caixa fecha o próprio caixa (UPDATE de status permitido)
  PERFORM pg_temp.as_auth(CAIXA);
  UPDATE cash_registers SET status = 'closed' WHERE id = CR;
  RESET ROLE;
  SELECT status INTO v_status FROM cash_registers WHERE id = CR;
  IF v_status <> 'closed' THEN RAISE EXCEPTION 'FALHOU 6: caixa não fechou (status %)', v_status; END IF;

  -- 7. Ninguém apaga caixa
  PERFORM pg_temp.as_auth(OWNER);
  DELETE FROM cash_registers WHERE id = CR;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 7: caixa apagado'; END IF;
  RESET ROLE;
END $$;

SELECT 'PERMISSOES CAIXA OK' AS r;
ROLLBACK;
