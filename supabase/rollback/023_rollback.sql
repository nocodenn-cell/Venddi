-- Rollback da migration 023 (função metricas_dashboard).
-- Seguro: só remove a função. O app atual precisa ser revertido à versão anterior ao painel de dados
-- reais, senão o painel deixa de carregar.
DROP FUNCTION IF EXISTS metricas_dashboard(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ);
