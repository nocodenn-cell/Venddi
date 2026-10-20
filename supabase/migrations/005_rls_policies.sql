-- Venddi - Row Level Security Policies
-- Date: 2026-10-19
-- Sprint: 01

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get user's company_id
-- ============================================
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id 
    FROM users 
    WHERE auth_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMPANIES POLICIES
-- ============================================
-- Users can only view their own company
CREATE POLICY "Users can view their company"
ON companies FOR SELECT
USING (id = get_user_company_id());

-- Only owners can update their company
CREATE POLICY "Owners can update their company"
ON companies FOR UPDATE
USING (
  id = get_user_company_id() 
  AND EXISTS (
    SELECT 1 FROM users 
    WHERE users.company_id = companies.id 
    AND users.auth_id = auth.uid() 
    AND users.role = 'owner'
  )
);

-- ============================================
-- USERS POLICIES
-- ============================================
-- Users can view users in their company
CREATE POLICY "Users can view company users"
ON users FOR SELECT
USING (company_id = get_user_company_id());

-- Only owners and admins can insert users
CREATE POLICY "Owners and admins can insert users"
ON users FOR INSERT
WITH CHECK (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.company_id = users.company_id
    AND u.auth_id = auth.uid()
    AND u.role IN ('owner', 'admin')
  )
);

-- Only owners and admins can update users
CREATE POLICY "Owners and admins can update users"
ON users FOR UPDATE
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users u
    WHERE u.company_id = users.company_id
    AND u.auth_id = auth.uid()
    AND u.role IN ('owner', 'admin')
  )
);

-- ============================================
-- GENERIC POLICY FOR COMPANY DATA
-- ============================================
-- This pattern applies to all tables with company_id
CREATE OR REPLACE FUNCTION create_company_rls_policies(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- SELECT policy
  EXECUTE format(
    'CREATE POLICY "Users can view company %I" ON %I FOR SELECT USING (company_id = get_user_company_id())',
    table_name, table_name
  );
  
  -- INSERT policy
  EXECUTE format(
    'CREATE POLICY "Users can insert company %I" ON %I FOR INSERT WITH CHECK (company_id = get_user_company_id())',
    table_name, table_name
  );
  
  -- UPDATE policy
  EXECUTE format(
    'CREATE POLICY "Users can update company %I" ON %I FOR UPDATE USING (company_id = get_user_company_id())',
    table_name, table_name
  );
  
  -- DELETE policy
  EXECUTE format(
    'CREATE POLICY "Users can delete company %I" ON %I FOR DELETE USING (company_id = get_user_company_id())',
    table_name, table_name
  );
END;
$$ LANGUAGE plpgsql;

-- Apply to all company-scoped tables
SELECT create_company_rls_policies('audit_logs');
SELECT create_company_rls_policies('categories');
SELECT create_company_rls_policies('products');
SELECT create_company_rls_policies('stock_movements');
SELECT create_company_rls_policies('customers');
SELECT create_company_rls_policies('suppliers');
SELECT create_company_rls_policies('sales');
SELECT create_company_rls_policies('sale_items');
SELECT create_company_rls_policies('payments');
SELECT create_company_rls_policies('cash_registers');
SELECT create_company_rls_policies('cash_movements');
SELECT create_company_rls_policies('financial_accounts');
SELECT create_company_rls_policies('financial_categories');
