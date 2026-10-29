-- Venddi - Migration 018
-- 1) Comissão por funcionário (percentual sobre vendas concluídas do operador)
-- 2) Desconto no PDV: até 5% do subtotal, e só em pagamento em dinheiro.
--    Acima de 5% exige autorização do gerente (fluxo ainda não implementado:
--    por ora o banco recusa).

-- ============================================
-- COMISSÃO
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0
  CHECK (commission_percent >= 0 AND commission_percent <= 100);

-- Define o percentual de comissão de um funcionário da mesma empresa.
-- Só owner e admin.
CREATE OR REPLACE FUNCTION set_commission_percent(p_user_id UUID, p_percent NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Apenas owner e admin podem alterar comissões' USING ERRCODE = '42501';
  END IF;
  IF p_percent IS NULL OR p_percent < 0 OR p_percent > 100 THEN
    RAISE EXCEPTION 'Percentual de comissão deve estar entre 0 e 100';
  END IF;

  UPDATE users
  SET commission_percent = p_percent, updated_at = NOW()
  WHERE id = p_user_id AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado nesta empresa';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Relatório de comissão por funcionário no período (vendas concluídas).
-- Só owner, admin e manager.
CREATE OR REPLACE FUNCTION relatorio_comissoes(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role user_role,
  commission_percent NUMERIC,
  sales_count BIGINT,
  sales_total NUMERIC,
  commission_value NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Sem permissão para ver comissões' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.full_name::TEXT,
    u.role,
    u.commission_percent,
    COUNT(s.id),
    COALESCE(SUM(s.total), 0)::NUMERIC,
    ROUND(COALESCE(SUM(s.total), 0) * u.commission_percent / 100, 2)::NUMERIC
  FROM users u
  LEFT JOIN sales s
    ON s.operator_id = u.id
   AND s.company_id = v_company_id
   AND s.status = 'completed'
   AND s.sale_date >= p_start
   AND s.sale_date < p_end
  WHERE u.company_id = v_company_id
    AND u.is_active = TRUE
  GROUP BY u.id, u.full_name, u.role, u.commission_percent
  ORDER BY u.full_name;
END;
$$;

REVOKE ALL ON FUNCTION set_commission_percent(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_commission_percent(UUID, NUMERIC) TO authenticated;
REVOKE ALL ON FUNCTION relatorio_comissoes(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relatorio_comissoes(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================
-- DESCONTO NO PDV
-- ============================================
-- Desconto máximo de 5% do subtotal, sem autorização de gerente.
CREATE OR REPLACE FUNCTION check_sale_discount_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discount < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo';
  END IF;
  IF NEW.discount > ROUND(NEW.subtotal * 0.05, 2) THEN
    RAISE EXCEPTION 'Desconto acima de 5%% exige autorização do gerente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_discount_limit ON sales;
CREATE TRIGGER trg_sale_discount_limit
  BEFORE INSERT OR UPDATE OF discount, subtotal ON sales
  FOR EACH ROW EXECUTE FUNCTION check_sale_discount_limit();

-- Venda com desconto só pode ser paga em dinheiro.
CREATE OR REPLACE FUNCTION check_discount_cash_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.method <> 'cash' AND EXISTS (
    SELECT 1 FROM sales s WHERE s.id = NEW.sale_id AND s.discount > 0
  ) THEN
    RAISE EXCEPTION 'Venda com desconto só pode ser paga em dinheiro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_discount_cash_only ON payments;
CREATE TRIGGER trg_payment_discount_cash_only
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION check_discount_cash_only();
