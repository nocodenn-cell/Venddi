BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES
 ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active'),
 ('22222222-2222-2222-2222-222222222222','B','22.222.222/2222-22','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
 ('11111111-1111-1111-1111-111111111111','starter','active',15),
 ('22222222-2222-2222-2222-222222222222','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active, commission_percent) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','owner@a.com','Owner A','owner',true,0),
 ('dddddddd-dddd-dddd-dddd-dddddddddddd','11111111-1111-1111-1111-111111111111','d0000000-0000-4000-8000-00000000000d','admin@a.com','Admin A','admin',true,0),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','caixa@a.com','Caixa A','cashier',true,10),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222','b0000000-0000-4000-8000-00000000000b','owner@b.com','Owner B','owner',true,0);
-- Venda concluída do caixa A (para comissão e para os testes de update)
INSERT INTO sales (id, company_id, sale_number, operator_id, subtotal, discount, total, status, sale_date)
VALUES ('5a000000-0000-4000-8000-0000000000a1','11111111-1111-1111-1111-111111111111',1,'cccccccc-cccc-cccc-cccc-cccccccccccc',100,0,100,'completed',now());
-- Registro de auditoria existente
INSERT INTO audit_logs (id, company_id, user_id, action, entity_type, entity_id, new_values)
VALUES ('a0a00000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','sale.cancel','sale','5a000000-0000-4000-8000-0000000000a1','{}');

DO $$ DECLARE n int; r jsonb; s text; BEGIN
  -- 1) Owner A não grava venda na empresa B
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  BEGIN
    INSERT INTO sales (company_id, sale_number, operator_id, subtotal, discount, total, status)
    VALUES ('22222222-2222-2222-2222-222222222222', 9, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 10, 0, 10, 'completed');
    RAISE EXCEPTION 'FALHOU: venda gravada em outra empresa';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  -- 2) Trial expirado: owner A não grava venda
  UPDATE company_subscriptions SET trial_end_date = now() - interval '1 day', status = 'trial'
  WHERE company_id = '11111111-1111-1111-1111-111111111111';
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  BEGIN
    INSERT INTO sales (company_id, sale_number, operator_id, subtotal, discount, total, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 8, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 10, 0, 10, 'completed');
    RAISE EXCEPTION 'FALHOU: venda gravada com trial expirado';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  UPDATE company_subscriptions SET trial_end_date = now() + interval '10 days', status = 'active'
  WHERE company_id = '11111111-1111-1111-1111-111111111111';

  -- 3) Admin não desativa o owner
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-00000000000d',true);
  BEGIN
    UPDATE users SET is_active = false WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'FALHOU: admin desativou o owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SELECT is_active::text INTO s FROM users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF s <> 'true' THEN RAISE EXCEPTION 'FALHOU: owner ficou inativo'; END IF;

  -- 4) Caixa não cancela venda por UPDATE direto
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    UPDATE sales SET status = 'cancelled' WHERE id = '5a000000-0000-4000-8000-0000000000a1';
    RAISE EXCEPTION 'FALHOU: cancelamento direto aceito';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SELECT status INTO s FROM sales WHERE id = '5a000000-0000-4000-8000-0000000000a1';
  IF s <> 'completed' THEN RAISE EXCEPTION 'FALHOU: status mudou sem o cancelamento oficial (%)', s; END IF;

  -- 5) Auditoria: usuário não altera nem apaga registros
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  UPDATE audit_logs SET action = 'alterado' WHERE id = 'a0a00000-0000-4000-8000-000000000001';
  DELETE FROM audit_logs WHERE id = 'a0a00000-0000-4000-8000-000000000001';
  RESET ROLE;
  SELECT count(*) INTO n FROM audit_logs WHERE id = 'a0a00000-0000-4000-8000-000000000001' AND action = 'sale.cancel';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: registro de auditoria alterado ou apagado'; END IF;

  -- 6) Cadastro: o plano enviado pelo cliente é ignorado
  INSERT INTO auth.users (id, email) VALUES ('e0000000-0000-4000-8000-00000000000e','novo@loja.com');
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-00000000000e',true);
  r := register_tenant('Loja Enterprise', '33.333.333/3333-33', 'Dono', 'enterprise');
  RESET ROLE;
  IF r->'company'->>'plan' <> 'starter' THEN RAISE EXCEPTION 'FALHOU: plano do cliente aceito (%)', r->'company'->>'plan'; END IF;

  -- 7) Comissão: funcionário desativado mantém as vendas do período
  UPDATE users SET is_active = false WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  SELECT sales_count INTO n FROM relatorio_comissoes('2000-01-01'::timestamptz, '2100-01-01'::timestamptz) WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  RESET ROLE;
  IF n IS NULL OR n <> 1 THEN RAISE EXCEPTION 'FALHOU: funcionário inativo sumiu do relatório de comissão (%)', n; END IF;
END $$;
SELECT 'SECURITY FOLLOWUPS OK' AS r;
ROLLBACK;
