-- Venddi - Migration 020
-- Guarda de saldo no banco contra baixa concorrente de estoque.
--
-- Problema: a RPC de venda (create_atomic_sale, migrations 006/008) valida o saldo
-- com um SELECT sem lock e depois faz UPDATE sem condição de saldo. Duas vendas
-- simultâneas do mesmo produto podem passar na validação e deixar o saldo negativo
-- (reproduzido: saldo 9, duas vendas de 5 -> saldo -1).
--
-- Solução mínima: impedir saldo negativo (trigger BEFORE UPDATE, ver abaixo). No Postgres,
-- quando o segundo UPDATE encontra a linha travada pelo primeiro, ele espera o COMMIT,
-- reavalia o SET sobre a versão já baixada e a trigger recusa o saldo negativo. A transação
-- da venda inteira é revertida.
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

-- Trigger em vez de CHECK: a mesma garantia, mas com mensagem que o operador entende
-- ("Estoque insuficiente para o produto <SKU>") em vez da mensagem técnica do CHECK.
CREATE OR REPLACE FUNCTION garantir_saldo_nao_negativo()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock_quantity < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto %', NEW.sku
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_stock_nao_negativo
  BEFORE INSERT OR UPDATE OF stock_quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION garantir_saldo_nao_negativo();
