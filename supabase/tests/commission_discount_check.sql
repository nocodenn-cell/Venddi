BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','o@t.com','Owner','owner',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','c@t.com','Cashier','cashier',true);
-- Desconto: vendas inseridas direto (os triggers valem igual)
INSERT INTO sales (id, company_id, sale_number, operator_id, subtotal, discount, total, status, sale_date)
VALUES ('5a000000-0000-4000-8000-000000000001','11111111-1111-1111-1111-111111111111', 1, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 100, 5, 95, 'completed', now());
INSERT INTO sales (id, company_id, sale_number, operator_id, subtotal, discount, total, status, sale_date)
VALUES ('5a000000-0000-4000-8000-000000000002','11111111-1111-1111-1111-111111111111', 2, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 200, 0, 200, 'completed', now());
DO $$ BEGIN
  BEGIN
    INSERT INTO sales (company_id, sale_number, operator_id, subtotal, discount, total, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 3, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 100, 5.01, 94.99, 'completed');
    RAISE EXCEPTION 'FALHOU: desconto acima de 5%% aceito';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000001','credit_card',95,1);
    RAISE EXCEPTION 'FALHOU: cartão aceito com desconto';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF; END;
  INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000001','cash',95,1);
  INSERT INTO payments (sale_id, method, amount, installments) VALUES ('5a000000-0000-4000-8000-000000000002','credit_card',200,1);
END $$;
-- Comissão
DO $$ DECLARE r jsonb; n numeric; v numeric; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    PERFORM set_commission_percent('cccccccc-cccc-cccc-cccc-cccccccccccc', 10);
    RAISE EXCEPTION 'FALHOU: cashier alterou comissão';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  r := set_commission_percent('cccccccc-cccc-cccc-cccc-cccccccccccc', 10);
  SELECT commission_value, sales_total INTO v, n FROM relatorio_comissoes('2000-01-01'::timestamptz, '2100-01-01'::timestamptz) WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  IF v IS NULL OR v <> 29.50 THEN RAISE EXCEPTION 'FALHOU: comissao esperada 29.50 (95+200 a 10%%), veio %', v; END IF;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    PERFORM relatorio_comissoes('2000-01-01'::timestamptz, '2100-01-01'::timestamptz);
    RAISE EXCEPTION 'FALHOU: cashier viu relatório de comissão';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
END $$;
SELECT 'COMMISSION DISCOUNT OK' AS r;
ROLLBACK;
