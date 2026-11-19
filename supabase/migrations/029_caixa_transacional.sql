-- Venddi - Migration 029
-- Caixa transacional: abertura, sangria, suprimento e fechamento viram RPCs auditadas.
--
-- Encontrado na auditoria (docs/AUDITORIA_CAIXA.md):
-- - a tela gravava direto em cash_registers e cash_movements (abertura falhava: coluna operator_id
--   inexistente; sangria e suprimento não alteravam os totais; fechamento não conferia o saldo);
-- - dois caixas abertos para o mesmo operador eram possíveis;
-- - nenhuma operação tinha idempotência (duplo clique gerava duas sangrias);
-- - venda e estorno não tinham trava consistente com o status do caixa (corrida venda x fechamento).
--
-- Depois desta migration:
-- - Um caixa aberto por operador e empresa (índice único parcial).
-- - Abertura, sangria, suprimento e fechamento só pelas RPCs abaixo. Cada uma trava o caixa,
--   revalida o status, aplica as permissões e grava uma linha em cash_operation_log.
-- - cash_operation_log é imutável (sem UPDATE nem DELETE).
-- - Status, totais e valores de fechamento de cash_registers só mudam pelas funções SECURITY DEFINER
--   (RPCs de caixa, venda e estorno). Edição direta pela API como authenticated é recusada.
-- - Venda e estorno travam o caixa antes dos produtos. O estorno de venda de caixa fechado é recusado.
-- - Repetir uma operação com a mesma chave de idempotência devolve o resultado original.
--   Repetir a chave com dados diferentes é recusado.

-- 1. Um caixa aberto por operador e empresa --------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cash_registers
    WHERE status = 'open'
    GROUP BY company_id, user_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Há operadores com mais de um caixa aberto. Feche os duplicados antes de aplicar a 029.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_registers_operador_aberto
  ON cash_registers (company_id, user_id)
  WHERE status = 'open';

-- 2. Colunas de fechamento --------------------------------------------------------------------
ALTER TABLE cash_registers
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS closing_difference NUMERIC(12,2);

-- 3. Log imutável das operações de caixa ------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_operation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  actor_user_id UUID NOT NULL REFERENCES users(id),
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('open', 'withdrawal', 'deposit', 'close')),
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cash_operation_log_chave UNIQUE (company_id, idempotency_key)
);

ALTER TABLE cash_operation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Caixa ve log de operacoes" ON cash_operation_log;
CREATE POLICY "Caixa ve log de operacoes" ON cash_operation_log FOR SELECT
  USING (company_id = get_user_company_id());
-- Sem políticas de INSERT, UPDATE ou DELETE: só as RPCs (SECURITY DEFINER) gravam.

CREATE OR REPLACE FUNCTION cash_operation_log_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Log de operações de caixa é imutável' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS cash_operation_log_nao_altera ON cash_operation_log;
CREATE TRIGGER cash_operation_log_nao_altera
  BEFORE UPDATE OR DELETE ON cash_operation_log
  FOR EACH ROW
  EXECUTE FUNCTION cash_operation_log_imutavel();

-- 4. Status, totais e fechamento só mudam pelo sistema ----------------------------------------
-- A API grava como authenticated (ou anon). As RPCs de caixa, a venda e o estorno são
-- SECURITY DEFINER: rodam como o dono da função, então current_user não é authenticated.
-- Não usa flag de sessão (set_config), porque qualquer sessão poderia ligá-la.
CREATE OR REPLACE FUNCTION proteger_estado_caixa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
     OR NEW.closed_by IS DISTINCT FROM OLD.closed_by
     OR NEW.final_amount IS DISTINCT FROM OLD.final_amount
     OR NEW.closing_difference IS DISTINCT FROM OLD.closing_difference
     OR NEW.total_sales IS DISTINCT FROM OLD.total_sales
     OR NEW.total_deposits IS DISTINCT FROM OLD.total_deposits
     OR NEW.total_withdrawals IS DISTINCT FROM OLD.total_withdrawals
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id THEN
    RAISE EXCEPTION 'Abertura, fechamento e totais do caixa só pelas operações do sistema'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_registers_protege_estado ON cash_registers;
CREATE TRIGGER cash_registers_protege_estado
  BEFORE UPDATE ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION proteger_estado_caixa();

-- 5. RPC: abrir caixa --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION abrir_caixa(
  p_company_id UUID,
  p_initial_amount NUMERIC,
  p_idempotency_key TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_company UUID;
  v_actor_role TEXT;
  v_payload JSONB;
  v_prev RECORD;
  v_register_id UUID;
  v_result JSONB;
BEGIN

  SELECT u.id, u.company_id, u.role INTO v_actor_id, v_actor_company, v_actor_role
  FROM users u
  WHERE u.auth_id = auth.uid() AND u.is_active;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo' USING ERRCODE = '42501';
  END IF;
  -- Empresa bloqueada, cancelada ou sem assinatura/trial válido: get_user_company_id() devolve NULL.
  IF get_user_company_id() IS DISTINCT FROM v_actor_company THEN
    RAISE EXCEPTION 'Empresa inativa ou sem assinatura ativa' USING ERRCODE = '42501';
  END IF;
  IF p_company_id IS DISTINCT FROM v_actor_company THEN
    RAISE EXCEPTION 'Acesso negado: empresa diferente da sessão' USING ERRCODE = '42501';
  END IF;
  IF v_actor_role NOT IN ('owner', 'admin', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Papel sem permissão para abrir caixa' USING ERRCODE = '42501';
  END IF;
  IF p_initial_amount IS NULL OR p_initial_amount < 0 THEN
    RAISE EXCEPTION 'Valor inicial inválido';
  END IF;
  IF p_initial_amount <> ROUND(p_initial_amount, 2) THEN
    RAISE EXCEPTION 'Valor deve ter no máximo duas casas decimais';
  END IF;
  IF btrim(COALESCE(p_idempotency_key, '')) = '' THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória';
  END IF;

  v_payload := jsonb_build_object(
    'operation', 'open',
    'initial_amount', p_initial_amount,
    'notes', btrim(COALESCE(p_notes, ''))
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_company::text || ':' || p_idempotency_key, 0));

  SELECT l.result, l.payload INTO v_prev
  FROM cash_operation_log l
  WHERE l.company_id = v_actor_company AND l.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_prev.payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'Chave de idempotência já usada com outros dados';
    END IF;
    RETURN v_prev.result || jsonb_build_object('replay', true);
  END IF;

  BEGIN
    INSERT INTO cash_registers (company_id, user_id, status, initial_amount, opening_notes, opened_at)
    VALUES (v_actor_company, v_actor_id, 'open', p_initial_amount, NULLIF(btrim(COALESCE(p_notes, '')), ''), NOW())
    RETURNING id INTO v_register_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe caixa aberto para este operador' USING ERRCODE = 'unique_violation';
  END;

  v_result := jsonb_build_object(
    'success', true,
    'cash_register_id', v_register_id,
    'initial_amount', p_initial_amount,
    'replay', false
  );

  INSERT INTO cash_operation_log (company_id, cash_register_id, actor_user_id, operation, idempotency_key, payload, result)
  VALUES (v_actor_company, v_register_id, v_actor_id, 'open', p_idempotency_key, v_payload, v_result);

  RETURN v_result;
END;
$$;

-- 6. RPC: sangria e suprimento -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_movimento_caixa(
  p_cash_register_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_idempotency_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_company UUID;
  v_actor_role TEXT;
  v_reg cash_registers%ROWTYPE;
  v_payload JSONB;
  v_prev RECORD;
  v_expected NUMERIC(12,2);
  v_new_balance NUMERIC(12,2);
  v_movement_id UUID;
  v_result JSONB;
BEGIN

  SELECT u.id, u.company_id, u.role INTO v_actor_id, v_actor_company, v_actor_role
  FROM users u
  WHERE u.auth_id = auth.uid() AND u.is_active;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo' USING ERRCODE = '42501';
  END IF;
  -- Empresa bloqueada, cancelada ou sem assinatura/trial válido: get_user_company_id() devolve NULL.
  IF get_user_company_id() IS DISTINCT FROM v_actor_company THEN
    RAISE EXCEPTION 'Empresa inativa ou sem assinatura ativa' USING ERRCODE = '42501';
  END IF;
  IF v_actor_role NOT IN ('owner', 'admin', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Papel sem permissão para movimentar caixa' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('withdrawal', 'deposit') THEN
    RAISE EXCEPTION 'Tipo de movimento inválido';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;
  IF p_amount <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'Valor deve ter no máximo duas casas decimais';
  END IF;
  IF btrim(COALESCE(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Descrição obrigatória';
  END IF;
  IF btrim(COALESCE(p_idempotency_key, '')) = '' THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória';
  END IF;

  v_payload := jsonb_build_object(
    'operation', p_type,
    'cash_register_id', p_cash_register_id,
    'amount', p_amount,
    'description', btrim(p_description)
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_company::text || ':' || p_idempotency_key, 0));

  SELECT l.result, l.payload INTO v_prev
  FROM cash_operation_log l
  WHERE l.company_id = v_actor_company AND l.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_prev.payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'Chave de idempotência já usada com outros dados';
    END IF;
    RETURN v_prev.result || jsonb_build_object('replay', true);
  END IF;

  -- Trava o caixa: serializa com vendas, estornos e fechamento deste caixa.
  SELECT * INTO v_reg
  FROM cash_registers
  WHERE id = p_cash_register_id AND company_id = v_actor_company
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado';
  END IF;
  IF v_reg.status <> 'open' THEN
    RAISE EXCEPTION 'Caixa fechado: movimento não registrado' USING ERRCODE = 'check_violation';
  END IF;
  IF v_actor_role NOT IN ('owner', 'admin', 'manager') AND v_reg.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Só o operador do caixa ou a gerência pode movimentar este caixa' USING ERRCODE = '42501';
  END IF;

  v_expected := v_reg.initial_amount + v_reg.total_sales + v_reg.total_deposits - v_reg.total_withdrawals;

  IF p_type = 'withdrawal' AND p_amount > v_expected THEN
    RAISE EXCEPTION 'Sangria maior que o saldo do caixa (saldo esperado R$ %)', v_expected;
  END IF;

  v_new_balance := CASE WHEN p_type = 'deposit'
                        THEN v_expected + p_amount
                        ELSE v_expected - p_amount END;

  INSERT INTO cash_movements (
    cash_register_id, company_id, user_id, operator_id, type, amount, description, balance_after
  )
  VALUES (
    p_cash_register_id, v_actor_company, v_actor_id, v_actor_id, p_type, p_amount, btrim(p_description), v_new_balance
  )
  RETURNING id INTO v_movement_id;

  IF p_type = 'withdrawal' THEN
    UPDATE cash_registers
    SET total_withdrawals = total_withdrawals + p_amount, updated_at = NOW()
    WHERE id = p_cash_register_id;
  ELSE
    UPDATE cash_registers
    SET total_deposits = total_deposits + p_amount, updated_at = NOW()
    WHERE id = p_cash_register_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'cash_register_id', p_cash_register_id,
    'type', p_type,
    'amount', p_amount,
    'balance_after', v_new_balance,
    'replay', false
  );

  INSERT INTO cash_operation_log (company_id, cash_register_id, actor_user_id, operation, idempotency_key, payload, result)
  VALUES (v_actor_company, p_cash_register_id, v_actor_id, p_type, p_idempotency_key, v_payload, v_result);

  RETURN v_result;
END;
$$;

-- 7. RPC: fechar caixa -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fechar_caixa(
  p_cash_register_id UUID,
  p_final_amount NUMERIC,
  p_idempotency_key TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_company UUID;
  v_actor_role TEXT;
  v_reg cash_registers%ROWTYPE;
  v_payload JSONB;
  v_prev RECORD;
  v_expected NUMERIC(12,2);
  v_difference NUMERIC(12,2);
  v_result JSONB;
BEGIN

  SELECT u.id, u.company_id, u.role INTO v_actor_id, v_actor_company, v_actor_role
  FROM users u
  WHERE u.auth_id = auth.uid() AND u.is_active;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado ou inativo' USING ERRCODE = '42501';
  END IF;
  -- Empresa bloqueada, cancelada ou sem assinatura/trial válido: get_user_company_id() devolve NULL.
  IF get_user_company_id() IS DISTINCT FROM v_actor_company THEN
    RAISE EXCEPTION 'Empresa inativa ou sem assinatura ativa' USING ERRCODE = '42501';
  END IF;
  IF v_actor_role NOT IN ('owner', 'admin', 'manager', 'cashier') THEN
    RAISE EXCEPTION 'Papel sem permissão para fechar caixa' USING ERRCODE = '42501';
  END IF;
  IF p_final_amount IS NULL OR p_final_amount < 0 THEN
    RAISE EXCEPTION 'Valor final inválido';
  END IF;
  IF p_final_amount <> ROUND(p_final_amount, 2) THEN
    RAISE EXCEPTION 'Valor deve ter no máximo duas casas decimais';
  END IF;
  IF btrim(COALESCE(p_idempotency_key, '')) = '' THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória';
  END IF;

  v_payload := jsonb_build_object(
    'operation', 'close',
    'cash_register_id', p_cash_register_id,
    'final_amount', p_final_amount,
    'notes', btrim(COALESCE(p_notes, ''))
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(v_actor_company::text || ':' || p_idempotency_key, 0));

  SELECT l.result, l.payload INTO v_prev
  FROM cash_operation_log l
  WHERE l.company_id = v_actor_company AND l.idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_prev.payload IS DISTINCT FROM v_payload THEN
      RAISE EXCEPTION 'Chave de idempotência já usada com outros dados';
    END IF;
    RETURN v_prev.result || jsonb_build_object('replay', true);
  END IF;

  SELECT * INTO v_reg
  FROM cash_registers
  WHERE id = p_cash_register_id AND company_id = v_actor_company
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caixa não encontrado';
  END IF;
  IF v_reg.status <> 'open' THEN
    RAISE EXCEPTION 'Caixa já está fechado' USING ERRCODE = 'check_violation';
  END IF;
  IF v_actor_role NOT IN ('owner', 'admin', 'manager') AND v_reg.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Só o operador do caixa ou a gerência pode fechar este caixa' USING ERRCODE = '42501';
  END IF;

  v_expected := v_reg.initial_amount + v_reg.total_sales + v_reg.total_deposits - v_reg.total_withdrawals;
  v_difference := p_final_amount - v_expected;

  IF v_difference <> 0 AND btrim(COALESCE(p_notes, '')) = '' THEN
    RAISE EXCEPTION 'Fechamento com divergência de R$ % exige observação', v_difference;
  END IF;

  UPDATE cash_registers
  SET status = 'closed',
      closed_at = NOW(),
      closed_by = v_actor_id,
      final_amount = p_final_amount,
      closing_difference = v_difference,
      closing_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''),
      updated_at = NOW()
  WHERE id = p_cash_register_id;

  v_result := jsonb_build_object(
    'success', true,
    'cash_register_id', p_cash_register_id,
    'expected_balance', v_expected,
    'final_amount', p_final_amount,
    'difference', v_difference,
    'replay', false
  );

  INSERT INTO cash_operation_log (company_id, cash_register_id, actor_user_id, operation, idempotency_key, payload, result)
  VALUES (v_actor_company, p_cash_register_id, v_actor_id, 'close', p_idempotency_key, v_payload, v_result);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION abrir_caixa(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION registrar_movimento_caixa(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION fechar_caixa(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION abrir_caixa(UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_movimento_caixa(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION fechar_caixa(UUID, NUMERIC, TEXT, TEXT) TO authenticated;

-- 8. Venda e estorno (corpo de 028, com a trava do caixa) -------------------------------------
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
    RAISE EXCEPTION 'Caixa fechado: venda não registrada';
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

  -- Caixa: trava a linha do caixa e revalida o status. Ordem de travas: empresa -> caixa -> produtos.
  -- Abertura e fechamento de caixa travam a mesma linha, então a venda não entra em caixa fechado.
  SELECT status INTO v_cash_register_status
  FROM cash_registers
  WHERE id = p_cash_register_id
  FOR NO KEY UPDATE;

  IF v_cash_register_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Caixa fechado: venda não registrada' USING ERRCODE = 'check_violation';
  END IF;

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
  v_cash_status TEXT;
BEGIN
  -- SEGURANÇA: empresa e papel vêm da sessão (migration 026).
  IF p_company_id IS DISTINCT FROM get_user_company_id() THEN
    RAISE EXCEPTION 'Acesso negado: empresa diferente da sessão' USING ERRCODE = '42501';
  END IF;
  IF get_user_role() NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para cancelar venda' USING ERRCODE = '42501';
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

  -- Caixa da venda: trava antes dos produtos (venda -> caixa -> produtos) e recusa caixa fechado.
  -- O estorno não pode alterar o total de um caixa que já foi fechado. Só vendas com dinheiro
  -- mexem no caixa: venda só no cartão/PIX pode ser cancelada com o caixa fechado.
  IF v_sale.cash_register_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM payments pm WHERE pm.sale_id = p_sale_id AND pm.method = 'cash'
  ) THEN
    SELECT status INTO v_cash_status
    FROM cash_registers
    WHERE id = v_sale.cash_register_id
    FOR NO KEY UPDATE;

    IF v_cash_status IS DISTINCT FROM 'open' THEN
      RAISE EXCEPTION 'Caixa da venda já foi fechado: o estorno não pode alterar caixa fechado'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  
  -- Única via de cancelamento: libera a trigger que bloqueia UPDATE direto de status (migration 021).
  -- Sem isso, a versão de 4 argumentos usada pela tela falhava com 'só pode ser cancelada pelo cancelamento oficial'.
  PERFORM set_config('app.cancel_sale', 'on', true);

  -- Update sale status
  UPDATE sales
  SET status = 'cancelled',
      cancelled_at = NOW(),
      cancellation_reason = p_reason,
      cancelled_by = p_operator_id,
      updated_at = NOW()
  WHERE id = p_sale_id;
  
  -- Reverse stock movements
  FOR v_item IN 
    SELECT si.*, p.stock_quantity as current_stock
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale_id
    ORDER BY si.product_id
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

GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal(UUID, UUID, UUID, TEXT) TO authenticated;
