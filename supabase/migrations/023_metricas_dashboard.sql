-- Venddi - Migration 023
-- Métricas do dashboard calculadas no banco (uma chamada, sem trazer linhas ao navegador).
--
-- - SECURITY INVOKER: roda com o usuário logado, então o RLS das tabelas vale.
-- - Filtra explicitamente pela empresa do usuário (get_user_company_id()).
-- - Os limites de dia vêm do cliente (fuso local do comerciante).
--
-- Regras financeiras (mantidas em linha com a RPC de venda e os movimentos de caixa):
-- - Vendas: só status 'completed' entram nos totais e contagens.
-- - Saldo do caixa aberto: valor inicial + venda e depósito - sangria e estorno.
--   balance_after NÃO é usado: depósitos e sangrias gravam 0 nele.

CREATE OR REPLACE FUNCTION metricas_dashboard(
  p_ontem_inicio TIMESTAMPTZ,
  p_hoje_inicio TIMESTAMPTZ,
  p_amanha_inicio TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH empresa AS (
    SELECT get_user_company_id() AS id
  ),
  vendas_periodo AS (
    SELECT s.total, s.status, s.sale_date
    FROM sales s
    JOIN empresa e ON e.id = s.company_id
    WHERE s.sale_date >= p_ontem_inicio
      AND s.sale_date < p_amanha_inicio
  ),
  caixas_abertos AS (
    SELECT r.id, r.initial_amount
    FROM cash_registers r
    JOIN empresa e ON e.id = r.company_id
    WHERE r.status = 'open'
  ),
  saldo_por_caixa AS (
    SELECT c.id,
           c.initial_amount + COALESCE(SUM(
             CASE
               WHEN m.type IN ('sale', 'deposit') THEN m.amount
               WHEN m.type IN ('withdrawal', 'refund') THEN -m.amount
               ELSE 0
             END
           ), 0) AS saldo
    FROM caixas_abertos c
    LEFT JOIN cash_movements m ON m.cash_register_id = c.id
    GROUP BY c.id, c.initial_amount
  )
  SELECT jsonb_build_object(
    'vendas_hoje', (
      SELECT jsonb_build_object('total', COALESCE(SUM(total), 0), 'count', COUNT(*))
      FROM vendas_periodo
      WHERE status = 'completed' AND sale_date >= p_hoje_inicio
    ),
    'vendas_ontem', (
      SELECT jsonb_build_object('total', COALESCE(SUM(total), 0), 'count', COUNT(*))
      FROM vendas_periodo
      WHERE status = 'completed' AND sale_date >= p_ontem_inicio AND sale_date < p_hoje_inicio
    ),
    'estoque_baixo', (
      SELECT COUNT(*)
      FROM products p
      JOIN empresa e ON e.id = p.company_id
      WHERE p.is_active AND p.stock_quantity <= p.min_stock
    ),
    'saldo_caixa', (
      SELECT COALESCE(SUM(saldo), 0) FROM saldo_por_caixa
    ),
    'recentes', (
      SELECT COALESCE(jsonb_agg(x ORDER BY x.sale_date DESC, x.id), '[]'::jsonb)
      FROM (
        SELECT s.id, s.sale_number, s.total, s.status, s.sale_date
        FROM sales s
        JOIN empresa e ON e.id = s.company_id
        ORDER BY s.sale_date DESC, s.id
        LIMIT 5
      ) x
    )
  );
$$;

REVOKE ALL ON FUNCTION metricas_dashboard(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION metricas_dashboard(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
GRANT EXECUTE ON FUNCTION metricas_dashboard(TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
