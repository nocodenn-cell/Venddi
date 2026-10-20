-- Venddi - Add idempotency_key to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_expenses DECIMAL(10,2) DEFAULT 0;

-- Add updated_at to cash_registers
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to cancel sale with full reversal
CREATE OR REPLACE FUNCTION cancel_sale_with_reversal(
  p_sale_id UUID,
  p_company_id UUID,
  p_operator_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale RECORD;
  v_item RECORD;
  v_payment RECORD;
  v_cash_amount DECIMAL(10,2) := 0;
BEGIN
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
