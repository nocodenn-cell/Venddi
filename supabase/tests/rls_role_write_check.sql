BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','o@t.com','Owner','owner',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','c@t.com','Cashier','cashier',true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock) VALUES ('d1000000-0000-4000-8000-000000000011','11111111-1111-1111-1111-111111111111','S1','P',1,2,1,1);
DO $$ DECLARE n int; BEGIN
  -- cashier não grava financeiro
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    INSERT INTO financial_accounts (company_id,type,description,amount,due_date) VALUES ('11111111-1111-1111-1111-111111111111','payable','x',10,now());
    RAISE EXCEPTION 'FALHOU: cashier gravou financeiro';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%row-level security%' THEN RAISE; END IF; END;
  -- cashier não apaga produto (0 linhas afetadas)
  DELETE FROM products WHERE id = 'd1000000-0000-4000-8000-000000000011';
  SELECT count(*) INTO n FROM products; IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: cashier apagou produto'; END IF;
  RESET ROLE;
  -- owner grava financeiro e apaga produto
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  INSERT INTO financial_accounts (company_id,type,description,amount,due_date) VALUES ('11111111-1111-1111-1111-111111111111','payable','ok',10,now());
  DELETE FROM products WHERE id = 'd1000000-0000-4000-8000-000000000011';
  SELECT count(*) INTO n FROM products; IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: owner não apagou produto'; END IF;
  RESET ROLE;
END $$;
SELECT 'ROLE WRITE OK' AS r;
ROLLBACK;
