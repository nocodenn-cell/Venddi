-- Venddi - Migration 025
-- View de produtos com estoque baixo: ativos com saldo no mínimo ou abaixo.
--
-- Substitui o cálculo no cliente (que lia todos os produtos e mandava a lista de ids na URL).
-- Com security_invoker, a view roda com o usuário logado: o RLS de products vale.
-- A regra é a mesma do painel (metricas_dashboard, migration 023).

CREATE OR REPLACE VIEW produtos_estoque_baixo
  WITH (security_invoker = true)
AS
SELECT *
FROM products
WHERE is_active
  AND stock_quantity <= min_stock;

REVOKE ALL ON produtos_estoque_baixo FROM anon;
GRANT SELECT ON produtos_estoque_baixo TO authenticated;
