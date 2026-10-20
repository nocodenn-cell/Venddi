-- Venddi - Migration 013
-- Hardened atomic sale with wholesale pricing and margin preservation
-- Date: 2026-10-19
-- Sprint: Wholesale & Margin

-- ============================================
-- Replace create_atomic_sale with hardened version
-- ============================================
DROP FUNCTION IF EXISTS create_atomic_sale(UUID, UUID, UUID, UUID, JSONB, JSONB, DECIMAL, DECIMAL, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_atomic_sale(
  p_company_id UUID,
  p_operator_id UUID,
  p_cash_register_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_items JSONB,
  p_payments JSONB,
  p_discount DECIMAL DEFAULT 0,
  p_additional_expenses DECIMAL DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL,
  p_authorization_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_sale_number BIGINT;
  v_subtotal DECIMAL(12,4) := 0;
  v_total DECIMAL(12,4);
  v_item JSONB;
  v_payment JSONB;
  v_product_id UUID;
  v_aggregated_items JSONB := '[]'::jsonb;
  v_agg_item JSONB;
  v_quantity INTEGER;
  v_unit_price DECIMAL(12,4);
  v_cost_price DECIMAL(12,4);
  v_item_discount DECIMAL(12,4);
  v_item_subtotal DECIMAL(12,4);
  v_current_stock INTEGER;
  v_payment_method TEXT;
  v_payment_amount DECIMAL(12,4);
  v_payment_installments INTEGER;
  v_cash_amount DECIMAL(12,4) := 0;
  v_cash_register_status TEXT;
  v_existing_sale_id UUID;
  v_operator_company UUID;
  v_operator_is_active BOOLEAN;
  v_cash_register_company UUID;
  v_price_resolution JSONB;
  v_price_origin VARCHAR(30);
  v_tier_id UUID;
  v_retail_price DECIMAL(12,4);
  v_general_discount_share DECIMAL(12,4);
  v_net_revenue DECIMAL(12,4);
  v_item_index INTEGER;
  v_total_items_subtotal DECIMAL(12,4) := 0;
  v_allocated_discount DECIMAL(12,4) := 0;
  v_remaining_discount DECIMAL(12,4);
  v_margin_policy_mode VARCHAR(20);
  v_margin_policy_min DECIMAL(5,2);
  v_item_margin_percent DECIMAL(5,2);
  v_authorization_valid BOOLEAN := FALSE;
BEGIN
  -- ============================================
  -- SECURITY: Validate operator via auth.uid()
  -- ============================================
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;
  
  SELECT company_id, is_active
  INTO v_operator_company, v_operator_is_active
  FROM users
  WHERE id = p_operator_id
    AND auth_id = auth.uid();
  
  IF v_operator_company IS NULL THEN
    RAISE EXCEPTION 'Operator not found or not linked to authenticated user';
  END IF;
  
  IF v_operator_company != p_company_id THEN
    RAISE EXCEPTION 'Operator does not belong to company';
  END IF;
  
  IF v_operator_is_active = FALSE THEN
    RAISE EXCEPTION 'Operator is not active';
  END IF;
  
  -- SECURITY: Validate cash register belongs to company
  SELECT company_id, status INTO v_cash_register_company, v_cash_register_status
  FROM cash_registers
  WHERE id = p_cash_register_id
  FOR UPDATE;
  
  IF v_cash_register_company IS NULL OR v_cash_register_company != p_company_id THEN
    RAISE EXCEPTION 'Cash register does not belong to company';
  END IF;
  
  IF v_cash_register_status != 'open' THEN
    RAISE EXCEPTION 'Cash register is not open';
  END IF;
  
  -- ============================================
  -- IDEMPOTENCY: Check for existing sale
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_sale_id
    FROM sales
    WHERE company_id = p_company_id
      AND idempotency_key = p_idempotency_key;
    
    IF v_existing_sale_id IS NOT NULL THEN
      -- Idempotent: return existing sale
      RETURN jsonb_build_object(
        'success', true,
        'sale_id', v_existing_sale_id,
        'message', 'Sale already exists (idempotent)'
      );
    END IF;
  END IF;
  
  -- ============================================
  -- VALIDATE: Customer belongs to company (if provided)
  -- ============================================
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
  
  -- ============================================
  -- VALIDATE: Authorization if margin policy requires it
  -- ============================================
  SELECT mode, min_margin_percent
  INTO v_margin_policy_mode, v_margin_policy_min
  FROM company_margin_policies
  WHERE company_id = p_company_id;
  
  IF v_margin_policy_mode = 'require_approval' AND p_authorization_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM sale_authorizations
      WHERE id = p_authorization_id
        AND company_id = p_company_id
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_authorization_valid;
  END IF;
  
  -- ============================================
  -- AGGREGATE: Combine same product lines
  -- ============================================
  SELECT jsonb_agg(agg)
  INTO v_aggregated_items
  FROM (
    SELECT
      (item->>'productId')::UUID AS product_id,
      SUM((item->>'quantity')::INTEGER) AS total_quantity,
      MAX(COALESCE((item->>'discount')::DECIMAL, 0)) AS item_discount
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY (item->>'productId')::UUID
  ) AS agg;
  
  IF v_aggregated_items IS NULL OR jsonb_array_length(v_aggregated_items) = 0 THEN
    RAISE EXCEPTION 'Empty cart';
  END IF;
  
  -- ============================================
  -- LOCK STOCK: Order by product_id to prevent deadlocks
  -- ============================================
  PERFORM p.id
  FROM products p
  WHERE p.id IN (
    SELECT (agg->>'product_id')::UUID
    FROM jsonb_array_elements(v_aggregated_items) AS agg
  )
  AND p.company_id = p_company_id
  ORDER BY p.id
  FOR UPDATE;
  
  -- ============================================
  -- VALIDATE STOCK AND RESOLVE PRICES
  -- ============================================
  FOR v_agg_item IN SELECT * FROM jsonb_array_elements(v_aggregated_items)
  LOOP
    v_product_id := (v_agg_item->>'product_id')::UUID;
    v_quantity := (v_agg_item->>'total_quantity')::INTEGER;
    v_item_discount := COALESCE((v_agg_item->>'item_discount')::DECIMAL, 0);
    
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for product %', v_product_id;
    END IF;
    
    -- Check stock
    SELECT stock_quantity INTO v_current_stock
    FROM products
    WHERE id = v_product_id
      AND company_id = p_company_id;
    
    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Product not found: %', v_product_id;
    END IF;
    
    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (available: %, requested: %)',
        v_product_id, v_current_stock, v_quantity;
    END IF;
    
    -- Resolve price via server-side function
    v_price_resolution := resolve_product_price(p_company_id, v_product_id, v_quantity);
    
    -- Check margin policy
    IF v_margin_policy_mode != 'disabled' AND v_margin_policy_min IS NOT NULL THEN
      v_item_margin_percent := (v_price_resolution->>'grossMarginPercent')::DECIMAL;
      
      IF v_item_margin_percent IS NOT NULL AND v_item_margin_percent < v_margin_policy_min THEN
        IF v_margin_policy_mode = 'require_approval' AND NOT v_authorization_valid THEN
          RAISE EXCEPTION 'Sale requires authorization: margin below minimum (%%) for product %',
            v_margin_policy_min, v_product_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- ============================================
  -- CALCULATE TOTALS WITH PRICE RESOLUTION
  -- ============================================
  v_item_index := 0;
  FOR v_agg_item IN SELECT * FROM jsonb_array_elements(v_aggregated_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_product_id := (v_agg_item->>'product_id')::UUID;
    v_quantity := (v_agg_item->>'total_quantity')::INTEGER;
    
    v_price_resolution := resolve_product_price(p_company_id, v_product_id, v_quantity);
    v_unit_price := (v_price_resolution->>'unitPrice')::DECIMAL;
    v_cost_price := (v_price_resolution->>'costPrice')::DECIMAL;
    v_price_origin := v_price_resolution->>'origin';
    v_tier_id := (v_price_resolution->>'wholesaleTierId')::UUID;
    v_retail_price := (v_price_resolution->>'retailPrice')::DECIMAL;
    
    v_item_discount := COALESCE((v_agg_item->>'item_discount')::DECIMAL, 0);
    v_item_subtotal := (v_quantity * v_unit_price) - v_item_discount;
    v_subtotal := v_subtotal + v_item_subtotal;
    v_total_items_subtotal := v_total_items_subtotal + (v_quantity * v_unit_price);
  END LOOP;
  
  -- Calculate total
  v_total := v_subtotal - p_discount + p_additional_expenses;
  
  -- ============================================
  -- VALIDATE PAYMENTS
  -- ============================================
  DECLARE
    v_total_payments DECIMAL(12,4) := 0;
    v_has_cash BOOLEAN := FALSE;
    v_cash_total DECIMAL(12,4) := 0;
  BEGIN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
    LOOP
      v_payment_method := v_payment->>'method';
      v_payment_amount := (v_payment->>'amount')::DECIMAL;
      
      IF v_payment_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be positive';
      END IF;
      
      v_total_payments := v_total_payments + v_payment_amount;
      
      IF v_payment_method = 'cash' THEN
        v_has_cash := TRUE;
        v_cash_total := v_cash_total + v_payment_amount;
      END IF;
    END LOOP;
    
    IF ABS(v_total_payments - v_total) > 0.01 THEN
      RAISE EXCEPTION 'Payment total (%) does not match sale total (%)',
        v_total_payments, v_total;
    END IF;
    
    -- Track cash amount for cash register
    v_cash_amount := v_cash_total;
  END;
  
  -- ============================================
  -- GET NEXT SALE NUMBER (concurrent-safe)
  -- ============================================
  INSERT INTO company_sale_sequences (company_id, next_number)
  VALUES (p_company_id, 2)
  ON CONFLICT (company_id) DO UPDATE
  SET next_number = company_sale_sequences.next_number + 1,
      updated_at = NOW()
  RETURNING next_number - 1 INTO v_sale_number;
  
  -- ============================================
  -- CREATE SALE
  -- ============================================
  INSERT INTO sales (
    company_id, sale_number, customer_id, operator_id, cash_register_id,
    subtotal, discount, additional_expenses, total, status, notes,
    sale_date, idempotency_key
  ) VALUES (
    p_company_id, v_sale_number, p_customer_id, p_operator_id, p_cash_register_id,
    v_subtotal, p_discount, p_additional_expenses, v_total, 'completed', p_notes,
    NOW(), p_idempotency_key
  )
  RETURNING id INTO v_sale_id;
  
  -- ============================================
  -- CREATE SALE ITEMS WITH PRICING DETAILS
  -- ============================================
  v_remaining_discount := p_discount;
  v_allocated_discount := 0;
  v_item_index := 0;
  
  FOR v_agg_item IN SELECT * FROM jsonb_array_elements(v_aggregated_items)
  LOOP
    v_item_index := v_item_index + 1;
    v_product_id := (v_agg_item->>'product_id')::UUID;
    v_quantity := (v_agg_item->>'total_quantity')::INTEGER;
    
    v_price_resolution := resolve_product_price(p_company_id, v_product_id, v_quantity);
    v_unit_price := (v_price_resolution->>'unitPrice')::DECIMAL;
    v_cost_price := (v_price_resolution->>'costPrice')::DECIMAL;
    v_price_origin := v_price_resolution->>'origin';
    v_tier_id := (v_price_resolution->>'wholesaleTierId')::UUID;
    
    v_item_discount := COALESCE((v_agg_item->>'item_discount')::DECIMAL, 0);
    v_item_subtotal := (v_quantity * v_unit_price) - v_item_discount;
    
    -- Allocate general discount proportionally
    IF p_discount > 0 AND v_total_items_subtotal > 0 THEN
      IF v_item_index = (SELECT COUNT(*) FROM jsonb_array_elements(v_aggregated_items)) THEN
        -- Last item gets the remainder to ensure exact sum
        v_general_discount_share := v_remaining_discount;
      ELSE
        v_general_discount_share := ROUND((v_item_subtotal / v_total_items_subtotal) * p_discount, 2);
        v_allocated_discount := v_allocated_discount + v_general_discount_share;
        v_remaining_discount := p_discount - v_allocated_discount;
      END IF;
    ELSE
      v_general_discount_share := 0;
    END IF;
    
    -- Calculate net revenue
    v_net_revenue := v_item_subtotal - v_general_discount_share;
    
    -- Prevent negative revenue
    IF v_net_revenue < 0 THEN
      v_net_revenue := 0;
    END IF;
    
    -- Insert sale item with all pricing details
    INSERT INTO sale_items (
      sale_id, product_id, quantity, unit_price, discount, total, cost_price,
      price_origin, wholesale_tier_id, general_discount_share, authorization_id, net_revenue
    ) VALUES (
      v_sale_id, v_product_id, v_quantity, v_unit_price, v_item_discount, v_item_subtotal, v_cost_price,
      v_price_origin, v_tier_id, v_general_discount_share, p_authorization_id, v_net_revenue
    );
    
    -- Update stock atomically
    UPDATE products
    SET stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
    WHERE id = v_product_id
      AND company_id = p_company_id
      AND stock_quantity >= v_quantity;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock race condition: insufficient stock for product %', v_product_id;
    END IF;
    
    -- Create stock movement
    INSERT INTO stock_movements (
      company_id, product_id, user_id, type, quantity, reason,
      reference_type, reference_id, balance_after, created_at
    )
    SELECT
      p_company_id, v_product_id, p_operator_id, 'out', v_quantity,
      'Venda #' || v_sale_number, 'sale', v_sale_id, stock_quantity, NOW()
    FROM products
    WHERE id = v_product_id;
  END LOOP;
  
  -- ============================================
  -- CREATE PAYMENTS
  -- ============================================
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'method';
    v_payment_amount := (v_payment->>'amount')::DECIMAL;
    v_payment_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
    
    INSERT INTO payments (sale_id, method, amount, installments)
    VALUES (v_sale_id, v_payment_method, v_payment_amount, v_payment_installments);
  END LOOP;
  
  -- ============================================
  -- CREATE CASH MOVEMENT (only for cash payments)
  -- ============================================
  IF v_cash_amount > 0 THEN
    INSERT INTO cash_movements (
      cash_register_id, company_id, operator_id, type, amount, description,
      reference_type, reference_id, balance_after, created_at
    )
    SELECT
      p_cash_register_id, p_company_id, p_operator_id, 'sale', v_cash_amount,
      'Venda #' || v_sale_number, 'sale', v_sale_id,
      initial_amount + total_sales + total_deposits - total_withdrawals + v_cash_amount, NOW()
    FROM cash_registers
    WHERE id = p_cash_register_id;
    
    -- Update cash register totals
    UPDATE cash_registers
    SET total_sales = total_sales + v_cash_amount,
        updated_at = NOW()
    WHERE id = p_cash_register_id;
  END IF;
  
  -- ============================================
  -- CREATE FINANCIAL ACCOUNTS (for credit installments)
  -- ============================================
  FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    v_payment_method := v_payment->>'method';
    v_payment_amount := (v_payment->>'amount')::DECIMAL;
    v_payment_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
    
    IF v_payment_method = 'credit_card' AND v_payment_installments > 1 THEN
      DECLARE
        v_installment_amount DECIMAL(12,4);
        v_installment_number INTEGER;
      BEGIN
        v_installment_amount := ROUND(v_payment_amount / v_payment_installments, 2);
        
        FOR v_installment_number IN 1..v_payment_installments
        LOOP
          INSERT INTO financial_accounts (
            company_id, type, description, amount, due_date, category, status,
            reference_type, reference_id, person_id, person_type
          ) VALUES (
            p_company_id, 'receivable',
            'Venda #' || v_sale_number || ' - Parcela ' || v_installment_number || '/' || v_payment_installments,
            v_installment_amount,
            NOW() + (v_installment_number || ' month')::INTERVAL,
            'Vendas', 'pending', 'sale', v_sale_id, p_customer_id, 'customer'
          );
        END LOOP;
      END;
    END IF;
  END LOOP;
  
  -- ============================================
  -- AUDIT LOG
  -- ============================================
  INSERT INTO audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    p_company_id, p_operator_id, 'sale.create', 'sale', v_sale_id,
    jsonb_build_object(
      'sale_number', v_sale_number,
      'total', v_total,
      'items_count', jsonb_array_length(v_aggregated_items),
      'authorization_id', p_authorization_id
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

GRANT EXECUTE ON FUNCTION create_atomic_sale TO authenticated;

-- ============================================
-- Replace cancel_sale_with_reversal with hardened version
-- ============================================
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
  v_sale RECORD;
  v_item RECORD;
  v_operator_id UUID;
  v_operator_company UUID;
  v_operator_is_active BOOLEAN;
  v_cash_amount DECIMAL(12,4) := 0;
BEGIN
  -- SECURITY: Validate operator via auth.uid()
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthenticated request';
  END IF;
  
  SELECT id, company_id, is_active
  INTO v_operator_id, v_operator_company, v_operator_is_active
  FROM users
  WHERE auth_id = auth.uid();
  
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF v_operator_is_active = FALSE THEN
    RAISE EXCEPTION 'User is not active';
  END IF;
  
  -- Get sale details
  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id
  FOR UPDATE;
  
  IF v_sale IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  
  -- Validate sale belongs to operator's company
  IF v_sale.company_id != v_operator_company THEN
    RAISE EXCEPTION 'Sale does not belong to your company';
  END IF;
  
  -- Prevent duplicate cancellation
  IF v_sale.status = 'cancelled' THEN
    RAISE EXCEPTION 'Sale already cancelled';
  END IF;
  
  -- Validate reason
  IF p_reason IS NULL OR LENGTH(p_reason) < 15 THEN
    RAISE EXCEPTION 'Cancellation reason must be at least 15 characters';
  END IF;
  
  -- Update sale status
  UPDATE sales
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_sale_id;
  
  -- Reverse stock movements using historical cost_price
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
      company_id, product_id, user_id, type, quantity, reason,
      reference_type, reference_id, balance_after, created_at
    )
    SELECT
      v_sale.company_id, v_item.product_id, v_operator_id, 'in', v_item.quantity,
      'Cancelamento da venda #' || v_sale.sale_number,
      'sale_cancellation', p_sale_id, stock_quantity, NOW()
    FROM products
    WHERE id = v_item.product_id;
  END LOOP;
  
  -- Reverse cash movements (only for cash payments)
  SELECT COALESCE(SUM(amount), 0) INTO v_cash_amount
  FROM payments
  WHERE sale_id = p_sale_id
    AND method = 'cash';
  
  IF v_cash_amount > 0 AND v_sale.cash_register_id IS NOT NULL THEN
    INSERT INTO cash_movements (
      cash_register_id, company_id, operator_id, type, amount, description,
      reference_type, reference_id, balance_after, created_at
    )
    SELECT
      v_sale.cash_register_id, v_sale.company_id, v_operator_id, 'refund', v_cash_amount,
      'Estorno venda #' || v_sale.sale_number, 'sale_cancellation', p_sale_id,
      initial_amount + total_sales + total_deposits - total_withdrawals - v_cash_amount, NOW()
    FROM cash_registers
    WHERE id = v_sale.cash_register_id;
    
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
  
  -- Audit log
  INSERT INTO audit_logs (
    company_id, user_id, action, entity_type, entity_id,
    old_values, new_values, created_at
  ) VALUES (
    v_sale.company_id, v_operator_id, 'sale.cancel', 'sale', p_sale_id,
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

-- ============================================
-- RLS policies for new tables
-- ============================================
ALTER TABLE product_wholesale_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_margin_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_sale_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company wholesale tiers"
ON product_wholesale_tiers FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage their company wholesale tiers"
ON product_wholesale_tiers FOR ALL
USING (company_id = get_user_company_id());

CREATE POLICY "Users can view their company margin policy"
ON company_margin_policies FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Owners can manage margin policy"
ON company_margin_policies FOR ALL
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = company_margin_policies.company_id
    AND users.auth_id = auth.uid()
    AND users.role = 'owner'
  )
);

CREATE POLICY "Users can view their company sale authorizations"
ON sale_authorizations FOR SELECT
USING (company_id = get_user_company_id());

CREATE POLICY "Owners/managers can manage sale authorizations"
ON sale_authorizations FOR ALL
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = sale_authorizations.company_id
    AND users.auth_id = auth.uid()
    AND users.role IN ('owner', 'admin', 'manager')
  )
);

CREATE POLICY "System can manage sale sequences"
ON company_sale_sequences FOR ALL
USING (company_id = get_user_company_id());
