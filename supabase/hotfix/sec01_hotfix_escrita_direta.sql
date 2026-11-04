-- VENDDI-SEC-01 — hotfix mínimo de escrita direta e de permissões de execução.
--
-- NÃO é migration do repositório: fica em supabase/hotfix/ de propósito, para não entrar no
-- `migration up`. Só deve ser aplicado em produção após aprovação explícita (GO/NO-GO).
--
-- Escopo deliberadamente restrito:
-- 1. Remove as políticas genéricas de INSERT, UPDATE e DELETE em sales, payments e sale_items.
--    Nenhum código do app publicado (branch main) grava nessas tabelas direto; vendas passam por
--    create_atomic_sale (SECURITY DEFINER). Nada legítimo perde acesso.
-- 2. Revoga EXECUTE de PUBLIC e de anon nas funções financeiras e de permissão listadas abaixo,
--    e devolve EXECUTE ao authenticated só onde ele já existia. Nenhuma função do app publicado
--    é chamada por anon.
--
-- FORA deste hotfix (decisão registrada no relatório SEC-01):
-- - Escrita direta de caixa (cash_registers e cash_movements). O app publicado (main) abre, fecha,
--   faz sangria e suprimento por INSERT e UPDATE direto. Remover isso antes de publicar o app novo
--   (que usa as RPCs de caixa da 029) quebraria a operação de caixa em produção.
-- - create_atomic_sale no remoto falha sempre (FOR UPDATE com agregado). É defeito funcional, corrigido
--   pela migration 021/028 do repositório. Não é hotfix de segurança; é migração corretiva com testes.
-- - Drift de funções e triggers exclusivos da produção (ver docs/AUDITORIA_REMOTA_HOMOLOGACAO.md).
--
-- Rollback: supabase/hotfix/sec01_rollback.sql (recria as políticas e concede EXECUTE a PUBLIC e anon,
-- como estavam). Faça backup antes de aplicar.

BEGIN;

-- 1. Escrita direta em vendas, pagamentos e itens --------------------------------------------
DROP POLICY IF EXISTS "Users can insert company sales" ON public.sales;
DROP POLICY IF EXISTS "Users can update company sales" ON public.sales;
DROP POLICY IF EXISTS "Users can delete company sales" ON public.sales;

DROP POLICY IF EXISTS "Users can insert company payments" ON public.payments;
DROP POLICY IF EXISTS "Users can update company payments" ON public.payments;
DROP POLICY IF EXISTS "Users can delete company payments" ON public.payments;

DROP POLICY IF EXISTS "Users can insert company sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can update company sale_items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can delete company sale_items" ON public.sale_items;

-- 2. Permissões de execução das funções financeiras e de permissão --------------------------
-- Remove PUBLIC e anon. Depois devolve authenticated onde ele já tinha EXECUTE (verificado no remoto).
REVOKE EXECUTE ON FUNCTION public.caixa_saldo_esperado(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calc_fechamento_caixa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.relatorio_fechamento_caixa(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_cash_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale_with_reversal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_atomic_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, numeric, numeric, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.relatorio_caixas_periodo(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.relatorio_comissoes(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_commission_percent(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_subscription_statuses() FROM PUBLIC, anon;

-- Devolve authenticated onde o app publicado chama (preserva o acesso que já existia).
GRANT EXECUTE ON FUNCTION public.calculate_cash_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale_with_reversal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_atomic_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, numeric, numeric, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_caixas_periodo(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_comissoes(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_fechamento_caixa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_percent(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_subscription_statuses() TO authenticated;

-- 3. Isolamento entre empresas em update_subscription_statuses ------------------------------
-- A função é SECURITY DEFINER e antes expirava trials de TODAS as empresas, para qualquer usuário
-- autenticado. Agora, com sessão de usuário, ela só alcança a empresa do usuário. Sem sessão
-- (cron, service role) o comportamento global é mantido.
CREATE OR REPLACE FUNCTION public.update_subscription_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE company_subscriptions
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'trial'
    AND trial_end_date < NOW()
    AND converted_to_paid_at IS NULL
    AND (auth.uid() IS NULL OR company_id = get_user_company_id());

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

COMMIT;
