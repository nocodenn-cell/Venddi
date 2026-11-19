-- Rollback da migration 030: recria as políticas de escrita direta que a 030 removeu.
-- ATENÇÃO: isto reabre a brecha de segurança corrigida pela 030. Vendas, pagamentos, itens e
-- auditoria voltam a aceitar INSERT, UPDATE e DELETE de qualquer usuário da empresa, e o caixa
-- volta a aceitar movimento e abertura diretos. Use só para reverter um problema da 030 em
-- homologação, e reaplique a 030 assim que possível.
-- As definições são as de supabase/migrations/005_rls_policies.sql (sales, audit_logs, payments,
-- sale_items) e de 027 (caixa).

BEGIN;

-- Vendas e auditoria (005): isolamento por empresa
CREATE POLICY "Users can insert company sales" ON sales FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company sales" ON sales FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete company sales" ON sales FOR DELETE USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company audit_logs" ON audit_logs FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company audit_logs" ON audit_logs FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete company audit_logs" ON audit_logs FOR DELETE USING (company_id = get_user_company_id());

-- Pagamentos e itens (005): acesso segue a venda
CREATE POLICY "Users can insert company payments" ON payments FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM sales));
CREATE POLICY "Users can update company payments" ON payments FOR UPDATE USING (sale_id IN (SELECT id FROM sales));
CREATE POLICY "Users can delete company payments" ON payments FOR DELETE USING (sale_id IN (SELECT id FROM sales));

CREATE POLICY "Users can insert company sale_items" ON sale_items FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM sales));
CREATE POLICY "Users can update company sale_items" ON sale_items FOR UPDATE USING (sale_id IN (SELECT id FROM sales));
CREATE POLICY "Users can delete company sale_items" ON sale_items FOR DELETE USING (sale_id IN (SELECT id FROM sales));

-- Caixa (027)
DROP POLICY IF EXISTS "Gerencia altera valor inicial" ON cash_registers;
CREATE POLICY "Caixa registra movimento" ON cash_movements FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));
CREATE POLICY "Caixa abre caixa" ON cash_registers FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));
CREATE POLICY "Caixa atualiza caixa" ON cash_registers FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'))
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));

COMMIT;
