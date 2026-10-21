-- Venddi - Migration 015
-- Leitura de financeiro restrita a owner/admin/manager (permissão financial.read).
-- Antes, a política genérica de SELECT (migration 005) deixava cashier e
-- salesperson lerem contas e categorias financeiras.

DROP POLICY IF EXISTS "Users can view company financial_accounts" ON financial_accounts;
CREATE POLICY "Managers can view financial_accounts" ON financial_accounts FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

DROP POLICY IF EXISTS "Users can view company financial_categories" ON financial_categories;
CREATE POLICY "Managers can view financial_categories" ON financial_categories FOR SELECT
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));
