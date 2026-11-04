BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','owner@t.com','Owner','owner',true),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','d0000000-0000-4000-8000-00000000000d','admin@t.com','Admin','admin',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','caixa@t.com','Caixa','cashier',true);
DO $$ BEGIN
  -- e-mail duplicado (sem diferenciar maiúsculas) deve falhar
  BEGIN
    INSERT INTO users (company_id, email, full_name, role) VALUES ('11111111-1111-1111-1111-111111111111','OWNER@T.COM','Dup','cashier');
    RAISE EXCEPTION 'FALHOU: e-mail duplicado aceito';
  EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
DO $$ DECLARE r text; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  -- admin não pode se promover a owner
  BEGIN
    UPDATE users SET role = 'owner' WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    RAISE EXCEPTION 'FALHOU: admin promoveu a si mesmo a owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- admin não altera papel de owner
  BEGIN
    UPDATE users SET role = 'cashier' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FALHOU: admin rebaixou o owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- admin pode mudar caixa para vendedor
  UPDATE users SET role = 'salesperson' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  SELECT role::text INTO r FROM users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  IF r <> 'salesperson' THEN RAISE EXCEPTION 'FALHOU: admin não mudou caixa para vendedor (%)', r; END IF;
  RESET ROLE;
  -- owner promove caixa a admin
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  UPDATE users SET role = 'admin' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  SELECT role::text INTO r FROM users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  IF r <> 'admin' THEN RAISE EXCEPTION 'FALHOU: owner não promoveu caixa a admin (%)', r; END IF;
  RESET ROLE;
END $$;
SELECT 'INVITE HARDENING OK' AS r;
ROLLBACK;
