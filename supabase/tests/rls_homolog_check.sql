-- Verificação RLS — roda inteira numa transação e DESFAZ tudo no final (ROLLBACK).
-- Se um teste falhar, o editor mostra "FALHOU: <nome>". Se terminar sem erro, todos passaram.
BEGIN;

-- ---------- Dados (como postgres) ----------
INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Company A', '11.111.111/1111-11', 'starter', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Company B', '22.222.222/2222-22', 'starter', 'active');

INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15), ('22222222-2222-2222-2222-222222222222','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-00000000000a', 'user-a@test.com', 'User A', 'owner', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-4000-8000-00000000000b', 'user-b@test.com', 'User B', 'owner', true);

INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('d1000000-0000-4000-8000-000000000011', '11111111-1111-1111-1111-111111111111', 'SKU-A1', 'Product A1', 10, 20, 100, 10, true),
  ('d1000000-0000-4000-8000-000000000022', '11111111-1111-1111-1111-111111111111', 'SKU-A2', 'Product A2', 15, 30, 50, 5, true),
  ('d2000000-0000-4000-8000-000000000011', '22222222-2222-2222-2222-222222222222', 'SKU-B1', 'Product B1', 12, 25, 75, 8, true);

-- ---------- T1: A vê só os próprios produtos ----------
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  SELECT count(*) INTO n FROM products;
  IF n <> 2 THEN RAISE EXCEPTION 'FALHOU: T1 esperado 2 produtos, veio %', n; END IF;
  SELECT count(*) INTO n FROM products WHERE company_id = '22222222-2222-2222-2222-222222222222';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: T1 A enxergou produtos da empresa B (%)', n; END IF;
  RESET ROLE;
END $$;

-- ---------- T2: A não enxerga produto da B pelo id ----------
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  SELECT count(*) INTO n FROM products WHERE id = 'd2000000-0000-4000-8000-000000000011';
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: T2 A leu produto da B pelo id'; END IF;
  RESET ROLE;
END $$;

-- ---------- T3: A não consegue criar produto na empresa B ----------
DO $$ BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  BEGIN
    INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock)
    VALUES ('22222222-2222-2222-2222-222222222222', 'SKU-FAKE', 'Fake', 1, 2, 1, 1);
    RAISE EXCEPTION 'FALHOU: T3 A criou produto na empresa B';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%identidade%' THEN RAISE; END IF;
  END;
  RESET ROLE;
END $$;

-- ---------- T4: A vê só a própria empresa ----------
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  SELECT count(*) INTO n FROM companies;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: T4 esperado 1 empresa, veio %', n; END IF;
  RESET ROLE;
END $$;

-- ---------- T5: owner B promove funcionário da própria empresa a admin ----------
DO $$ DECLARE r text; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'b0000000-0000-4000-8000-00000000000b', true);
  INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active)
  VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'c0000000-0000-4000-8000-00000000000c', 'user-c@test.com', 'User C', 'cashier', true);
  UPDATE users SET role = 'admin' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  SELECT role INTO r FROM users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  IF r <> 'admin' THEN RAISE EXCEPTION 'FALHOU: T5 esperado admin, veio %', r; END IF;
  RESET ROLE;
END $$;

-- ---------- T6: A não consegue mover o próprio usuário para a empresa B ----------
DO $$ DECLARE c uuid; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  BEGIN
    UPDATE users SET company_id = '22222222-2222-2222-2222-222222222222' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FALHOU: T6 A moveu o próprio usuário para a empresa B';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%row-level security%' AND SQLERRM NOT LIKE '%identidade%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  SELECT company_id INTO c FROM users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF c <> '11111111-1111-1111-1111-111111111111' THEN RAISE EXCEPTION 'FALHOU: T6 company_id mudou'; END IF;
END $$;

-- ---------- T7: anon não lê produtos ----------
DO $$ DECLARE n int; BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM products;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: T7 anon leu % produtos', n; END IF;
  RESET ROLE;
END $$;

-- ---------- T8: create_atomic_sale recusa operador de outra empresa ----------
DO $$ DECLARE res jsonb; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-4000-8000-00000000000a', true);
  res := create_atomic_sale('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, '[]'::jsonb, '[]'::jsonb, NULL);
  IF (res->>'success')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALHOU: T8 venda aceita com operador de outra empresa: %', res; END IF;
  RESET ROLE;
END $$;

-- ---------- Fim: desfaz tudo, nada fica gravado ----------
SELECT 'TODOS OS TESTES PASSARAM' AS resultado;
ROLLBACK;
