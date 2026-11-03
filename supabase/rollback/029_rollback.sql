-- Rollback da migration 029 (caixa transacional).
-- Remove as RPCs de caixa, o log de operações, a trava de status e o índice de caixa aberto.
-- Venda e estorno voltam ao corpo da 028: depois deste rollback, reaplicar
--   supabase/migrations/028_ordem_travas_produtos.sql
-- (usa CREATE OR REPLACE e restaura as funções sem a trava do caixa).
-- ATENÇÃO: apagar cash_operation_log e as colunas closed_by/closing_difference perde a trilha de
-- auditoria e a diferença gravada nos fechamentos feitos pelas RPCs. Faça backup antes em produção.
-- Ordem: trigger antes da função; log antes da função de imutabilidade.

BEGIN;

DROP TRIGGER IF EXISTS cash_registers_protege_estado ON cash_registers;
DROP FUNCTION IF EXISTS proteger_estado_caixa();

DROP TRIGGER IF EXISTS cash_operation_log_nao_altera ON cash_operation_log;
DROP FUNCTION IF EXISTS cash_operation_log_imutavel();
DROP POLICY IF EXISTS "Caixa ve log de operacoes" ON cash_operation_log;
DROP TABLE IF EXISTS cash_operation_log;

DROP FUNCTION IF EXISTS fechar_caixa(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS registrar_movimento_caixa(UUID, TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS abrir_caixa(UUID, NUMERIC, TEXT, TEXT);

DROP INDEX IF EXISTS uq_cash_registers_operador_aberto;

ALTER TABLE cash_registers
  DROP COLUMN IF EXISTS closing_difference,
  DROP COLUMN IF EXISTS closed_by;

COMMIT;
