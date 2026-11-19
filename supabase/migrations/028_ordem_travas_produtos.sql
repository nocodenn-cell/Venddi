-- Venddi - Migration 028
-- Ordem determinística das travas de produto nas RPCs de venda e estorno.
--
-- Problema medido (deadlock venda x conclusão de inventário): a venda travava os produtos na
-- ordem do carrinho; a conclusão trava por product_id crescente. Com ordens opostas, cada uma
-- espera a outra e o Postgres aborta uma delas.
-- Correção: a venda e o estorno passam a travar produtos por product_id crescente, a mesma
-- ordem da conclusão de inventário (e da numeração de venda, que trava a empresa antes).
-- Mantém FOR NO KEY UPDATE na empresa (migration 021/026), que não conflita com a checagem de chave estrangeira.
--
-- Corpo das funções igual à migration 026, exceto as duas linhas de ordenação.
-- cancel_sale_with_reversal volta a ser a assinatura de 2 argumentos (p_sale_id, p_reason),
-- com empresa, papel e operador vindos da sessão (migration 021). A versão de 4 argumentos da main foi descartada.

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
  -- SEGURANÇA: empresa e operador vêm da sessão, nunca só do cliente (migration 026).
  IF p_company_id IS DISTINCT FROM get_user_company_id() THEN
    RAISE EXCEPTION 'Acesso negado: empresa diferente da sessão' USING ERRCODE = '42501';
  END IF;
  IF p_operator_id IS DISTINCT FROM (SELECT id FROM users WHERE auth_id = auth.uid()) THEN
    RAISE EXCEPTION 'Operador deve ser o usuário logado' USING ERRCODE = '42501';
  END IF;
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY ((value->>'productId')::uuid)
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
  
  -- Serializa a numeração de vendas por empresa. FOR UPDATE não é permitido com
  -- agregados (MAX), então a trava fica na linha da empresa. Usa FOR NO KEY UPDATE:
  -- FOR UPDATE conflita com a checagem de chave estrangeira (KEY SHARE) do movimento de
  -- estoque, e a venda e a entrada se bloqueavam mutuamente (deadlock reproduzido).
  PERFORM 1 FROM companies WHERE id = p_company_id FOR NO KEY UPDATE;

  SELECT COALESCE(MAX(sale_number), 0) + 1 INTO v_sale_number
  FROM sales
  WHERE company_id = p_company_id;
  
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
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) ORDER BY ((value->>'productId')::uuid)
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
      p_cash_register_id,
      p_company_id,
      p_operator_id,
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

GRANT EXECUTE ON FUNCTION create_atomic_sale TO authenticated;

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
  FOR v_item IN SELECT product_id, quantity FROM sale_items WHERE sale_id = p_sale_id ORDER BY product_id LOOP
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
