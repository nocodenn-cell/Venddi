-- Venddi - testes de isolamento entre empresas (migration 012)
-- Executa sem pgTAP: cada verificação falha com EXCEPTION. Tudo roda numa transação e é desfeito.
-- Uso local: psql -v ON_ERROR_STOP=1 -f supabase/tests/012_tenant_isolation_test.sql
-- NUNCA executar em produção (cria e remove dados de teste; termina em ROLLBACK).
BEGIN;

CREATE TEMP TABLE _t (n serial, name text, ok boolean);
GRANT ALL ON _t TO authenticated, anon;
GRANT USAGE ON SEQUENCE _t_n_seq TO authenticated, anon;

CREATE OR REPLACE FUNCTION pg_temp.ok(p boolean, p_name text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _t(name, ok) VALUES (p_name, coalesce(p, false));
  IF NOT coalesce(p, false) THEN RAISE EXCEPTION 'FALHOU: %', p_name; END IF;
  RAISE NOTICE 'ok - %', p_name;
END $$;

-- Executa um comando como o usuário autenticado e diz se foi recusado.
CREATE OR REPLACE FUNCTION pg_temp.denied(p_sql text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 0;  -- RLS filtrou: nenhuma linha afetada
EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN
  RETURN true;
WHEN OTHERS THEN
  IF SQLERRM ILIKE '%row-level security%' OR SQLERRM ILIKE '%permission denied%' THEN RETURN true; END IF;
  RAISE;
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pg_temp TO authenticated, anon;

-- ---------- Seed: cadastro real pelo gatilho de auth.users ----------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'dono.a@teste.local', '{"full_name":"Dono A","company_name":"Loja A","cnpj":"11.111.111/0001-11"}'),
 ('bbbbbbbb-0000-0000-0000-000000000001', 'dono.b@teste.local', '{"full_name":"Dono B","company_name":"Loja B","cnpj":"22.222.222/0001-22"}'),
 ('cccccccc-0000-0000-0000-000000000001', 'sem.empresa@teste.local', '{}');

SELECT pg_temp.ok((SELECT count(*) FROM users WHERE auth_id IN ('aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000001')) = 2,
  'cadastro cria usuário dono para A e B');
SELECT pg_temp.ok((SELECT role FROM users WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'owner', 'cadastro define papel owner no servidor');
SELECT pg_temp.ok((SELECT s.status FROM company_subscriptions s JOIN users u ON u.company_id = s.company_id
  WHERE u.auth_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'pending', 'cadastro sem teste automático (status pending)');
SELECT pg_temp.ok(bootstrap_company_for_auth_user('aaaaaaaa-0000-0000-0000-000000000001','x','Dono A','Outra','33.333.333/0001-33')
  = (SELECT company_id FROM users WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'bootstrap idempotente (não cria 2ª empresa)');

-- Libera a avaliação de A (ação comercial, papel de serviço).
SELECT approve_company_evaluation((SELECT company_id FROM users WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 30);

-- Dados de B (criados como superusuário).
CREATE TEMP TABLE ids AS
SELECT (SELECT company_id FROM users WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000001') AS ca,
       (SELECT company_id FROM users WHERE auth_id = 'bbbbbbbb-0000-0000-0000-000000000001') AS cb,
       (SELECT id FROM users WHERE auth_id = 'aaaaaaaa-0000-0000-0000-000000000001') AS ua,
       (SELECT id FROM users WHERE auth_id = 'bbbbbbbb-0000-0000-0000-000000000001') AS ub;
GRANT SELECT ON ids TO authenticated;

INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity)
SELECT 'b0000000-0000-0000-0000-00000000000b', cb, 'B-1', 'Produto B', 5, 10, 50 FROM ids;
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity)
SELECT 'a0000000-0000-0000-0000-00000000000a', ca, 'A-1', 'Arroz 5kg', 20, 30, 10 FROM ids;
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount)
SELECT 'b1000000-0000-0000-0000-00000000000b', cb, ub, 'open', 100 FROM ids;
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount)
SELECT 'a1000000-0000-0000-0000-00000000000a', ca, ua, 'open', 100 FROM ids;
INSERT INTO customers (company_id, name) SELECT cb, 'Cliente B' FROM ids;
INSERT INTO categories (company_id, name) SELECT cb, 'Cat B' FROM ids;
INSERT INTO suppliers (company_id, name) SELECT cb, 'Forn B' FROM ids;
INSERT INTO financial_accounts (company_id, type, description, amount, due_date) SELECT cb, 'payable', 'Conta B', 10, current_date FROM ids;
INSERT INTO financial_categories (company_id, name, type) SELECT cb, 'FinCat B', 'expense' FROM ids;
INSERT INTO stock_movements (company_id, product_id, type, quantity, balance_after)
SELECT cb, 'b0000000-0000-0000-0000-00000000000b', 'in', 1, 50 FROM ids;
INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after)
SELECT 'b1000000-0000-0000-0000-00000000000b', cb, ub, 'deposit', 1, 101 FROM ids;
INSERT INTO sales (id, company_id, sale_number, subtotal, total) SELECT 'b2000000-0000-0000-0000-00000000000b', cb, 1, 10, 10 FROM ids;
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total, cost_price)
VALUES ('b2000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 1, 10, 10, 5);
INSERT INTO payments (sale_id, method, amount) VALUES ('b2000000-0000-0000-0000-00000000000b', 'pix', 10);
INSERT INTO audit_logs (company_id, action, entity_type) SELECT cb, 'x', 'y' FROM ids;

-- ---------- Como usuário A ----------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','audit_logs','categories','products','stock_movements','customers',
    'suppliers','sales','sale_items','payments','cash_registers','cash_movements','financial_accounts',
    'financial_categories','company_subscriptions'] LOOP
    IF t IN ('sale_items','payments') THEN
      EXECUTE format('SELECT pg_temp.ok((SELECT count(*) FROM %I x JOIN sales s ON s.id = x.sale_id WHERE s.company_id = (SELECT cb FROM ids)) = 0, %L)', t, 'A não lê ' || t || ' de B');
      EXECUTE format('SELECT pg_temp.ok((SELECT count(*) FROM %I WHERE sale_id = %L) = 0, %L)', t, 'b2000000-0000-0000-0000-00000000000b', 'A não lê ' || t || ' de B pelo id da venda');
    ELSIF t = 'companies' THEN
      PERFORM pg_temp.ok((SELECT count(*) FROM companies WHERE id = (SELECT cb FROM ids)) = 0, 'A não lê companies de B');
    ELSE
      EXECUTE format('SELECT pg_temp.ok((SELECT count(*) FROM %I WHERE company_id = (SELECT cb FROM ids)) = 0, %L)', t, 'A não lê ' || t || ' de B');
    END IF;
  END LOOP;
END $$;

SELECT pg_temp.ok((SELECT count(*) FROM companies) = 1, 'A vê só a própria empresa');
SELECT pg_temp.ok((SELECT count(*) FROM products) = 1, 'A vê só os próprios produtos');

-- Escrita com company_id de B (spoof) recusada em todas as tabelas com escrita direta
DO $$
DECLARE cb uuid := (SELECT cb FROM ids);
BEGIN
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO products (company_id, sku, name) VALUES (%L,'S','spoof')$q$, cb)), 'INSERT products com company_id de B recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO categories (company_id, name) VALUES (%L,'spoof')$q$, cb)), 'INSERT categories spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO customers (company_id, name) VALUES (%L,'spoof')$q$, cb)), 'INSERT customers spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO suppliers (company_id, name) VALUES (%L,'spoof')$q$, cb)), 'INSERT suppliers spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO financial_accounts (company_id,type,description,amount,due_date) VALUES (%L,'payable','s',1,current_date)$q$, cb)), 'INSERT financial_accounts spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO financial_categories (company_id,name,type) VALUES (%L,'s','expense')$q$, cb)), 'INSERT financial_categories spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO stock_movements (company_id,product_id,type,quantity,balance_after) VALUES (%L,'b0000000-0000-0000-0000-00000000000b','in',1,1)$q$, cb)), 'INSERT stock_movements spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO cash_registers (company_id,user_id) VALUES (%L,%L)$q$, cb, (SELECT ub FROM ids))), 'INSERT cash_registers spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO cash_movements (cash_register_id,company_id,user_id,type,amount,balance_after) VALUES ('b1000000-0000-0000-0000-00000000000b',%L,%L,'deposit',1,1)$q$, cb, (SELECT ua FROM ids))), 'INSERT cash_movements spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO cash_movements (cash_register_id,company_id,user_id,type,amount,balance_after) VALUES ('b1000000-0000-0000-0000-00000000000b',%L,%L,'deposit',1,1)$q$, (SELECT ca FROM ids), (SELECT ua FROM ids))), 'INSERT cash_movements no caixa de B com company_id de A recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO audit_logs (company_id,action,entity_type) VALUES (%L,'x','y')$q$, cb)), 'INSERT audit_logs spoof recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO users (company_id,email,full_name,role) VALUES (%L,'x@x','Intruso','owner')$q$, cb)), 'INSERT users em B recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO companies (name,cnpj) VALUES ('Nova','44.444.444/0001-44')$q$)), 'INSERT companies direto recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO sales (company_id,sale_number,subtotal,total) VALUES (%L,99,1,1)$q$, (SELECT ca FROM ids))), 'INSERT sales direto recusado (só via RPC)');
  PERFORM pg_temp.ok(pg_temp.denied($q$INSERT INTO sale_items (sale_id,product_id,quantity,unit_price,total,cost_price) VALUES ('b2000000-0000-0000-0000-00000000000b','b0000000-0000-0000-0000-00000000000b',1,1,1,1)$q$), 'INSERT sale_items direto recusado');
  PERFORM pg_temp.ok(pg_temp.denied($q$INSERT INTO payments (sale_id,method,amount) VALUES ('b2000000-0000-0000-0000-00000000000b','pix',1)$q$), 'INSERT payments direto recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$INSERT INTO company_subscriptions (company_id,plan,trial_end_date,status) VALUES (%L,'starter',now()+interval '1 year','active')$q$, (SELECT ca FROM ids))), 'INSERT company_subscriptions pelo navegador recusado');
  PERFORM pg_temp.ok(pg_temp.denied($q$UPDATE company_subscriptions SET status='active', trial_end_date = now() + interval '10 years'$q$), 'UPDATE da própria assinatura recusado (sem autoextensão)');

  -- UPDATE / DELETE em dados de B não afetam linhas
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE products SET name='hack' WHERE company_id=%L$q$, cb)), 'UPDATE products de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$DELETE FROM products WHERE company_id=%L$q$, cb)), 'DELETE products de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE customers SET name='hack' WHERE company_id=%L$q$, cb)), 'UPDATE customers de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE cash_registers SET total_sales=0 WHERE company_id=%L$q$, cb)), 'UPDATE cash_registers de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE financial_accounts SET amount=0 WHERE company_id=%L$q$, cb)), 'UPDATE financial_accounts de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE companies SET name='hack' WHERE id=%L$q$, cb)), 'UPDATE companies de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE users SET full_name='hack' WHERE company_id=%L$q$, cb)), 'UPDATE users de B sem efeito');
  PERFORM pg_temp.ok(pg_temp.denied($q$UPDATE sales SET total=0$q$), 'UPDATE sales direto recusado');
  PERFORM pg_temp.ok(pg_temp.denied($q$DELETE FROM audit_logs$q$), 'DELETE audit_logs recusado');
  -- Mover linha própria para B
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE products SET company_id=%L WHERE sku='A-1'$q$, cb)), 'UPDATE products movendo linha para B recusado');
  PERFORM pg_temp.ok(pg_temp.denied(format($q$UPDATE users SET company_id=%L WHERE auth_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, cb)), 'usuário não troca o próprio vínculo para B');
  PERFORM pg_temp.ok(pg_temp.denied($q$UPDATE companies SET status='active', plan='enterprise'$q$), 'dono não altera status/plano da empresa');
  PERFORM pg_temp.ok(pg_temp.denied($q$SELECT * FROM platform_feature_flags$q$), 'flags da plataforma não acessíveis diretamente');
END $$;

-- Escrita legítima na própria empresa continua funcionando (sem regressão)
INSERT INTO categories (company_id, name) SELECT ca, 'Mercearia' FROM ids;
INSERT INTO customers (company_id, name) SELECT ca, 'Cliente A' FROM ids;
UPDATE products SET name = 'Arroz 5kg tipo 1' WHERE sku = 'A-1';
SELECT pg_temp.ok((SELECT name FROM products WHERE sku = 'A-1') = 'Arroz 5kg tipo 1', 'A edita os próprios produtos');

-- Direitos calculados no servidor
SELECT pg_temp.ok((get_company_entitlements()->>'can_operate')::boolean, 'A liberada pela equipe pode operar');
SELECT pg_temp.ok(NOT (get_company_entitlements()->>'fiscal_enabled')::boolean, 'fiscal desligado no servidor');
SELECT pg_temp.ok(NOT (get_company_entitlements()->>'auto_trial')::boolean, 'sem teste automático no servidor');

-- ---------- RPC de venda ----------
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":2,"unitPrice":30,"discount":0}]',
  p_payments => '[{"method":"cash","amount":60,"installments":1}]',
  p_cash_register_id => 'a1000000-0000-0000-0000-00000000000a',
  p_idempotency_key => 'dddddddd-0000-0000-0000-000000000001'))->>'success' = 'true', 'venda sem p_company_id usa empresa do token');
SELECT pg_temp.ok((SELECT company_id FROM sales WHERE idempotency_key = 'dddddddd-0000-0000-0000-000000000001') = (SELECT ca FROM ids), 'venda gravada na empresa de A');
SELECT pg_temp.ok((SELECT operator_id FROM sales WHERE idempotency_key = 'dddddddd-0000-0000-0000-000000000001') = (SELECT ua FROM ids), 'operador derivado do token');
SELECT pg_temp.ok((SELECT stock_quantity FROM products WHERE sku = 'A-1') = 8, 'estoque baixado');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":2,"unitPrice":30}]',
  p_payments => '[{"method":"cash","amount":60}]',
  p_cash_register_id => 'a1000000-0000-0000-0000-00000000000a',
  p_idempotency_key => 'dddddddd-0000-0000-0000-000000000001'))->>'message' LIKE '%idempotent%', 'mesma chave não duplica a venda');
SELECT pg_temp.ok((SELECT stock_quantity FROM products WHERE sku = 'A-1') = 8, 'repetição idempotente não baixa estoque de novo');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":1,"unitPrice":30}]',
  p_payments => '[{"method":"pix","amount":30}]',
  p_company_id => (SELECT cb FROM ids)))->>'success' = 'false', 'p_company_id de B (spoof) recusado');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":1,"unitPrice":30}]',
  p_payments => '[{"method":"pix","amount":30}]',
  p_operator_id => (SELECT ub FROM ids)))->>'success' = 'false', 'p_operator_id de outro usuário recusado');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"b0000000-0000-0000-0000-00000000000b","quantity":1,"unitPrice":10}]',
  p_payments => '[{"method":"pix","amount":10}]'))->>'success' = 'false', 'vender produto de B recusado');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":1,"unitPrice":30}]',
  p_payments => '[{"method":"cash","amount":30}]',
  p_cash_register_id => 'b1000000-0000-0000-0000-00000000000b'))->>'success' = 'false', 'usar caixa de B recusado');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":999,"unitPrice":30}]',
  p_payments => '[{"method":"pix","amount":29970}]'))->>'success' = 'false', 'estoque insuficiente recusado');
SELECT pg_temp.ok((cancel_sale_with_reversal('b2000000-0000-0000-0000-00000000000b', 'x'))->>'success' = 'false', 'cancelar venda de B recusado');
SELECT pg_temp.ok((cancel_sale_with_reversal((SELECT id FROM sales WHERE idempotency_key = 'dddddddd-0000-0000-0000-000000000001'), 'teste'))->>'success' = 'true', 'cancelar venda própria funciona');
SELECT pg_temp.ok((SELECT stock_quantity FROM products WHERE sku = 'A-1') = 10, 'cancelamento devolve estoque');

-- ---------- Como B (pendente de liberação) ----------
SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-000000000001', true);
SELECT pg_temp.ok(NOT (get_company_entitlements()->>'can_operate')::boolean, 'B pendente não pode operar');
SELECT pg_temp.ok((create_atomic_sale(
  p_items => '[{"productId":"b0000000-0000-0000-0000-00000000000b","quantity":1,"unitPrice":10}]',
  p_payments => '[{"method":"pix","amount":10}]'))->>'error' LIKE '%Assinatura%', 'venda bloqueada no servidor sem liberação');
SELECT pg_temp.ok((SELECT count(*) FROM products WHERE company_id = (SELECT ca FROM ids)) = 0, 'B não lê produtos de A');
SELECT pg_temp.ok((SELECT count(*) FROM sales WHERE company_id = (SELECT ca FROM ids)) = 0, 'B não lê vendas de A');

-- ---------- Sem empresa / anônimo ----------
SELECT set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000001', true);
SELECT pg_temp.ok((SELECT count(*) FROM products) = 0 AND (SELECT count(*) FROM companies) = 0, 'usuário sem empresa não lê nada');
SELECT pg_temp.ok((create_atomic_sale(p_items => '[{"productId":"a0000000-0000-0000-0000-00000000000a","quantity":1,"unitPrice":30}]',
  p_payments => '[{"method":"pix","amount":30}]'))->>'success' = 'false', 'usuário sem empresa não vende');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.denied('SELECT * FROM products'), 'anônimo não lê products');
  PERFORM pg_temp.ok(pg_temp.denied('SELECT create_atomic_sale(''[]''::jsonb, ''[]''::jsonb)'), 'anônimo não executa create_atomic_sale');
  PERFORM pg_temp.ok(pg_temp.denied('SELECT bootstrap_my_company(''a'',''b'',''c'')'), 'anônimo não executa bootstrap');
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', true);
DO $$ BEGIN
  PERFORM pg_temp.ok(pg_temp.denied($q$SELECT approve_company_evaluation((SELECT cb FROM ids), 90)$q$), 'usuário não libera avaliação (só service_role)');
END $$;
RESET ROLE;

SELECT count(*) AS total, count(*) FILTER (WHERE ok) AS passou FROM _t;
ROLLBACK;
