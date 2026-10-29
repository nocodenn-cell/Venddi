BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','o@t.com','Owner','owner',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','c@t.com','Cashier','cashier',true);
INSERT INTO financial_accounts (company_id,type,description,amount,due_date) VALUES ('11111111-1111-1111-1111-111111111111','payable','conta',10,now());
DO $$ DECLARE n int; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  SELECT count(*) INTO n FROM financial_accounts; IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: cashier leu financeiro (%)', n; END IF;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  SELECT count(*) INTO n FROM financial_accounts; IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: owner não leu financeiro (%)', n; END IF;
  RESET ROLE;
END $$;
SELECT 'FINANCIAL READ OK' AS r;
ROLLBACK;
