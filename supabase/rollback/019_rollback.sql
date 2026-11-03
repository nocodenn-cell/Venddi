-- Rollback da migration 019 (inventário físico).
-- ATENÇÃO: APAGA todos os inventários, contagens e itens. Só usar em homologação, ou em produção
-- após exportar as tabelas (inventory_counts e inventory_count_items) e confirmar que não há
-- inventário em andamento. Os movimentos de estoque gerados por inventários concluídos
-- (stock_movements, reference_type = 'inventory_count') NÃO são apagados.
DROP FUNCTION IF EXISTS cancelar_inventario(UUID);
DROP FUNCTION IF EXISTS concluir_inventario(UUID);
DROP FUNCTION IF EXISTS registrar_contagem_item(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS iniciar_inventario(TEXT);
DROP TABLE IF EXISTS inventory_count_items;
DROP TABLE IF EXISTS inventory_counts;
