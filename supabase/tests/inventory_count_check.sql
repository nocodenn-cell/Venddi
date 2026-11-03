-- Venddi - Testes de banco do inventário físico (migration 019)
-- Executar contra banco de homologação/local com migrations 001..019 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/inventory_count_check.sql
-- Tudo roda dentro de BEGIN/ROLLBACK: nenhum dado persiste.
-- Cobre: permissões por papel, isolamento multiempresa, RLS, contagem zero,
-- falta, sobra, sem divergência, produto sem movimento, venda/entrada durante
-- a contagem, conclusão idempotente, cancelamento e escrita direta bloqueada.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Loja A', '11.111.111/1111-11', 'starter', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Loja B', '22.222.222/2222-22', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('11111111-1111-1111-1111-111111111111', 'starter', 'active', 15),
  ('22222222-2222-2222-2222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-4000-8000-00000000000a', 'owner-a@t.com', 'Owner A', 'owner', true),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'd0000000-0000-4000-8000-00000000000d', 'manager-a@t.com', 'Manager A', 'manager', true),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'c0000000-0000-4000-8000-00000000000c', 'cashier-a@t.com', 'Cashier A', 'cashier', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'b0000000-0000-4000-8000-00000000000b', 'owner-b@t.com', 'Owner B', 'owner', true);

INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-1111-1111-111111111111', 'A-1', 'Produto A1', 1, 2, 10, 1, true),
  ('d1000000-0000-4000-8000-000000000002', '11111111-1111-1111-1111-111111111111', 'A-2', 'Produto A2', 1, 2, 5, 1, true),
  ('d1000000-0000-4000-8000-000000000003', '11111111-1111-1111-1111-111111111111', 'A-3', 'Inativo A3', 1, 2, 7, 1, false),
  ('e1000000-0000-4000-8000-000000000001', '22222222-2222-2222-2222-222222222222', 'B-1', 'Produto B1', 1, 2, 3, 1, true);

-- Helpers: trocam o usuário autenticado (RLS ativa) e verificam erros esperados
CREATE OR REPLACE FUNCTION pg_temp.as_user(p_user UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.as_postgres() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.expect_fail(p_user UUID, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.as_user(p_user);
  EXECUTE p_sql;
  PERFORM pg_temp.as_postgres();
  RAISE EXCEPTION 'FALHOU: deveria recusar (%)', p_msg;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.as_postgres();
  IF SQLERRM LIKE 'FALHOU%' OR SQLERRM NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU (esperado "%"): %', p_msg, SQLERRM;
  END IF;
END;
$$;

DO $$
DECLARE
  -- auth_id (auth.uid()) de cada usuário de teste
  OWNER_A CONSTANT UUID := 'a0000000-0000-4000-8000-00000000000a';
  MANAGER_A CONSTANT UUID := 'd0000000-0000-4000-8000-00000000000d';
  CASHIER_A CONSTANT UUID := 'c0000000-0000-4000-8000-00000000000c';
  OWNER_B CONSTANT UUID := 'b0000000-0000-4000-8000-00000000000b';
  P1 CONSTANT UUID := 'd1000000-0000-4000-8000-000000000001';
  P2 CONSTANT UUID := 'd1000000-0000-4000-8000-000000000002';
  P3 CONSTANT UUID := 'd1000000-0000-4000-8000-000000000003';
  COUNT_1 UUID;
  COUNT_2 UUID;
  r JSONB;
  n INTEGER;
  v_stock INTEGER;
BEGIN
  -- 1. Caixa não pode iniciar inventário
  PERFORM pg_temp.expect_fail(CASHIER_A, 'SELECT iniciar_inventario(''x'')', 'Papel sem permissão');

  -- 2. Owner inicia: só produtos ativos entram (P3 inativo fica de fora)
  PERFORM pg_temp.as_user(OWNER_A);
  r := iniciar_inventario('Inventário teste');
  PERFORM pg_temp.as_postgres();
  COUNT_1 := (r->>'count_id')::UUID;
  IF (r->>'total_items')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: total_items % (esperado 2)', r; END IF;
  IF EXISTS (SELECT 1 FROM inventory_count_items WHERE count_id = COUNT_1 AND product_id = P3) THEN
    RAISE EXCEPTION 'FALHOU: produto inativo entrou no inventário';
  END IF;

  -- 3. Só um inventário em andamento por empresa
  PERFORM pg_temp.expect_fail(OWNER_A, 'SELECT iniciar_inventario(''outro'')', 'Já existe um inventário em andamento');

  -- 4. Isolamento: owner de outra empresa não mexe no inventário de A
  PERFORM pg_temp.expect_fail(OWNER_B, format('SELECT registrar_contagem_item(%L, %L, 1)', COUNT_1, P1), 'Inventário não encontrado');

  -- 5. Contagem negativa é recusada; contagem zero é aceita
  PERFORM pg_temp.expect_fail(OWNER_A, format('SELECT registrar_contagem_item(%L, %L, -1)', COUNT_1, P1), 'zero ou maior');

  -- 6. Falta: contado 8, sistema 10 -> diferença -2
  PERFORM pg_temp.as_user(OWNER_A);
  r := registrar_contagem_item(COUNT_1, P1, 8);
  PERFORM pg_temp.as_postgres();
  IF (r->>'difference')::int <> -2 THEN RAISE EXCEPTION 'FALHOU: falta %', r; END IF;

  -- 7. Conclusão com item pendente é recusada (P2 ainda sem contagem)
  PERFORM pg_temp.expect_fail(OWNER_A, format('SELECT concluir_inventario(%L)', COUNT_1), 'sem contagem');

  -- 8. Sem divergência: contado 5 = sistema 5 (produto sem movimento)
  PERFORM pg_temp.as_user(OWNER_A);
  r := registrar_contagem_item(COUNT_1, P2, 5);
  PERFORM pg_temp.as_postgres();
  IF (r->>'difference')::int <> 0 THEN RAISE EXCEPTION 'FALHOU: sem divergência %', r; END IF;

  -- 9. Venda (P1 -3) e entrada (P2 +4) durante a contagem: não podem ser perdidas
  UPDATE products SET stock_quantity = stock_quantity - 3 WHERE id = P1;
  UPDATE products SET stock_quantity = stock_quantity + 4 WHERE id = P2;

  -- 10. Conclusão aplica só a diferença sobre o saldo atual
  PERFORM pg_temp.as_user(OWNER_A);
  r := concluir_inventario(COUNT_1);
  PERFORM pg_temp.as_postgres();
  IF (r->>'adjusted_items')::int <> 1 OR (r->>'already_completed')::boolean THEN
    RAISE EXCEPTION 'FALHOU: conclusão %', r;
  END IF;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P1;
  IF v_stock <> 5 THEN RAISE EXCEPTION 'FALHOU: P1 esperado 5 (10-3 venda -2 falta), obtido %', v_stock; END IF;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P2;
  IF v_stock <> 9 THEN RAISE EXCEPTION 'FALHOU: P2 esperado 9 (5+4 entrada), obtido %', v_stock; END IF;
  SELECT count(*) INTO n FROM stock_movements
    WHERE reference_type = 'inventory_count' AND reference_id = COUNT_1;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: movimentos do inventário = % (esperado 1)', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM stock_movements WHERE reference_id = COUNT_1 AND product_id = P1
                   AND type = 'adjustment' AND quantity = -2 AND balance_after = 5) THEN
    RAISE EXCEPTION 'FALHOU: movimento de ajuste de P1 incorreto';
  END IF;

  -- 11. Idempotência: concluir de novo não gera movimento nem altera saldo
  PERFORM pg_temp.as_user(OWNER_A);
  r := concluir_inventario(COUNT_1);
  PERFORM pg_temp.as_postgres();
  IF NOT (r->>'already_completed')::boolean THEN RAISE EXCEPTION 'FALHOU: idempotência %', r; END IF;
  SELECT count(*) INTO n FROM stock_movements WHERE reference_id = COUNT_1;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU: idempotência duplicou movimentos (%)', n; END IF;

  -- 12. Inventário concluído não pode ser cancelado nem recontado
  PERFORM pg_temp.expect_fail(OWNER_A, format('SELECT cancelar_inventario(%L)', COUNT_1), 'já concluído');
  PERFORM pg_temp.expect_fail(OWNER_A, format('SELECT registrar_contagem_item(%L, %L, 1)', COUNT_1, P1), 'não está mais em andamento');

  -- 13. Segundo inventário (após conclusão): falta total, sobra e zero
  PERFORM pg_temp.as_user(OWNER_A);
  COUNT_2 := (iniciar_inventario('Inventário 2')->>'count_id')::UUID;
  PERFORM registrar_contagem_item(COUNT_2, P1, 0);   -- contagem zero (falta de 5)
  PERFORM registrar_contagem_item(COUNT_2, P2, 12);  -- sobra de 3
  r := concluir_inventario(COUNT_2);
  PERFORM pg_temp.as_postgres();
  IF (r->>'adjusted_items')::int <> 2 THEN RAISE EXCEPTION 'FALHOU: segundo inventário %', r; END IF;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P1;
  IF v_stock <> 0 THEN RAISE EXCEPTION 'FALHOU: contagem zero deveria zerar P1, obtido %', v_stock; END IF;
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P2;
  IF v_stock <> 12 THEN RAISE EXCEPTION 'FALHOU: sobra P2 esperado 12, obtido %', v_stock; END IF;

  -- 14. Cancelamento não altera estoque e é idempotente
  PERFORM pg_temp.as_user(OWNER_A);
  r := (SELECT iniciar_inventario('Inventário 3'));
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(OWNER_A);
  PERFORM registrar_contagem_item((r->>'count_id')::UUID, P2, 0);
  PERFORM cancelar_inventario((r->>'count_id')::UUID);
  PERFORM cancelar_inventario((r->>'count_id')::UUID);
  PERFORM pg_temp.as_postgres();
  SELECT stock_quantity INTO v_stock FROM products WHERE id = P2;
  IF v_stock <> 12 THEN RAISE EXCEPTION 'FALHOU: cancelamento alterou estoque (%)', v_stock; END IF;
  IF (SELECT status FROM inventory_counts WHERE id = (r->>'count_id')::UUID) <> 'cancelled' THEN
    RAISE EXCEPTION 'FALHOU: status não cancelado';
  END IF;

  -- 15. RLS: caixa não lê inventários; manager lê os da própria empresa; owner de B não vê A
  PERFORM pg_temp.as_user(CASHIER_A);
  SELECT count(*) INTO n FROM inventory_counts;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: caixa leu inventários (%)', n; END IF;

  PERFORM pg_temp.as_user(MANAGER_A);
  SELECT count(*) INTO n FROM inventory_counts;
  IF n < 3 THEN RAISE EXCEPTION 'FALHOU: manager não leu inventários da empresa (%)', n; END IF;

  PERFORM pg_temp.as_user(OWNER_B);
  SELECT count(*) INTO n FROM inventory_counts;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: vazamento entre empresas (%)', n; END IF;
  SELECT count(*) INTO n FROM inventory_count_items;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU: vazamento de itens entre empresas (%)', n; END IF;
  PERFORM pg_temp.as_postgres();

  -- 16. Escrita direta bloqueada (somente RPC)
  PERFORM pg_temp.expect_fail(OWNER_A, format(
    'INSERT INTO inventory_counts (company_id, name) VALUES (%L, ''direto'')',
    '11111111-1111-1111-1111-111111111111'), 'permission denied');
  PERFORM pg_temp.expect_fail(OWNER_A, format(
    'UPDATE inventory_count_items SET counted_quantity = 99 WHERE count_id = %L', COUNT_2), 'permission denied');

  -- 17. Produto de outra empresa não entra na contagem da empresa A
  PERFORM pg_temp.as_user(OWNER_A);
  COUNT_1 := (iniciar_inventario('Inventário 4')->>'count_id')::UUID;
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.expect_fail(OWNER_A, format(
    'SELECT registrar_contagem_item(%L, %L, 1)', COUNT_1, 'e1000000-0000-4000-8000-000000000001'),
    'Produto não encontrado nesta empresa');
END $$;

SELECT 'INVENTORY COUNT CHECKS OK' AS r;
ROLLBACK;
