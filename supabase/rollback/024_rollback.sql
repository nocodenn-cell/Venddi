-- Rollback da migration 024 (índice idx_sales_company_sale_date).
-- Seguro: só remove índice. Sem o índice o painel continua correto, apenas mais lento no pior caso.
-- DROP INDEX CONCURRENTLY não roda dentro de transação: executar este arquivo com psql diretamente
-- (não dentro de uma migration), por exemplo:
--   psql -v ON_ERROR_STOP=1 -f supabase/rollback/024_rollback.sql
DROP INDEX CONCURRENTLY IF EXISTS idx_sales_company_sale_date;
