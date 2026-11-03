-- Venddi - Migration 024
-- Índice composto para o painel: vendas de uma empresa por data.
--
-- metricas_dashboard filtra sales por company_id e sale_date (período) e pega as 5
-- mais recentes por sale_date. Com idx_sales_company só, o plano lê a empresa inteira e
-- ordena em memória. Com este índice, o período e as recentes saem em ordem do índice.
--
-- Atenção: CREATE INDEX (sem CONCURRENTLY, que não roda dentro da transação da migration)
-- bloqueia escritas em sales enquanto o índice é construído. Em produção, aplicar em
-- horário de pouco movimento.

CREATE INDEX IF NOT EXISTS idx_sales_company_sale_date
  ON sales (company_id, sale_date DESC);
