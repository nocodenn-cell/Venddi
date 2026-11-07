-- Venddi - Migration 030
-- Fecha as gravações diretas de vendas, pagamentos, caixa e auditoria pela API.
--
-- Encontrado na validação operacional do caixa (docs/CAIXA_TRANSACIONAL.md):
-- - sales, payments e sale_items tinham políticas genéricas de INSERT, UPDATE e DELETE (migration 005):
--   qualquer usuário da empresa, inclusive vendedor, podia criar, alterar ou apagar venda pela API;
-- - cash_movements e cash_registers ainda aceitavam INSERT e UPDATE diretos (migration 027);
-- - audit_logs podia ser alterado e apagado pela API.
--
-- Depois desta migration, vendas, pagamentos, itens, movimentos, caixa e auditoria são gravados
-- só por funções SECURITY DEFINER (create_atomic_sale, cancel_sale_with_reversal, abrir_caixa,
-- registrar_movimento_caixa, fechar_caixa). A API mantém SELECT, sujeito à RLS por empresa.
-- Nenhum código do app grava nessas tabelas diretamente (conferido em src/lib/api).

-- Vendas, pagamentos e itens ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert company sales" ON sales;
DROP POLICY IF EXISTS "Users can update company sales" ON sales;
DROP POLICY IF EXISTS "Users can delete company sales" ON sales;

DROP POLICY IF EXISTS "Users can insert company payments" ON payments;
DROP POLICY IF EXISTS "Users can update company payments" ON payments;
DROP POLICY IF EXISTS "Users can delete company payments" ON payments;

DROP POLICY IF EXISTS "Users can insert company sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can update company sale_items" ON sale_items;
DROP POLICY IF EXISTS "Users can delete company sale_items" ON sale_items;

-- Caixa: movimentos e abertura/fechamento só pelas RPCs ----------------------------------------
DROP POLICY IF EXISTS "Caixa registra movimento" ON cash_movements;
DROP POLICY IF EXISTS "Caixa abre caixa" ON cash_registers;
-- Só gerência (owner, admin, manager) mantém UPDATE direto, e o trigger proteger_estado_caixa
-- recusa status, fechamento e totais. Na prática, a gerência altera só o valor inicial.
DROP POLICY IF EXISTS "Caixa atualiza caixa" ON cash_registers;
CREATE POLICY "Gerencia altera valor inicial" ON cash_registers FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager'));

-- Auditoria: leitura apenas; a gravação é feita pelas funções de venda e caixa -----------------
DROP POLICY IF EXISTS "Users can insert company audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can update company audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can delete company audit_logs" ON audit_logs;
