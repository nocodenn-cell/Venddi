-- VENDDI-SEC-01: testes de autorização e isolamento para o hotfix de escrita direta.
-- Executar no schema remoto reconstruído (supabase/hotfix/README.md), antes e depois do hotfix:
--   docker exec -i <container> psql -U postgres -f supabase/hotfix/tests/sec01_autorizacao.sql
-- Grupos:
--   A = ataques: devem FALHAR antes do hotfix e PASSAR depois.
--   L = operações legítimas (app publicado em main): devem PASSAR antes e depois.
--   K = defeitos pré-existentes fora do escopo do hotfix (registrados, não corrigidos aqui).
-- Vendas de apoio são criadas como fixture (superusuário), para não depender da RPC com defeito.
-- Tudo roda dentro de BEGIN/ROLLBACK. Nada persiste.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('5ec01111-1111-4111-8111-111111111111', 'Sec01 A', '97.111.111/0001-11', 'starter', 'active'),
  ('5ec02222-2222-4222-8222-222222222222', 'Sec01 B', '97.222.222/0001-22', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_end_date, trial_days) VALUES
  ('5ec01111-1111-4111-8111-111111111111', 'starter', 'active', now() + interval '30 days', 30),
  ('5ec02222-2222-4222-8222-222222222222', 'starter', 'active', now() + interval '30 days', 30);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('5ec00000-0000-4000-8000-000000000001', '5ec01111-1111-4111-8111-111111111111', '5ec00000-0000-4000-8000-0000000000a1', 'owner@sec01.test', 'Owner A', 'owner', true),
  ('5ec00000-0000-4000-8000-000000000002', '5ec01111-1111-4111-8111-111111111111', '5ec00000-0000-4000-8000-0000000000a2', 'caixa@sec01.test', 'Caixa A', 'cashier', true),
  ('5ec00000-0000-4000-8000-000000000003', '5ec01111-1111-4111-8111-111111111111', '5ec00000-0000-4000-8000-0000000000a3', 'vend@sec01.test', 'Vendedor A', 'salesperson', true),
  ('5ec00000-0000-4000-8000-000000000004', '5ec02222-2222-4222-8222-222222222222', '5ec00000-0000-4000-8000-0000000000a4', 'owner@sec01b.test', 'Owner B', 'owner', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('5ec10000-0000-4000-8000-000000000001', '5ec01111-1111-4111-8111-111111111111', 'S01-1', 'Produto S01', 1, 10, 50, 1, true);

CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- Executa como o usuário autenticado. Retorna 'OK' se aceito, ou 'ERRO: ...' se recusado.
CREATE OR REPLACE FUNCTION pg_temp.try_sql(p_auth UUID, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  EXECUTE p_sql;
  RESET ROLE;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERRO: ' || SQLERRM;
END;
$$;

-- Como try_sql, mas exige SQLSTATE 42501 (sem permissão / RLS).
CREATE OR REPLACE FUNCTION pg_temp.try_denied(p_auth UUID, p_sql TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  EXECUTE p_sql;
  RESET ROLE;
  RETURN 'FALHOU: executou sem erro';
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  RETURN 'OK';
WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'FALHOU: erro diferente de 42501: ' || SQLERRM;
END;
$$;

-- Cancelamento pela função oficial (2 argumentos, como no remoto).
CREATE OR REPLACE FUNCTION pg_temp.try_cancel(p_auth UUID, p_sale UUID, p_reason TEXT) RETURNS TEXT
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_auth(p_auth);
  PERFORM cancel_sale_with_reversal(p_sale, p_reason);
  RESET ROLE;
  RETURN 'OK';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERRO: ' || SQLERRM;
END;
$$;

CREATE TEMP TABLE resultado (grupo TEXT, teste TEXT, resultado TEXT);
GRANT ALL ON resultado TO PUBLIC;

DO $$
DECLARE
  CO CONSTANT UUID := '5ec01111-1111-4111-8111-111111111111';
  OWNER_A CONSTANT UUID := '5ec00000-0000-4000-8000-0000000000a1';
  CAIXA CONSTANT UUID := '5ec00000-0000-4000-8000-0000000000a2';
  VEND CONSTANT UUID := '5ec00000-0000-4000-8000-0000000000a3';
  OWNER_B CONSTANT UUID := '5ec00000-0000-4000-8000-0000000000a4';
  U_OWNER_A CONSTANT UUID := '5ec00000-0000-4000-8000-000000000001';
  U_CAIXA CONSTANT UUID := '5ec00000-0000-4000-8000-000000000002';
  U_VEND CONSTANT UUID := '5ec00000-0000-4000-8000-000000000003';
  PRODUTO CONSTANT UUID := '5ec10000-0000-4000-8000-000000000001';
  v_cr UUID := gen_random_uuid();
  v_sale1 UUID := gen_random_uuid();
  v_sale2 UUID := gen_random_uuid();
  v_res TEXT;
  v_json JSONB;
  n INTEGER;
BEGIN
  -- Fixtures (superusuário). Caixa aberto e duas vendas de apoio, uma para cada teste.
  INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount)
  VALUES (v_cr, CO, U_CAIXA, 'open', 100);
  INSERT INTO sales (id, company_id, operator_id, cash_register_id, sale_number, subtotal, total, status)
  VALUES (v_sale1, CO, U_CAIXA, v_cr, 1001, 10, 10, 'completed'),
         (v_sale2, CO, U_CAIXA, v_cr, 1002, 10, 10, 'completed');
  INSERT INTO payments (sale_id, method, amount) VALUES (v_sale1, 'cash', 10), (v_sale2, 'cash', 10);

  -- K1: defeito pré-existente. A RPC create_atomic_sale do remoto falha sempre (FOR UPDATE com agregado).
  PERFORM pg_temp.as_auth(CAIXA);
  v_json := create_atomic_sale(CO, U_CAIXA, v_cr, format('[{"productId":"%s","quantity":1,"unitPrice":10,"discount":0}]', PRODUTO)::jsonb, '[{"method":"cash","amount":10}]'::jsonb);
  RESET ROLE;
  INSERT INTO resultado VALUES ('K', 'K1 create_atomic_sale (defeito FOR UPDATE com agregado no remoto)',
    CASE WHEN (v_json->>'success')::boolean IS TRUE THEN 'OK (defeito não reproduzido)' ELSE 'DEFEITO CONFIRMADO: ' || (v_json->>'error') END);

  -- L4: dono cancela venda pela função oficial
  INSERT INTO resultado VALUES ('L', 'L4 dono cancela venda pela função oficial',
    pg_temp.try_cancel(OWNER_A, v_sale1, 'Cliente desistiu da compra'));

  -- L2 e L3: gravações diretas de caixa do app publicado (sangria e fechamento)
  INSERT INTO resultado VALUES ('L', 'L2 sangria por INSERT direto (app publicado)',
    pg_temp.try_sql(CAIXA, format($q$INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after) VALUES ('%s', '%s', '%s', 'withdrawal', 5, 95)$q$, v_cr, CO, U_CAIXA)));
  INSERT INTO resultado VALUES ('L', 'L3 fechamento por UPDATE direto (app publicado)',
    pg_temp.try_sql(CAIXA, format($q$UPDATE cash_registers SET status = 'closed', closed_at = now(), final_amount = 95 WHERE id = '%s'$q$, v_cr)));

  -- L5: caixa não cancela venda (papel recusado pela função oficial)
  v_res := pg_temp.try_cancel(CAIXA, v_sale2, 'Caixa tentando cancelar');
  INSERT INTO resultado VALUES ('L', 'L5 caixa NÃO cancela venda (papel recusado)',
    CASE WHEN v_res LIKE 'ERRO%' THEN 'OK' ELSE 'FALHOU: caixa cancelou venda' END);

  -- A1: vendedor grava venda direto
  INSERT INTO resultado VALUES ('A', 'A1 vendedor insere venda direto',
    pg_temp.try_denied(VEND, format($q$INSERT INTO sales (company_id, operator_id, cash_register_id, sale_number, subtotal, total, status) VALUES ('%s', '%s', '%s', 999, 1, 1, 'completed')$q$, CO, U_VEND, v_cr)));

  -- A2: caixa altera total de venda existente direto (espera 0 linhas afetadas)
  PERFORM pg_temp.as_auth(CAIXA);
  UPDATE sales SET total = 0.01 WHERE id = v_sale1;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  INSERT INTO resultado VALUES ('A', 'A2 caixa altera total da venda direto',
    CASE WHEN n = 0 THEN 'OK' ELSE 'FALHOU: ' || n || ' venda(s) alterada(s)' END);

  -- A3: caixa apaga venda direto (espera 0 linhas afetadas)
  PERFORM pg_temp.as_auth(CAIXA);
  DELETE FROM sales WHERE id = v_sale1;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  INSERT INTO resultado VALUES ('A', 'A3 caixa apaga venda direto',
    CASE WHEN n = 0 THEN 'OK' ELSE 'FALHOU: ' || n || ' venda(s) apagada(s)' END);

  -- A4: caixa grava pagamento direto
  INSERT INTO resultado VALUES ('A', 'A4 caixa insere pagamento direto',
    pg_temp.try_denied(CAIXA, format($q$INSERT INTO payments (sale_id, method, amount) VALUES ('%s', 'pix', 10)$q$, v_sale2)));

  -- A5: caixa grava item de venda direto
  INSERT INTO resultado VALUES ('A', 'A5 caixa insere item de venda direto',
    pg_temp.try_denied(CAIXA, format($q$INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total, cost_price) VALUES ('%s', '%s', 1, 10, 0, 10, 1)$q$, v_sale2, PRODUTO)));

  -- A6: caixa altera trilha de auditoria (espera 0 linhas afetadas)
  PERFORM pg_temp.as_auth(CAIXA);
  UPDATE audit_logs SET action = 'x' WHERE company_id = CO;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  INSERT INTO resultado VALUES ('A', 'A6 caixa altera trilha de auditoria',
    CASE WHEN n = 0 THEN 'OK' ELSE 'FALHOU: ' || n || ' linha(s) alterada(s)' END);

  -- A7: caixa insere registro de auditoria falso
  INSERT INTO resultado VALUES ('A', 'A7 caixa insere auditoria falsa',
    pg_temp.try_denied(CAIXA, format($q$INSERT INTO audit_logs (company_id, user_id, action, entity_type) VALUES ('%s', '%s', 'falso', 'sale')$q$, CO, U_CAIXA)));

  -- A8: dono de outra empresa cancela venda da empresa A
  v_res := pg_temp.try_cancel(OWNER_B, v_sale2, 'Cancelamento cruzado');
  INSERT INTO resultado VALUES ('A', 'A8 dono de outra empresa cancela venda alheia',
    CASE WHEN v_res LIKE 'ERRO%' THEN 'OK' ELSE 'FALHOU: cancelou venda de outra empresa' END);

  -- A9 e A10: anon executa RPC financeira (deve ser negado por permissão de função)
  BEGIN
    SET ROLE anon;
    PERFORM create_atomic_sale(CO, U_CAIXA, v_cr, '[]'::jsonb, '[]'::jsonb);
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A9 anon executa create_atomic_sale', 'FALHOU: anon pôde executar');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A9 anon executa create_atomic_sale', 'OK');
  WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A9 anon executa create_atomic_sale', 'FALHOU: erro diferente de permissão: ' || SQLERRM);
  END;
  BEGIN
    SET ROLE anon;
    PERFORM calc_fechamento_caixa(v_cr);
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A10 anon executa calc_fechamento_caixa', 'FALHOU: anon pôde executar');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A10 anon executa calc_fechamento_caixa', 'OK');
  WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO resultado VALUES ('A', 'A10 anon executa calc_fechamento_caixa', 'FALHOU: erro diferente de permissão: ' || SQLERRM);
  END;
END $$;

-- A11: dono da empresa A não expira trial da empresa B (update_subscription_statuses só é global sem sessão)
DO $$
DECLARE
  v_status TEXT;
BEGIN
  UPDATE company_subscriptions SET status = 'trial', trial_end_date = now() - interval '1 day', converted_to_paid_at = NULL
  WHERE company_id = '5ec02222-2222-4222-8222-222222222222';
  PERFORM set_config('request.jwt.claim.sub', '5ec00000-0000-4000-8000-0000000000a1', true);
  SET ROLE authenticated;
  PERFORM update_subscription_statuses();
  RESET ROLE;
  SELECT status INTO v_status FROM company_subscriptions WHERE company_id = '5ec02222-2222-4222-8222-222222222222';
  INSERT INTO resultado VALUES ('A', 'A11 dono da empresa A expira trial da empresa B (chamada por sessão)',
    CASE WHEN v_status = 'trial' THEN 'OK' ELSE 'FALHOU: trial de outra empresa foi expirado (' || v_status || ')' END);
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  INSERT INTO resultado VALUES ('A', 'A11 dono da empresa A expira trial da empresa B (chamada por sessão)', 'FALHOU: ' || SQLERRM);
END $$;

-- L6 e L7: o authenticated mantém EXECUTE nas RPCs que o app publicado chama
INSERT INTO resultado VALUES ('L', 'L6 authenticated mantém EXECUTE em create_atomic_sale e cancel_sale_with_reversal',
  CASE WHEN has_function_privilege('authenticated', 'public.create_atomic_sale(uuid,uuid,uuid,jsonb,jsonb,uuid,numeric,numeric,text,uuid)', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.cancel_sale_with_reversal(uuid,text)', 'EXECUTE')
       THEN 'OK' ELSE 'FALHOU: perdeu EXECUTE' END);
INSERT INTO resultado VALUES ('L', 'L7 authenticated mantém EXECUTE em update_subscription_statuses e set_commission_percent',
  CASE WHEN has_function_privilege('authenticated', 'public.update_subscription_statuses()', 'EXECUTE')
        AND has_function_privilege('authenticated', 'public.set_commission_percent(uuid,numeric)', 'EXECUTE')
       THEN 'OK' ELSE 'FALHOU: perdeu EXECUTE' END);

SELECT grupo, teste, resultado FROM resultado ORDER BY grupo, teste;

ROLLBACK;
