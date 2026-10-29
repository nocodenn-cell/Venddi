-- Venddi - Migration 008
-- CRITICAL FIXES - Audit and Corrections
-- Date: 2026-10-19
-- Sprint: 04

-- ============================================
-- ISSUE 1: sales table missing columns used by RPC
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- ============================================
-- ISSUE 2: cash_movements table missing operator_id
-- ============================================
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id);

-- ============================================
-- ISSUE 3: Fix SECURITY DEFINER functions with search_path
-- ============================================

-- Replace get_user_company_id with search_path (CREATE OR REPLACE, sem DROP:
-- as políticas RLS dependem dessa função e o DROP falharia)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id 
    FROM users 
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate create_atomic_sale with fixes
DROP FUNCTION IF EXISTS create_atomic_sale(UUID, UUID, UUID, JSONB, JSONB, UUID, DECIMAL, DECIMAL, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_atomic_sale(
  p_company_id UUID,
  p_operator_id UUID,
  p_cash_register_id UUID,
  p_items JSONB,
  p_payments JSONB,
  p_customer_id UUID DEFAULT NULL,
  p_discount DECIMAL DEFAULT 0,
  p_additional_expenses DECIMAL DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_sale_number INTEGER;
  v_subtotal DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2);
  v_item JSONB;
  v_payment JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price DECIMAL(10,2);
  v_item_discount DECIMAL(10,2);
  v_item_subtotal DECIMAL(10,2);
  v_current_stock INTEGER;
  v_payment_method TEXT;
  v_payment_amount DECIMAL(10,2);
  v_payment_installments INTEGER;
  v_cash_amount DECIMAL(10,2) := 0;
  v_cash_register_status TEXT;
  v_existing_sale_id UUID;
  v_operator_company UUID;
  v_cash_register_company UUID;
BEGIN
  -- SECURITY: Validate operator belongs to company
  SELECT company_id INTO v_operator_company
  FROM users
  WHERE id = p_operator_id;
  
  IF v_operator_company IS NULL OR v_operator_company != p_company_id THEN
    RAISE EXCEPTION 'Operator does not belong to company';
  END IF;
  
  -- SECURITY: Validate cash register belongs to company
  SELECT company_id, status INTO v_cash_register_company, v_cash_register_status
  FROM cash_registers
  WHERE id = p_cash_register_id;
  
  IF v_cash_register_company IS NULL OR v_cash_register_company != p_company_id THEN
    RAISE EXCEPTION 'Cash register does not belong to company';
  END IF;
  
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_sale_id
    FROM sales
    WHERE company_id = p_company_id
      AND idempotency_key = p_idempotency_key;
    
    IF v_existing_sale_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_existing_sale_id,
        'message', 'Sale already exists (idempotent)'
      );
    END IF;
  END IF;
  
  -- Validate cash register is open
  IF v_cash_register_status IS NULL THEN
    RAISE EXCEPTION 'Cash register not found';
  END IF;
  
  IF v_cash_register_status != 'open' THEN
    RAISE EXCEPTION 'Cash register is not open';
  END IF;
  
  -- Validate customer belongs to company (if provided)
  IF p_customer_id IS NOT NULL THEN
    DECLARE
      v_customer_company UUID;
    BEGIN
      SELECT company_id INTO v_customer_company
      FROM customers
      WHERE id = p_customer_id;
      
      IF v_customer_company IS NULL OR v_customer_company != p_company_id THEN
        RAISE EXCEPTION 'Customer does not belong to company';
      END IF;
    END;
  END IF;
  
  -- Calculate subtotal from items and validate stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::DECIMAL;
    v_item_discount := COALESCE((v_item->>'discount')::DECIMAL, 0);
    
    -- Validate product belongs to company and check stock
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_product_id
      AND company_id = p_company_id;
    
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product not found or does not belong to company: %', v_product_id;
    END IF;
    
    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product: %', v_product_id;
    END IF;
    
    v_item_subtotal := (v_quantity * v_unit_price) - v_item_discount;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;
  
  -- Calculate total
  v_total := v_subtotal - p_discount + p_additional_expenses;
  
  -- Validate payments match total
  DECLARE
    v_total_payments DECIMAL(10,2) := 0;
  BEGIN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_total_payments := v_total_payments + (v_payment->>'amount')::DECIMAL;
    END LOOP;
    
    IF ABS(v_total_payments - v_total) > 0.01 THEN
      RAISE EXCEPTION 'Payment total (%) does not match sale total (%)', v_total_payments, v_total;
    END IF;
  END;
  
  -- Get next sale number with row lock to prevent race condition
  SELECT COALESCE(MAX(sale_number), 0) + 1 INTO v_sale_number
  FROM sales
  WHERE company_id = p_company_id
  FOR UPDATE;
  
  -- Create sale
  INSERT INTO sales (
    company_id,
    sale_number,
    customer_id,
    operator_id,
    cash_register_id,
    subtotal,
    discount,
    additional_expenses,
    total,
    status,
    notes,
    sale_date,
    idempotency_key
  ) VALUES (
    p_company_id,
    v_sale_number,
    p_customer_id,
    p_operator_id,
    p_cash_register_id,
    v_subtotal,
    p_discount,
    p_additional_expenses,
    v_total,
    'completed',
    p_notes,
    NOW(),
    p_idempotency_key
  )
  RETURNING id INTO v_sale_id;
  
  -- Create sale items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::DECIMAL;
    v_item_discount := COALESCE((v_item->>'discount')::DECIMAL, 0);
    v_item_subtotal := (v_quantity * v_unit_price) - v_item_discount;
    
    -- Insert sale item
    INSERT INTO sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount,
      total,
      cost_price
    ) VALUES (
      v_sale_id,
      v_product_id,
      v_quantity,
      v_unit_price,
      v_item_discount,
      v_item_subtotal,
      (SELECT cost_price FROM products WHERE id = v_product_id)
    );
    
    -- Update stock atomically
    UPDATE products
    SET stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id
      AND company_id = p_company_id;
    
    -- Create stock movement
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
      v_product_id,
      p_operator_id,
      'out',
      v_quantity,
      'Venda #' || v_sale_number,
      'sale',
      v_sale_id,
      stock_quantity,
      NOW()
    FROM products
    WHERE id = v_product_id;
  END LOOP;
  
  -- Create payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'method';
    v_payment_amount := (v_payment->>'amount')::DECIMAL;
    v_payment_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
    
    INSERT INTO payments (
      sale_id,
      method,
      amount,
      installments
    ) VALUES (
      v_sale_id,
      v_payment_method,
      v_payment_amount,
      v_payment_installments
    );
    
    -- Track cash amount for cash register
    IF v_payment_method = 'cash' THEN
      v_cash_amount := v_cash_amount + v_payment_amount;
    END IF;
  END LOOP;
  
  -- Create cash movement if there's cash payment
  IF v_cash_amount > 0 THEN
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
      p_cash_register_id,
      p_company_id,
      p_operator_id,
      'sale',
      v_cash_amount,
      'Venda #' || v_sale_number,
      'sale',
      v_sale_id,
      initial_amount + total_sales + total_deposits - total_withdrawals + v_cash_amount,
      NOW()
    FROM cash_registers
    WHERE id = p_cash_register_id;
    
    -- Update cash register totals
    UPDATE cash_registers
    SET total_sales = total_sales + v_cash_amount,
        updated_at = NOW()
    WHERE id = p_cash_register_id;
  END IF;
  
  -- Create financial accounts for credit sales
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'method';
    v_payment_amount := (v_payment->>'amount')::DECIMAL;
    v_payment_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
    
    -- Create accounts receivable for credit card with installments
    IF v_payment_method = 'credit_card' AND v_payment_installments > 1 THEN
      DECLARE
        v_installment_amount DECIMAL(10,2);
        v_installment_number INTEGER;
      BEGIN
        v_installment_amount := v_payment_amount / v_payment_installments;
        
        FOR v_installment_number IN 1..v_payment_installments
        LOOP
          INSERT INTO financial_accounts (
            company_id,
            type,
            description,
            amount,
            due_date,
            category,
            status,
            reference_type,
            reference_id,
            person_id,
            person_type
          ) VALUES (
            p_company_id,
            'receivable',
            'Venda #' || v_sale_number || ' - Parcela ' || v_installment_number || '/' || v_payment_installments,
            v_installment_amount,
            NOW() + (v_installment_number || ' month')::INTERVAL,
            'Vendas',
            'pending',
            'sale',
            v_sale_id,
            p_customer_id,
            'customer'
          );
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  -- Create audit log
  INSERT INTO audit_logs (
    company_id,
    user_id,
    action,
    entity_type,
    entity_id,
    new_values,
    created_at
  ) VALUES (
    p_company_id,
    p_operator_id,
    'sale.create',
    'sale',
    v_sale_id,
    jsonb_build_object(
      'sale_number', v_sale_number,
      'total', v_total,
      'items_count', jsonb_array_length(p_items)
    ),
    NOW()
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'total', v_total
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Drop and recreate cancel_sale_with_reversal with fixes
DROP FUNCTION IF EXISTS cancel_sale_with_reversal(UUID, UUID, UUID, TEXT);

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

-- Recreate grants
GRANT EXECUTE ON FUNCTION create_atomic_sale TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal TO authenticated;
