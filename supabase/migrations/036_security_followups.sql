-- Venddi - Migration 021
-- Correções de segurança apontadas na revisão do PR #8.
-- Redefine funções das migrations 016, 018, 019 e 020 (já aplicadas) e acrescenta regras:
--   - venda só pode ser gravada na empresa do usuário logado e com acesso ativo
--   - cancelamento só pela RPC cancel_sale_with_reversal (sem UPDATE direto de status)
--   - audit_logs: sem UPDATE nem DELETE para usuários
--   - ativar/desativar owner ou admin só pelo owner
--   - comissão inclui funcionário inativo com vendas no período
--   - register_tenant ignora o plano enviado pelo cliente

-- ============================================
-- VENDA: empresa e acesso validados no banco
-- ============================================
CREATE OR REPLACE FUNCTION guard_sale_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem sessão (service role, migrations) não há o que validar
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- get_user_company_id() já exige usuário ativo e assinatura válida
  IF NEW.company_id IS DISTINCT FROM get_user_company_id() THEN
    RAISE EXCEPTION 'Sem acesso para registrar venda nesta empresa' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sale_tenant ON sales;
CREATE TRIGGER trg_guard_sale_tenant
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION guard_sale_tenant();

-- ============================================
-- CANCELAMENTO: só pela RPC
-- ============================================
CREATE OR REPLACE FUNCTION guard_sale_cancellation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND current_setting('app.cancel_sale', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Venda só pode ser cancelada pelo cancelamento oficial' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_sale_cancellation ON sales;
CREATE TRIGGER trg_guard_sale_cancellation
  BEFORE UPDATE OF status ON sales
  FOR EACH ROW EXECUTE FUNCTION guard_sale_cancellation();

-- ============================================
-- AUDITORIA: somente leitura e inserção pelo sistema
-- ============================================
DROP POLICY IF EXISTS "Users can insert company audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can update company audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can delete company audit_logs" ON audit_logs;

-- ============================================
-- FUNÇÕES REDEFINIDAS
-- ============================================
CREATE OR REPLACE FUNCTION cancel_sale_with_reversal(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user UUID := get_user_id();
  v_sale sales%ROWTYPE;
  v_item RECORD;
  v_cash NUMERIC := 0;
  v_reg cash_registers%ROWTYPE;
  v_movement_id UUID;
BEGIN
  IF v_company IS NULL OR v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar vendas' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento (mínimo 5 caracteres)';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND company_id = v_company FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Venda já cancelada';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Só é possível cancelar vendas concluídas';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_cash
  FROM payments WHERE sale_id = p_sale_id AND method = 'cash';

  IF v_cash > 0 AND v_sale.cash_register_id IS NOT NULL THEN
    SELECT * INTO v_reg FROM cash_registers WHERE id = v_sale.cash_register_id FOR UPDATE;
    IF v_reg.status <> 'open' THEN
      RAISE EXCEPTION 'O caixa desta venda já foi fechado. O estorno em dinheiro só pode ser feito com o caixa aberto';
    END IF;
  END IF;

  -- Única via de cancelamento: libera a trigger que bloqueia UPDATE direto de status
  PERFORM set_config('app.cancel_sale', 'on', true);

  UPDATE sales
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      cancelled_by = v_user,
      updated_at = NOW()
  WHERE id = p_sale_id;

  -- Estoque: devolve as quantidades e registra o movimento
  FOR v_item IN SELECT product_id, quantity FROM sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;

    INSERT INTO stock_movements (
      company_id, product_id, user_id, type, quantity, reason,
      reference_type, reference_id, balance_after, created_at
    )
    SELECT
      v_company, v_item.product_id, v_user, 'in', v_item.quantity,
      'Cancelamento da venda #' || v_sale.sale_number,
      'sale_cancellation', p_sale_id, stock_quantity, NOW()
    FROM products
    WHERE id = v_item.product_id;
  END LOOP;

  -- Caixa: estorno em dinheiro, se houve pagamento em dinheiro com caixa aberto
  IF v_cash > 0 AND v_sale.cash_register_id IS NOT NULL THEN
    INSERT INTO cash_movements (
      cash_register_id, company_id, user_id, type, amount, description,
      reference_type, reference_id, balance_after, created_at
    ) VALUES (
      v_reg.id, v_company, v_user, 'refund', v_cash,
      'Estorno venda #' || v_sale.sale_number,
      'sale_cancellation', p_sale_id, 0, NOW()
    )
    RETURNING id INTO v_movement_id;

    UPDATE cash_movements
    SET balance_after = caixa_saldo_esperado(v_reg.id)
    WHERE id = v_movement_id;

    UPDATE cash_registers
    SET total_sales = total_sales - v_cash
    WHERE id = v_reg.id;
  END IF;

  -- Financeiro: contas a receber pendentes desta venda são canceladas
  UPDATE financial_accounts
  SET status = 'cancelled', updated_at = NOW()
  WHERE company_id = v_company
    AND reference_type = 'sale'
    AND reference_id = p_sale_id
    AND status = 'pending';

  -- Trilha de auditoria: quem cancelou, quando, por quê e quanto foi estornado em dinheiro
  INSERT INTO audit_logs (
    company_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at
  ) VALUES (
    v_company, v_user, 'sale.cancel', 'sale', p_sale_id,
    jsonb_build_object('status', v_sale.status, 'total', v_sale.total),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason, 'cash_refund', v_cash),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'sale_id', p_sale_id, 'cash_refund', v_cash);
END;
$$;

CREATE OR REPLACE FUNCTION register_tenant(
  p_company_name TEXT,
  p_cnpj TEXT,
  p_full_name TEXT,
  p_plan company_plan DEFAULT 'starter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_email TEXT;
  v_company companies%ROWTYPE;
  v_user users%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE auth_id = v_auth_id) THEN
    RAISE EXCEPTION 'Usuário já possui empresa cadastrada' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_auth_id;

  -- Plano definido pelo servidor (trial). O parâmetro do cliente é ignorado.
  INSERT INTO companies (name, cnpj, plan, status)
  VALUES (p_company_name, p_cnpj, 'starter', 'active')
  RETURNING * INTO v_company;

  INSERT INTO users (company_id, auth_id, email, full_name, role, is_active)
  VALUES (v_company.id, v_auth_id, v_email, p_full_name, 'owner', TRUE)
  RETURNING * INTO v_user;

  -- Trial de 15 dias (trigger set_trial_end_date calcula o fim)
  INSERT INTO company_subscriptions (company_id, plan, status, trial_days)
  VALUES (v_company.id, 'starter', 'trial', 15);

  RETURN jsonb_build_object(
    'company', to_jsonb(v_company),
    'user', to_jsonb(v_user)
  );
END;
$$;

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
    ROUND(COALESCE(SUM(s.total * s.commission_percent_snapshot), 0) / 100, 2)::NUMERIC
  FROM users u
  LEFT JOIN sales s
    ON s.operator_id = u.id
   AND s.company_id = v_company_id
   AND s.status = 'completed'
   AND s.sale_date >= p_start
   AND s.sale_date < p_end
  WHERE u.company_id = v_company_id
    AND (
      u.is_active = TRUE
      OR EXISTS (
        SELECT 1 FROM sales sx
        WHERE sx.operator_id = u.id
          AND sx.company_id = v_company_id
          AND sx.status = 'completed'
          AND sx.sale_date >= p_start
          AND sx.sale_date < p_end
      )
    )
  GROUP BY u.id, u.full_name, u.role, u.commission_percent
  ORDER BY u.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION guard_user_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Dados de identidade do usuário não podem ser alterados' USING ERRCODE = '42501';
  END IF;

  -- Desativar owner ou admin também é mudança de hierarquia
  IF NEW.is_active IS DISTINCT FROM OLD.is_active
     AND OLD.role IN ('owner', 'admin')
     AND get_user_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'Apenas o dono pode ativar ou desativar administradores' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_caller_role := get_user_role();
    IF v_caller_role IS DISTINCT FROM 'owner'
       AND (OLD.role IN ('owner', 'admin') OR NEW.role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Apenas o dono pode alterar papéis de administrador' USING ERRCODE = '42501';
    END IF;
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
      RAISE EXCEPTION 'Não é permitido criar outro dono' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION register_tenant(TEXT, TEXT, TEXT, company_plan) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_tenant(TEXT, TEXT, TEXT, company_plan) TO authenticated;
REVOKE ALL ON FUNCTION relatorio_comissoes(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relatorio_comissoes(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
