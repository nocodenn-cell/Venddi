BEGIN;
INSERT INTO companies (id, name, cnpj, plan, status) VALUES ('11111111-1111-1111-1111-111111111111','A','11.111.111/1111-11','starter','active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','a0000000-0000-4000-8000-00000000000a','o@t.com','Owner','owner',true),
 ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111','c0000000-0000-4000-8000-00000000000c','c@t.com','Cashier','cashier',true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock) VALUES ('d1000000-0000-4000-8000-000000000011','11111111-1111-1111-1111-111111111111','S1','P',1,2,10,1);
DO $$ DECLARE r jsonb; s int; BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-00000000000c',true);
  BEGIN
    PERFORM registrar_entrada_estoque('d1000000-0000-4000-8000-000000000011', 5, 'teste');
    RAISE EXCEPTION 'FALHOU: cashier registrou entrada';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-00000000000a',true);
  r := registrar_entrada_estoque('d1000000-0000-4000-8000-000000000011', 5, 'compra NF 1');
  IF (r->>'new_balance')::int <> 15 THEN RAISE EXCEPTION 'FALHOU: saldo %', r; END IF;
  BEGIN
    PERFORM registrar_entrada_estoque('d1000000-0000-4000-8000-000000000011', 0, 'x');
    RAISE EXCEPTION 'FALHOU: quantidade zero aceita';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALHOU%' THEN RAISE; END IF;
  END;
  RESET ROLE;
  SELECT count(*) INTO s FROM stock_movements WHERE product_id = 'd1000000-0000-4000-8000-000000000011' AND type = 'in' AND quantity = 5 AND balance_after = 15;
  IF s <> 1 THEN RAISE EXCEPTION 'FALHOU: movimento nao gravado (%)', s; END IF;
  SELECT stock_quantity INTO s FROM products WHERE id = 'd1000000-0000-4000-8000-000000000011';
  IF s <> 15 THEN RAISE EXCEPTION 'FALHOU: estoque final %', s; END IF;
END $$;
SELECT 'STOCK ENTRY OK' AS r;
ROLLBACK;
