-- Venddi - Migration 019
-- Inventário físico: contagem, conferência e ajuste auditável de estoque.
--
-- Modelo de concorrência (ver docs/INVENTARIO_FISICO.md):
-- - A contagem NÃO bloqueia vendas nem entradas. Cada produto contado guarda o
--   saldo do sistema no momento da contagem (system_quantity).
-- - Na conclusão, o ajuste é a DIFERENÇA ENTRE O CONTADO E O SALDO DA CONTAGEM
--   (counted - system_quantity), aplicada sobre o saldo ATUAL com lock de linha.
--   Vendas/entradas feitas depois da contagem são preservadas (sem lost update).
-- - Conclusão e cancelamento travam a linha do inventário (FOR UPDATE): são
--   idempotentes e não geram movimentos duplicados.
--
-- Escrita somente via RPCs SECURITY DEFINER. Não há políticas de INSERT/UPDATE/DELETE
-- para usuários autenticados: escritas diretas pela API são recusadas.

-- ============================================
-- TABELAS
-- ============================================
CREATE TABLE inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'counting'
    CHECK (status IN ('counting', 'completed', 'cancelled')),
  started_by UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_counts_completed_fields CHECK (
    status <> 'completed' OR (completed_at IS NOT NULL AND completed_by IS NOT NULL)
  ),
  CONSTRAINT inventory_counts_cancelled_fields CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  )
);

-- No máximo um inventário em andamento por empresa (garante em nível de banco).
CREATE UNIQUE INDEX idx_inventory_counts_one_open
  ON inventory_counts(company_id) WHERE status = 'counting';
CREATE INDEX idx_inventory_counts_company ON inventory_counts(company_id, started_at DESC);

CREATE TABLE inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- RESTRICT: excluir um produto que faz parte de um inventário não pode apagar
  -- o item em silêncio (exclusão no app é lógica, via is_active; este FK é a salvaguarda)
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  -- Saldo no início do inventário (informativo; o cálculo usa system_quantity)
  expected_quantity INTEGER NOT NULL,
  -- Saldo do sistema no momento em que o produto foi contado
  system_quantity INTEGER,
  counted_quantity INTEGER CHECK (counted_quantity IS NULL OR counted_quantity >= 0),
  counted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  counted_at TIMESTAMPTZ,
  -- Ajuste efetivamente aplicado na conclusão (NULL enquanto não concluído)
  applied_difference INTEGER,
  CONSTRAINT inventory_count_items_unique_product UNIQUE (count_id, product_id),
  CONSTRAINT inventory_count_items_counted_snapshot CHECK (
    counted_quantity IS NULL OR system_quantity IS NOT NULL
  )
);

CREATE INDEX idx_inventory_count_items_count ON inventory_count_items(count_id);
CREATE INDEX idx_inventory_count_items_company ON inventory_count_items(company_id);

-- ============================================
-- RLS: somente leitura para owner/admin/manager, isolado por empresa
-- ============================================
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view inventory_counts" ON inventory_counts FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

CREATE POLICY "Managers can view inventory_count_items" ON inventory_count_items FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

REVOKE ALL ON inventory_counts FROM anon;
REVOKE ALL ON inventory_count_items FROM anon;
GRANT SELECT ON inventory_counts TO authenticated;
GRANT SELECT ON inventory_count_items TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON inventory_counts FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON inventory_count_items FROM authenticated;

-- ============================================
-- RPC: iniciar inventário (snapshot dos produtos ativos)
-- ============================================
CREATE OR REPLACE FUNCTION iniciar_inventario(p_name TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user_id UUID;
  v_count_id UUID;
  v_total INTEGER;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para realizar inventário' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();

  BEGIN
    INSERT INTO inventory_counts (company_id, name, started_by)
    VALUES (
      v_company_id,
      COALESCE(LEFT(NULLIF(TRIM(p_name), ''), 120), 'Inventário ' || to_char(NOW(), 'DD/MM/YYYY HH24:MI')),
      v_user_id
    )
    RETURNING id INTO v_count_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um inventário em andamento nesta empresa';
  END;

  INSERT INTO inventory_count_items (count_id, company_id, product_id, expected_quantity)
  SELECT v_count_id, v_company_id, p.id, p.stock_quantity
  FROM products p
  WHERE p.company_id = v_company_id
    AND p.is_active = TRUE;

  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN jsonb_build_object('count_id', v_count_id, 'total_items', v_total);
END;
$$;

-- ============================================
-- RPC: registrar (ou corrigir) a contagem de um produto
-- Pode ser chamada quantas vezes for preciso; a última contagem vale.
-- ============================================
CREATE OR REPLACE FUNCTION registrar_contagem_item(
  p_count_id UUID,
  p_product_id UUID,
  p_counted_quantity INTEGER
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
  v_status TEXT;
  v_system_quantity INTEGER;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para realizar inventário' USING ERRCODE = '42501';
  END IF;
  IF p_counted_quantity IS NULL OR p_counted_quantity < 0 THEN
    RAISE EXCEPTION 'A quantidade contada deve ser zero ou maior';
  END IF;

  SELECT status INTO v_status
  FROM inventory_counts
  WHERE id = p_count_id AND company_id = v_company_id
  FOR SHARE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Inventário não encontrado nesta empresa';
  END IF;
  IF v_status <> 'counting' THEN
    RAISE EXCEPTION 'Este inventário não está mais em andamento';
  END IF;

  -- Trava o produto para capturar um saldo consistente com vendas/entradas concorrentes
  SELECT stock_quantity INTO v_system_quantity
  FROM products
  WHERE id = p_product_id AND company_id = v_company_id
  FOR UPDATE;

  IF v_system_quantity IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado nesta empresa';
  END IF;

  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();

  UPDATE inventory_count_items
  SET counted_quantity = p_counted_quantity,
      system_quantity = v_system_quantity,
      counted_by = v_user_id,
      counted_at = NOW()
  WHERE count_id = p_count_id
    AND product_id = p_product_id
    AND company_id = v_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produto não faz parte deste inventário';
  END IF;

  RETURN jsonb_build_object(
    'system_quantity', v_system_quantity,
    'difference', p_counted_quantity - v_system_quantity
  );
END;
$$;

-- ============================================
-- RPC: concluir inventário e aplicar ajustes
-- Idempotente: concluir de novo não gera movimentos novos.
-- ============================================
CREATE OR REPLACE FUNCTION concluir_inventario(p_count_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user_id UUID;
  v_status TEXT;
  v_name TEXT;
  v_pending INTEGER;
  v_item RECORD;
  v_difference INTEGER;
  v_new_balance INTEGER;
  v_adjusted INTEGER := 0;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para realizar inventário' USING ERRCODE = '42501';
  END IF;

  -- Serializa conclusões/cancelamentos concorrentes do mesmo inventário
  SELECT status, name INTO v_status, v_name
  FROM inventory_counts
  WHERE id = p_count_id AND company_id = v_company_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Inventário não encontrado nesta empresa';
  END IF;

  IF v_status = 'completed' THEN
    SELECT count(*) INTO v_adjusted
    FROM inventory_count_items
    WHERE count_id = p_count_id AND applied_difference <> 0;
    RETURN jsonb_build_object('status', 'completed', 'already_completed', TRUE, 'adjusted_items', v_adjusted);
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Inventário cancelado não pode ser concluído';
  END IF;

  SELECT count(*) INTO v_pending
  FROM inventory_count_items
  WHERE count_id = p_count_id AND counted_quantity IS NULL;

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Ainda há % produto(s) sem contagem', v_pending;
  END IF;

  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();

  FOR v_item IN
    SELECT id, product_id, counted_quantity, system_quantity
    FROM inventory_count_items
    WHERE count_id = p_count_id
    ORDER BY product_id
  LOOP
    v_difference := v_item.counted_quantity - v_item.system_quantity;

    IF v_difference = 0 THEN
      UPDATE inventory_count_items SET applied_difference = 0 WHERE id = v_item.id;
      CONTINUE;
    END IF;

    -- Aplica a diferença sobre o saldo ATUAL (preserva vendas/entradas feitas durante a contagem)
    UPDATE products
    SET stock_quantity = stock_quantity + v_difference,
        updated_at = NOW()
    WHERE id = v_item.product_id
      AND company_id = v_company_id
    RETURNING stock_quantity INTO v_new_balance;

    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Ajuste deixaria saldo negativo no produto %. Conte o produto novamente.', v_item.product_id;
    END IF;

    INSERT INTO stock_movements (
      company_id, product_id, user_id, type, quantity, reason,
      reference_type, reference_id, balance_after, created_at
    ) VALUES (
      v_company_id, v_item.product_id, v_user_id, 'adjustment', v_difference,
      'Inventário: ' || v_name || ' (contado ' || v_item.counted_quantity
        || ', sistema ' || v_item.system_quantity || ')',
      'inventory_count', p_count_id, v_new_balance, NOW()
    );

    UPDATE inventory_count_items SET applied_difference = v_difference WHERE id = v_item.id;
    v_adjusted := v_adjusted + 1;
  END LOOP;

  UPDATE inventory_counts
  SET status = 'completed',
      completed_by = v_user_id,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_count_id;

  RETURN jsonb_build_object('status', 'completed', 'already_completed', FALSE, 'adjusted_items', v_adjusted);
END;
$$;

-- ============================================
-- RPC: cancelar inventário (não altera estoque)
-- ============================================
CREATE OR REPLACE FUNCTION cancelar_inventario(p_count_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID := get_user_company_id();
  v_role user_role := get_user_role();
  v_user_id UUID;
  v_status TEXT;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin', 'manager') THEN
    RAISE EXCEPTION 'Papel sem permissão para realizar inventário' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status
  FROM inventory_counts
  WHERE id = p_count_id AND company_id = v_company_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Inventário não encontrado nesta empresa';
  END IF;
  IF v_status = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'cancelled', 'already_cancelled', TRUE);
  END IF;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'Inventário já concluído não pode ser cancelado';
  END IF;

  SELECT id INTO v_user_id FROM users WHERE auth_id = auth.uid();

  UPDATE inventory_counts
  SET status = 'cancelled',
      cancelled_by = v_user_id,
      cancelled_at = NOW(),
      updated_at = NOW()
  WHERE id = p_count_id;

  RETURN jsonb_build_object('status', 'cancelled', 'already_cancelled', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION iniciar_inventario(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION registrar_contagem_item(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION concluir_inventario(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION cancelar_inventario(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iniciar_inventario(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_contagem_item(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION concluir_inventario(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancelar_inventario(UUID) TO authenticated;
