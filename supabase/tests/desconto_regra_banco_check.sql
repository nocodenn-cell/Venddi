-- Teste da migration 030: regra de desconto no banco.
-- Rodar em banco de TESTE (nunca em produção). Precisa de um schema mínimo de sales/payments
-- com as colunas usadas abaixo (id, subtotal, discount, total; sale_id, method, amount) e da
-- migration 030 aplicada. Executado em 2026-11-05 em Postgres 16 descartável (Docker local):
--   docker exec -i <container> psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/desconto_regra_banco_check.sql
-- Cada caso roda em sub-transação (DO block) e deve falhar ou passar conforme o esperado.

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _resultado (caso TEXT, esperado TEXT, obtido TEXT);

-- Caso 1: desconto de 5% exato em venda, deve passar
DO $$
DECLARE sid UUID := gen_random_uuid();
BEGIN
  INSERT INTO sales (id, subtotal, discount, total) VALUES (sid, 100, 5, 95);
  INSERT INTO _resultado VALUES ('desconto 5% exato', 'ok', 'ok');
END $$;

-- Caso 2: desconto acima de 5% deve falhar
DO $$
BEGIN
  BEGIN
    INSERT INTO sales (id, subtotal, discount, total) VALUES (gen_random_uuid(), 100, 5.01, 94.99);
    INSERT INTO _resultado VALUES ('desconto 5,01%', 'erro', 'ok');
  EXCEPTION WHEN check_violation OR sqlstate '22023' THEN
    INSERT INTO _resultado VALUES ('desconto 5,01%', 'erro', 'erro');
  END;
END $$;

-- Caso 3: desconto negativo deve falhar
DO $$
BEGIN
  BEGIN
    INSERT INTO sales (id, subtotal, discount, total) VALUES (gen_random_uuid(), 100, -1, 101);
    INSERT INTO _resultado VALUES ('desconto negativo', 'erro', 'ok');
  EXCEPTION WHEN sqlstate '22023' THEN
    INSERT INTO _resultado VALUES ('desconto negativo', 'erro', 'erro');
  END;
END $$;

-- Caso 4: venda com desconto paga em dinheiro deve passar
DO $$
DECLARE sid UUID := gen_random_uuid();
BEGIN
  INSERT INTO sales (id, subtotal, discount, total) VALUES (sid, 100, 3, 97);
  INSERT INTO payments (sale_id, method, amount) VALUES (sid, 'cash', 97);
  INSERT INTO _resultado VALUES ('desconto + dinheiro', 'ok', 'ok');
END $$;

-- Caso 5: venda com desconto paga no cartão deve falhar
DO $$
DECLARE sid UUID := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO sales (id, subtotal, discount, total) VALUES (sid, 100, 3, 97);
    INSERT INTO payments (sale_id, method, amount) VALUES (sid, 'credit_card', 97);
    INSERT INTO _resultado VALUES ('desconto + cartão', 'erro', 'ok');
  EXCEPTION WHEN sqlstate '22023' THEN
    INSERT INTO _resultado VALUES ('desconto + cartão', 'erro', 'erro');
  END;
END $$;

-- Caso 6: venda sem desconto paga no PIX deve passar
DO $$
DECLARE sid UUID := gen_random_uuid();
BEGIN
  INSERT INTO sales (id, subtotal, discount, total) VALUES (sid, 100, 0, 100);
  INSERT INTO payments (sale_id, method, amount) VALUES (sid, 'pix', 100);
  INSERT INTO _resultado VALUES ('sem desconto + pix', 'ok', 'ok');
END $$;

SELECT caso, esperado, obtido, CASE WHEN esperado = obtido THEN 'PASS' ELSE 'FAIL' END AS resultado
FROM _resultado ORDER BY caso;

ROLLBACK;
