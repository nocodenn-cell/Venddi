-- Venddi - Migration 020
-- 1) Relatório de fechamento por caixa e por período.
-- 2) Cancelamento de venda com estorno de estoque e de caixa, trilha de
--    auditoria e permissão checada no banco. A versão anterior usava colunas que
--    não existem (cash_movements.operator_id, cash_registers.updated_at), engolia
--    o erro (WHEN OTHERS) e recebia o operador do cliente.

-- ============================================
-- USUÁRIO LOGADO
-- ============================================
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id FROM users u WHERE u.auth_id = auth.uid() AND u.is_active = TRUE
$$;

-- ============================================
-- SALDO ESPERADO DO CAIXA (a partir dos movimentos)
-- ============================================
-- saldo = fundo inicial + vendas em dinheiro + suprimentos - sangrias - estornos
CREATE OR REPLACE FUNCTION caixa_saldo_esperado(p_cash_register_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.initial_amount
    + COALESCE(SUM(CASE WHEN m.type IN ('sale', 'deposit') THEN m.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN m.type IN ('withdrawal', 'refund') THEN m.amount ELSE 0 END), 0)
  FROM cash_registers r
  LEFT JOIN cash_movements m ON m.cash_register_id = r.id
  WHERE r.id = p_cash_register_id
  GROUP BY r.initial_amount
$$;

-- ============================================
-- CANCELAMENTO DE VENDA
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;

DROP FUNCTION IF EXISTS cancel_sale_with_reversal(UUID, UUID, UUID, TEXT);

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

REVOKE ALL ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) TO authenticated;

-- ============================================
-- FECHAMENTO DE CAIXA
-- ============================================
-- Cálculo interno do fechamento de um caixa. Sem checagem de acesso própria:
-- quem chama (as RPCs abaixo) já validou o acesso.
CREATE OR REPLACE FUNCTION calc_fechamento_caixa(p_cash_register_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cash_register_id', r.id,
    'status', r.status,
    'opened_at', r.opened_at,
    'closed_at', r.closed_at,
    'operator_name', (SELECT u.full_name FROM users u WHERE u.id = r.user_id),
    'initial_amount', r.initial_amount,
    'sales_count', (SELECT COUNT(*) FROM sales s WHERE s.cash_register_id = r.id AND s.status = 'completed'),
    'sales_total', COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.cash_register_id = r.id AND s.status = 'completed'), 0),
    'cancelled_count', (SELECT COUNT(*) FROM sales s WHERE s.cash_register_id = r.id AND s.status = 'cancelled'),
    'cancelled_total', COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.cash_register_id = r.id AND s.status = 'cancelled'), 0),
    'payments_by_method', (
      SELECT COALESCE(jsonb_object_agg(x.method, x.total), '{}'::jsonb)
      FROM (
        SELECT p.method, SUM(p.amount) AS total
        FROM payments p
        JOIN sales s ON s.id = p.sale_id
        WHERE s.cash_register_id = r.id AND s.status = 'completed'
        GROUP BY p.method
      ) x
    ),
    'withdrawals', COALESCE((SELECT SUM(m.amount) FROM cash_movements m WHERE m.cash_register_id = r.id AND m.type = 'withdrawal'), 0),
    'deposits', COALESCE((SELECT SUM(m.amount) FROM cash_movements m WHERE m.cash_register_id = r.id AND m.type = 'deposit'), 0),
    'refunds', COALESCE((SELECT SUM(m.amount) FROM cash_movements m WHERE m.cash_register_id = r.id AND m.type = 'refund'), 0),
    'expected_cash', caixa_saldo_esperado(r.id),
    'informed_cash', r.final_amount,
    'difference', CASE WHEN r.status = 'closed' THEN r.final_amount - caixa_saldo_esperado(r.id) END,
    -- Pagamentos em dinheiro de todas as vendas batem com as vendas em dinheiro no caixa
    'cash_consistent', (
      (SELECT COALESCE(SUM(p.amount), 0) FROM payments p JOIN sales s ON s.id = p.sale_id
        WHERE s.cash_register_id = r.id AND p.method = 'cash')
      =
      (SELECT COALESCE(SUM(m.amount), 0) FROM cash_movements m
        WHERE m.cash_register_id = r.id AND m.type = 'sale')
    )
  )
  FROM cash_registers r
  WHERE r.id = p_cash_register_id
$$;

-- Fechamento de um caixa: o próprio operador do caixa, ou owner/admin/manager
CREATE OR REPLACE FUNCTION relatorio_fechamento_caixa(p_cash_register_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user UUID := get_user_id();
  v_owner UUID;
  v_result JSONB;
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_owner FROM cash_registers
  WHERE id = p_cash_register_id AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'manager') AND v_owner IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'Sem permissão para ver o fechamento deste caixa' USING ERRCODE = '42501';
  END IF;

  v_result := calc_fechamento_caixa(p_cash_register_id);
  RETURN v_result;
END;
$$;

-- Fechamentos de todos os caixas abertos no período. Só owner, admin e manager.
CREATE OR REPLACE FUNCTION relatorio_caixas_periodo(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_role user_role := get_user_role();
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Sem permissão para ver fechamentos' USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(calc_fechamento_caixa(r.id) ORDER BY r.opened_at DESC)
    FROM cash_registers r
    WHERE r.company_id = v_company
      AND r.opened_at >= p_start
      AND r.opened_at < p_end
  ), '[]'::jsonb);
END;
$$;

-- Funções internas não são chamadas diretamente pelo cliente
REVOKE ALL ON FUNCTION calc_fechamento_caixa(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION caixa_saldo_esperado(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION get_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_user_id() TO authenticated;

REVOKE ALL ON FUNCTION relatorio_fechamento_caixa(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relatorio_fechamento_caixa(UUID) TO authenticated;
REVOKE ALL ON FUNCTION relatorio_caixas_periodo(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relatorio_caixas_periodo(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
