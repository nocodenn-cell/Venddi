-- Venddi - Migration 024
-- Índice composto para o painel: vendas de uma empresa por data.
--
-- metricas_dashboard filtra sales por company_id e sale_date (período) e pega as 5
-- mais recentes por sale_date. Sem este índice, no pior caso multiempresa (loja com
-- histórico antigo ao lado de outra com muitas vendas recentes), o banco varre as vendas
-- recentes de todas as empresas até achar 5 da loja: medido em 130 ms, contra 0,13 ms com o índice.
--
-- Como aplicar com segurança em um banco com volume (ver docs/PAINEL_METRICAS.md):
--   CREATE INDEX CONCURRENTLY não roda dentro de transação, então NÃO cabe nesta migration.
--   Procedimento: 1) criar o índice fora da migration, com
--        CREATE INDEX CONCURRENTLY idx_sales_company_sale_date ON sales (company_id, sale_date DESC);
--      2) confirmar que está válido (indisvalid = true);
--      3) aplicar esta migration, que vira no-op (IF NOT EXISTS) e não duplica o índice.
--   Se um CREATE INDEX CONCURRENTLY falhar, o índice fica inválido; esta migration recusa
--   o caso, para não considerar o índice como existente.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = 'idx_sales_company_sale_date'
      AND NOT i.indisvalid
  ) THEN
    RAISE EXCEPTION 'idx_sales_company_sale_date existe mas está inválido (CREATE INDEX CONCURRENTLY falhou). Rode DROP INDEX CONCURRENTLY idx_sales_company_sale_date e recrie.';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_sales_company_sale_date
  ON sales (company_id, sale_date DESC);
