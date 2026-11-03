-- Venddi - Migration 020
-- Guarda de saldo no banco contra baixa concorrente de estoque.
--
-- Problema: a RPC de venda (create_atomic_sale, migrations 006/008) valida o saldo
-- com um SELECT sem lock e depois faz UPDATE sem condição de saldo. Duas vendas
-- simultâneas do mesmo produto podem passar na validação e deixar o saldo negativo
-- (reproduzido: saldo 9, duas vendas de 5 -> saldo -1).
--
-- Solução mínima: CHECK (stock_quantity >= 0). No Postgres, quando o segundo UPDATE
-- encontra a linha travada pelo primeiro, ele espera o COMMIT, reavalia o SET sobre
-- a versão já baixada e viola o CHECK. A transação da venda inteira é revertida.
-- Vendas concorrentes que cabem no saldo continuam funcionando.
--
-- Pré-condição: nenhum produto com saldo negativo. A migration recusa aplicar se
-- houver, para que o saldo seja corrigido de forma explícita (não automática).

DO $$
DECLARE
  v_negative INTEGER;
BEGIN
  SELECT count(*) INTO v_negative FROM products WHERE stock_quantity < 0;
  IF v_negative > 0 THEN
    RAISE EXCEPTION '% produto(s) com saldo negativo. Corrija o saldo antes de aplicar a migration 020.', v_negative;
  END IF;
END;
$$;

ALTER TABLE products
  ADD CONSTRAINT products_stock_quantity_non_negative CHECK (stock_quantity >= 0);
