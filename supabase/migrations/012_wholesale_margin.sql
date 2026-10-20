-- Venddi - Migration 012
-- Wholesale pricing, margin calculation and transactional hardening
-- Date: 2026-10-19
-- Sprint: Wholesale & Margin

-- ============================================
-- ISSUE 1: Wholesale price tiers per product
-- ============================================
CREATE TABLE product_wholesale_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  unit_price DECIMAL(12,4) NOT NULL CHECK (unit_price > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, product_id, min_quantity)
);

CREATE INDEX idx_wholesale_tiers_product ON product_wholesale_tiers(product_id);
CREATE INDEX idx_wholesale_tiers_company ON product_wholesale_tiers(company_id);

-- ============================================
-- ISSUE 2: Margin policy per company
-- ============================================
CREATE TABLE company_margin_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  mode VARCHAR(20) NOT NULL DEFAULT 'disabled' CHECK (mode IN ('disabled', 'warn', 'require_approval')),
  min_margin_percent DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_margin_policies_company ON company_margin_policies(company_id);

-- ============================================
-- ISSUE 3: Sale authorizations (for margin policy)
-- ============================================
CREATE TABLE sale_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  authorizer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  approved_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_sale_authorizations_sale ON sale_authorizations(sale_id);
CREATE INDEX idx_sale_authorizations_company ON sale_authorizations(company_id);

-- ============================================
-- ISSUE 4: Enhance sale_items with cost and pricing origin
-- ============================================
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(12,4);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS price_origin VARCHAR(30);
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS wholesale_tier_id UUID;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS general_discount_share DECIMAL(12,4) DEFAULT 0;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS authorization_id UUID;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS net_revenue DECIMAL(12,4);

-- ============================================
-- ISSUE 5: Unique idempotency constraint
-- ============================================
ALTER TABLE sales ADD CONSTRAINT uq_sales_idempotency_key UNIQUE (idempotency_key);

-- ============================================
-- ISSUE 6: Sale number sequence per company (safe concurrent numbering)
-- ============================================
CREATE TABLE company_sale_sequences (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  next_number BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ISSUE 7: Helper functions for margin/markup
-- ============================================

-- Calculate gross profit
CREATE OR REPLACE FUNCTION calc_gross_profit(p_sell_price DECIMAL, p_cost_price DECIMAL)
RETURNS DECIMAL(12,4) AS $$
BEGIN
  IF p_cost_price IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN p_sell_price - p_cost_price;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate gross margin percentage
CREATE OR REPLACE FUNCTION calc_gross_margin_percent(p_sell_price DECIMAL, p_cost_price DECIMAL)
RETURNS DECIMAL(5,2) AS $$
BEGIN
  IF p_cost_price IS NULL OR p_sell_price <= 0 THEN
    RETURN NULL;
  END IF;
  RETURN ((p_sell_price - p_cost_price) / p_sell_price) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate markup percentage over cost
CREATE OR REPLACE FUNCTION calc_markup_percent(p_sell_price DECIMAL, p_cost_price DECIMAL)
RETURNS DECIMAL(7,2) AS $$
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RETURN NULL;
  END IF;
  RETURN ((p_sell_price - p_cost_price) / p_cost_price) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Suggest price for desired margin
CREATE OR REPLACE FUNCTION calc_price_for_margin(p_cost_price DECIMAL, p_desired_margin_percent DECIMAL)
RETURNS DECIMAL(12,4) AS $$
BEGIN
  IF p_cost_price IS NULL OR p_cost_price <= 0 THEN
    RETURN NULL;
  END IF;
  IF p_desired_margin_percent >= 100 THEN
    RAISE EXCEPTION 'Desired margin must be less than 100%%';
  END IF;
  IF p_desired_margin_percent < 0 THEN
    RAISE EXCEPTION 'Desired margin must be non-negative';
  END IF;
  RETURN p_cost_price / (1 - (p_desired_margin_percent / 100));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ISSUE 8: Resolve price (single source of truth)
-- ============================================
CREATE OR REPLACE FUNCTION resolve_product_price(
  p_company_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_retail_price DECIMAL(12,4);
  v_cost_price DECIMAL(12,4);
  v_wholesale_price DECIMAL(12,4);
  v_applied_tier_id UUID;
  v_applied_tier_min_qty INTEGER;
  v_final_price DECIMAL(12,4);
  v_origin VARCHAR(30);
BEGIN
  -- Get product prices
  SELECT sell_price, cost_price
  INTO v_retail_price, v_cost_price
  FROM products
  WHERE id = p_product_id
    AND company_id = p_company_id
    AND is_active = TRUE;
  
  IF v_retail_price IS NULL THEN
    RAISE EXCEPTION 'Product not found or inactive';
  END IF;
  
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;
  
  -- Start with retail price
  v_final_price := v_retail_price;
  v_origin := 'retail';
  
  -- Find best wholesale tier
  SELECT id, min_quantity, unit_price
  INTO v_applied_tier_id, v_applied_tier_min_qty, v_wholesale_price
  FROM product_wholesale_tiers
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND min_quantity <= p_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  -- Apply wholesale if better (lower price)
  IF v_wholesale_price IS NOT NULL AND v_wholesale_price < v_retail_price THEN
    v_final_price := v_wholesale_price;
    v_origin := 'wholesale';
  END IF;
  
  -- TODO: Future - apply promotions if they exist
  -- For now, promotions module doesn't exist
  
  RETURN jsonb_build_object(
    'productId', p_product_id,
    'quantity', p_quantity,
    'unitPrice', v_final_price,
    'retailPrice', v_retail_price,
    'costPrice', v_cost_price,
    'origin', v_origin,
    'wholesaleTierId', v_applied_tier_id,
    'wholesaleTierMinQty', v_applied_tier_min_qty,
    'grossProfit', calc_gross_profit(v_final_price, v_cost_price),
    'grossMarginPercent', calc_gross_margin_percent(v_final_price, v_cost_price),
    'markupPercent', calc_markup_percent(v_final_price, v_cost_price)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION resolve_product_price TO authenticated;

-- ============================================
-- ISSUE 9: Validate wholesale tier configuration
-- ============================================
CREATE OR REPLACE FUNCTION validate_wholesale_tier(
  p_company_id UUID,
  p_product_id UUID,
  p_min_quantity INTEGER,
  p_unit_price DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_retail_price DECIMAL(12,4);
  v_lower_tier_price DECIMAL(12,4);
BEGIN
  -- Get retail price
  SELECT sell_price INTO v_retail_price
  FROM products
  WHERE id = p_product_id AND company_id = p_company_id;
  
  IF v_retail_price IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;
  
  -- Wholesale price cannot exceed retail
  IF p_unit_price > v_retail_price THEN
    RAISE EXCEPTION 'Wholesale price cannot exceed retail price';
  END IF;
  
  -- Price must decrease with quantity (check lower tiers)
  SELECT unit_price INTO v_lower_tier_price
  FROM product_wholesale_tiers
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND min_quantity < p_min_quantity
  ORDER BY min_quantity DESC
  LIMIT 1;
  
  IF v_lower_tier_price IS NOT NULL AND p_unit_price > v_lower_tier_price THEN
    RAISE EXCEPTION 'Wholesale price must not increase with quantity';
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION validate_wholesale_tier TO authenticated;

-- ============================================
-- ISSUE 10: Triggers for wholesale tiers
-- ============================================
CREATE TRIGGER update_product_wholesale_tiers_updated_at
  BEFORE UPDATE ON product_wholesale_tiers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_margin_policies_updated_at
  BEFORE UPDATE ON company_margin_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_sale_sequences_updated_at
  BEFORE UPDATE ON company_sale_sequences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
