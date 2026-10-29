-- Venddi - Migration 014
-- Escrita em financeiro e produtos restrita por papel (owner/admin/manager).
-- Antes, as políticas genéricas (migration 005) deixavam qualquer usuário da
-- empresa gravar nessas tabelas, inclusive cashier e salesperson.

-- Papel do usuário logado, considerando usuário ativo e empresa ativa
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT u.role
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.auth_id = auth.uid()
      AND u.is_active = TRUE
      AND c.status = 'active'
  );
END;
$$;

-- ============================================
-- FINANCIAL ACCOUNTS
-- ============================================
DROP POLICY IF EXISTS "Users can insert company financial_accounts" ON financial_accounts;
DROP POLICY IF EXISTS "Users can update company financial_accounts" ON financial_accounts;
DROP POLICY IF EXISTS "Users can delete company financial_accounts" ON financial_accounts;

CREATE POLICY "Managers can insert financial_accounts" ON financial_accounts FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can update financial_accounts" ON financial_accounts FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can delete financial_accounts" ON financial_accounts FOR DELETE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

-- ============================================
-- FINANCIAL CATEGORIES
-- ============================================
DROP POLICY IF EXISTS "Users can insert company financial_categories" ON financial_categories;
DROP POLICY IF EXISTS "Users can update company financial_categories" ON financial_categories;
DROP POLICY IF EXISTS "Users can delete company financial_categories" ON financial_categories;

CREATE POLICY "Managers can insert financial_categories" ON financial_categories FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can update financial_categories" ON financial_categories FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can delete financial_categories" ON financial_categories FOR DELETE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

-- ============================================
-- PRODUCTS (cashier e salesperson só leem; permissionsByRole: products.read)
-- ============================================
DROP POLICY IF EXISTS "Users can insert company products" ON products;
DROP POLICY IF EXISTS "Users can update company products" ON products;
DROP POLICY IF EXISTS "Users can delete company products" ON products;

CREATE POLICY "Managers can insert products" ON products FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can update products" ON products FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "Managers can delete products" ON products FOR DELETE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
