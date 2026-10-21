-- Venddi - Migration 010
-- Fiscal Module - RLS Policies
-- Date: 2026-10-19
-- Sprint: 05

-- ============================================
-- ENABLE RLS ON FISCAL TABLES
-- ============================================
ALTER TABLE fiscal_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_fiscal_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FISCAL CONFIGURATIONS POLICIES
-- ============================================

-- Users can only view their company's fiscal configuration
CREATE POLICY "Users can view their company fiscal configuration"
ON fiscal_configurations FOR SELECT
USING (company_id = get_user_company_id());

-- Only owners and admins can insert fiscal configurations
CREATE POLICY "Owners and admins can insert fiscal configurations"
ON fiscal_configurations FOR INSERT
WITH CHECK (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = fiscal_configurations.company_id
    AND users.auth_id = auth.uid()
    AND users.role IN ('owner', 'admin')
  )
);

-- Only owners and admins can update fiscal configurations
CREATE POLICY "Owners and admins can update fiscal configurations"
ON fiscal_configurations FOR UPDATE
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = fiscal_configurations.company_id
    AND users.auth_id = auth.uid()
    AND users.role IN ('owner', 'admin')
  )
);

-- Only owners can delete fiscal configurations
CREATE POLICY "Owners can delete fiscal configurations"
ON fiscal_configurations FOR DELETE
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = fiscal_configurations.company_id
    AND users.auth_id = auth.uid()
    AND users.role = 'owner'
  )
);

-- ============================================
-- PRODUCT FISCAL DATA POLICIES
-- ============================================

-- Users can only view their company's product fiscal data
CREATE POLICY "Users can view their company product fiscal data"
ON product_fiscal_data FOR SELECT
USING (company_id = get_user_company_id());

-- Users can insert product fiscal data for their company
CREATE POLICY "Users can insert their company product fiscal data"
ON product_fiscal_data FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Users can update product fiscal data for their company
CREATE POLICY "Users can update their company product fiscal data"
ON product_fiscal_data FOR UPDATE
USING (company_id = get_user_company_id());

-- Users can delete product fiscal data for their company
CREATE POLICY "Users can delete their company product fiscal data"
ON product_fiscal_data FOR DELETE
USING (company_id = get_user_company_id());

-- ============================================
-- FISCAL DOCUMENTS POLICIES
-- ============================================

-- Users can only view their company's fiscal documents
CREATE POLICY "Users can view their company fiscal documents"
ON fiscal_documents FOR SELECT
USING (company_id = get_user_company_id());

-- Users can insert fiscal documents for their company
CREATE POLICY "Users can insert their company fiscal documents"
ON fiscal_documents FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Users can update fiscal documents for their company
CREATE POLICY "Users can update their company fiscal documents"
ON fiscal_documents FOR UPDATE
USING (company_id = get_user_company_id());

-- Users can delete fiscal documents for their company
CREATE POLICY "Users can delete their company fiscal documents"
ON fiscal_documents FOR DELETE
USING (company_id = get_user_company_id());

-- ============================================
-- FISCAL EVENTS POLICIES
-- ============================================

-- Users can only view their company's fiscal events
CREATE POLICY "Users can view their company fiscal events"
ON fiscal_events FOR SELECT
USING (company_id = get_user_company_id());

-- Users can insert fiscal events for their company
CREATE POLICY "Users can insert their company fiscal events"
ON fiscal_events FOR INSERT
WITH CHECK (company_id = get_user_company_id());

-- Users can update fiscal events for their company
CREATE POLICY "Users can update their company fiscal events"
ON fiscal_events FOR UPDATE
USING (company_id = get_user_company_id());

-- Users can delete fiscal events for their company
CREATE POLICY "Users can delete their company fiscal events"
ON fiscal_events FOR DELETE
USING (company_id = get_user_company_id());

-- ============================================
-- SECURITY: Prevent manipulation of company_id
-- ============================================

-- Não usamos CHECK com subconsulta: o PostgreSQL não aceita. A proteção de
-- company_id já é feita pelas políticas WITH CHECK acima.
