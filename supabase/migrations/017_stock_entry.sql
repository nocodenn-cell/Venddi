-- Venddi - Migration 017
-- Entrada de estoque: soma a quantidade ao produto e registra o movimento
-- (type = 'in') na mesma transação. Só owner, admin e manager podem registrar.

CREATE OR REPLACE FUNCTION registrar_entrada_estoque(
  p_product_id UUID,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user_id UUID;
  v_new_balance INTEGER;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para registrar entrada de estoque' USING ERRCODE = '42501';
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'A quantidade de entrada deve ser maior que zero';
  END IF;

  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();

  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id
    AND company_id = v_company_id
  RETURNING stock_quantity INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado nesta empresa';
  END IF;

  INSERT INTO stock_movements (
    company_id, product_id, user_id, type, quantity, reason,
    reference_type, balance_after, created_at
  ) VALUES (
    v_company_id, p_product_id, v_user_id, 'in', p_quantity, p_reason,
    'entry', v_new_balance, NOW()
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

REVOKE ALL ON FUNCTION registrar_entrada_estoque(UUID, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_entrada_estoque(UUID, INTEGER, TEXT) TO authenticated;
