-- Venddi - Migration 022
-- Corrige cancel_sale_with_reversal (estorno de venda): o INSERT em cash_movements
-- preenchia só operator_id, mas cash_movements.user_id é NOT NULL. Resultado: todo
-- estorno de venda com movimento de caixa falhava com
--   "null value in column user_id of relation cash_movements violates not-null constraint".
-- Reproduzido no stack Supabase local (Postgres 17) com venda real.
--
-- Correção: preencher user_id com o operador do estorno. Resto da função idêntico à 008.
CREATE OR REPLACE FUNCTION cancel_sale_with_reversal(
  p_sale_id UUID,
  p_company_id UUID,
  p_operator_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_payment RECORD;
  v_cash_amount DECIMAL(10,2) := 0;
  v_operator_company UUID;
BEGIN
  -- SECURITY: Validate operator belongs to company
  SELECT company_id INTO v_operator_company
  FROM users
  WHERE id = p_operator_id;
  
  IF v_operator_company IS NULL OR v_operator_company != p_company_id THEN
    RAISE EXCEPTION 'Operator does not belong to company';
  END IF;
  
  -- Get sale details
  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
    AND company_id = p_company_id;
  
  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Sale already cancelled';
  END IF;
  
  -- Update sale status
  UPDATE sales
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_sale_id;
  
  -- Reverse stock movements
  FOR v_item IN 
    SELECT si.*, p.stock_quantity as current_stock
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id
  LOOP
    -- Restore stock
    UPDATE products
    SET stock_quantity = stock_quantity + v_item.quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id;
    
    -- Create stock movement reversal
    INSERT INTO stock_movements (
      company_id,
      product_id,
      user_id,
      type,
      quantity,
      reason,
      reference_type,
      reference_id,
      balance_after,
      created_at
    )
    SELECT
      p_company_id,
      v_item.product_id,
      p_operator_id,
      'in',
      v_item.quantity,
      'Cancelamento da venda #' || v_sale.sale_number,
      'sale_cancellation',
      p_sale_id,
      stock_quantity,
      NOW()
    FROM products
    WHERE id = v_item.product_id;
  END LOOP;
  
  -- Reverse cash movements
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_amount
  FROM payments
  WHERE sale_id = p_sale_id
    AND method = 'cash';
  
  IF v_cash_amount > 0 AND v_sale.cash_register_id IS NOT NULL THEN
    -- Create cash reversal
    INSERT INTO cash_movements (
      cash_register_id,
      company_id,
      operator_id,
      user_id,
      type,
      amount,
      description,
      reference_type,
      reference_id,
      balance_after,
      created_at
    )
    SELECT
      v_sale.cash_register_id,
      p_company_id,
      p_operator_id,
      p_operator_id,
      'refund',
      v_cash_amount,
      'Estorno venda #' || v_sale.sale_number,
      'sale_cancellation',
      p_sale_id,
      initial_amount + total_sales + total_deposits - total_withdrawals - v_cash_amount,
      NOW()
    FROM cash_registers
    WHERE id = v_sale.cash_register_id;
    
    -- Update cash register
    UPDATE cash_registers
    SET total_sales = total_sales - v_cash_amount,
        updated_at = NOW()
    WHERE id = v_sale.cash_register_id;
  END IF;
  
  -- Cancel financial accounts
  UPDATE financial_accounts
  SET status = 'cancelled',
      updated_at = NOW()
  WHERE reference_type = 'sale'
    AND reference_id = p_sale_id
    AND status = 'pending';
  
  -- Create audit log
  INSERT INTO audit_logs (
    company_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    p_company_id,
    p_operator_id,
    'sale.cancel',
    'sale',
    p_sale_id,
    jsonb_build_object('status', v_sale.status),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'sale_id', p_sale_id,
    'message', 'Sale cancelled successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal TO authenticated;
