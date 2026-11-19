-- Rollback da migration 020 (trigger de saldo não negativo).
-- ATENÇÃO: remove a proteção contra oversell. Só usar se a trigger causar falha inesperada
-- e houver correção em andamento. Enquanto ela estiver removida, vendas concorrentes podem
-- deixar saldo negativo (reproduzido: saldo 9, duas vendas de 5 -> -1).
DROP TRIGGER IF EXISTS products_stock_nao_negativo ON products;
DROP FUNCTION IF EXISTS garantir_saldo_nao_negativo();
