BEGIN;
INSERT INTO auth.users (id, email) VALUES ('e0000000-0000-4000-8000-00000000000e', 'novo@loja.com');
DO $$ DECLARE r jsonb; s int; t text; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-00000000000e', true);
  r := register_tenant('Loja Nova', '33.333.333/3333-33', 'Dono Novo', 'starter');
  RESET ROLE;
  IF r->'company'->>'name' <> 'Loja Nova' THEN RAISE EXCEPTION 'FALHOU: empresa'; END IF;
  IF r->'user'->>'role' <> 'owner' THEN RAISE EXCEPTION 'FALHOU: papel'; END IF;
  IF (r->'user'->>'email') <> 'novo@loja.com' THEN RAISE EXCEPTION 'FALHOU: email'; END IF;
  SELECT count(*) INTO s FROM company_subscriptions WHERE company_id = (r->'company'->>'id')::uuid AND status = 'trial' AND trial_days = 30 AND trial_end_date > now() + interval '29 days';
  IF s <> 1 THEN RAISE EXCEPTION 'FALHOU: trial nao criado'; END IF;
END $$;
DO $$ BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', 'e0000000-0000-4000-8000-00000000000e', true);
  BEGIN
    PERFORM register_tenant('Outra', '44.444.444/4444-44', 'Dono Novo', 'starter');
    RAISE EXCEPTION 'FALHOU: segundo cadastro aceito';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RESET ROLE;
END $$;
DO $$ BEGIN
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  BEGIN
    PERFORM register_tenant('Anon', '55.555.555/5555-55', 'X', 'starter');
    RAISE EXCEPTION 'FALHOU: anon cadastrou';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
END $$;
SELECT 'REGISTER OK' AS r;
ROLLBACK;
