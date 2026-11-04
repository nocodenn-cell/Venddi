-- Venddi - Migration 027
-- Permissões do caixa e integridade do razão de movimentos.
--
-- Encontrado na homologação: um vendedor (salesperson) gravou uma sangria de 80 direto em
-- cash_movements e, na mesma sessão, fechou o caixa e zerou o valor inicial (100 -> 0).
-- Causa: as políticas genéricas (migration 005) deixavam qualquer usuário da empresa gravar,
-- alterar e apagar essas tabelas.
--
-- Regras depois desta migration:
-- - Registrar movimento e abrir/atualizar caixa: owner, admin, manager e cashier (da empresa).
-- - Vendedor não escreve nas tabelas de caixa.
-- - cash_movements é razão imutável: sem UPDATE nem DELETE para ninguém.
-- - cash_registers não pode ser apagado.
-- - Só owner, admin e manager alteram o valor inicial de um caixa.
--
-- Resíduo conhecido (registrado em docs/GO_NO_GO_PRIMEIRO_CLIENTE.md): a tela de caixa ainda
-- grava direto nas tabelas. Abertura, sangria, suprimento e fechamento devem virar RPCs
-- auditadas antes do primeiro cliente.

DROP POLICY IF EXISTS "Users can insert company cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Users can update company cash_movements" ON cash_movements;
DROP POLICY IF EXISTS "Users can delete company cash_movements" ON cash_movements;

CREATE POLICY "Caixa registra movimento" ON cash_movements FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));

DROP POLICY IF EXISTS "Users can insert company cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Users can update company cash_registers" ON cash_registers;
DROP POLICY IF EXISTS "Users can delete company cash_registers" ON cash_registers;

CREATE POLICY "Caixa abre caixa" ON cash_registers FOR INSERT
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));

CREATE POLICY "Caixa atualiza caixa" ON cash_registers FOR UPDATE
  USING (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'))
  WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('owner', 'admin', 'manager', 'cashier'));

-- Valor inicial só muda por gerência (owner, admin, manager). Com get_user_role() nulo
-- (migrations e sessões sem usuário), a regra não bloqueia.
CREATE OR REPLACE FUNCTION proteger_valor_inicial_caixa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.initial_amount IS DISTINCT FROM OLD.initial_amount
     AND get_user_role() IN ('cashier', 'salesperson') THEN
    RAISE EXCEPTION 'Só gerente pode alterar o valor inicial do caixa' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cash_registers_protege_valor_inicial ON cash_registers;
CREATE TRIGGER cash_registers_protege_valor_inicial
  BEFORE UPDATE OF initial_amount ON cash_registers
  FOR EACH ROW
  EXECUTE FUNCTION proteger_valor_inicial_caixa();
