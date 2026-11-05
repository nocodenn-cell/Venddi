BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','trial',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','owner@t.com','Owner','owner',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','caixa@t.com','Caixa','cashier',true),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','d0000000-0000-4000-8000-00000000000d','admin@t.com','Admin','admin',true);
DO $$ DECLARE n int; s text; BEGIN
  -- admin não troca auth_id de outro usuário (tomada de conta do owner)
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  BEGIN
    UPDATE users SET auth_id = 'e0000000-0000-4000-8000-00000000000e' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FALHOU: admin trocou auth_id do owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  -- owner não consegue mudar o status da assinatura pelo cliente
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  UPDATE company_subscriptions SET status = 'active' WHERE company_id = '11111111-1111-1111-1111-111111111111';
  RESET ROLE;
  SELECT status INTO s FROM company_subscriptions WHERE company_id = '11111111-1111-1111-1111-111111111111';
  IF s <> 'trial' THEN RAISE EXCEPTION 'FALHOU: owner alterou status da assinatura para %', s; END IF;
  -- trial expirado: o próprio perfil continua legível
  UPDATE company_subscriptions SET trial_end_date = now() - interval '1 day' WHERE company_id = '11111111-1111-1111-1111-111111111111';
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  SELECT count(*) INTO n FROM users WHERE auth_id = 'a0000000-0000-4000-8000-00000000000a';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: perfil próprio não legível com trial expirado (%)', n; END IF;
  RESET ROLE;
END $$;
SELECT 'IDENTITY OK' AS r;
ROLLBACK;
