-- Rollback do hotfix VENDDI-SEC-01: restaura as políticas e os grants como estavam no remoto.
-- ATENÇÃO: reabre a brecha de escrita direta em vendas, pagamentos e itens e o EXECUTE para anon.
-- Use só se o hotfix causar um problema operacional comprovado, e reaplique assim que possível.

BEGIN;

CREATE POLICY "Users can insert company sales" ON public.sales FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update company sales" ON public.sales FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete company sales" ON public.sales FOR DELETE USING (company_id = get_user_company_id());

CREATE POLICY "Users can insert company payments" ON public.payments FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM public.sales));
CREATE POLICY "Users can update company payments" ON public.payments FOR UPDATE USING (sale_id IN (SELECT id FROM public.sales));
CREATE POLICY "Users can delete company payments" ON public.payments FOR DELETE USING (sale_id IN (SELECT id FROM public.sales));

CREATE POLICY "Users can insert company sale_items" ON public.sale_items FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM public.sales));
CREATE POLICY "Users can update company sale_items" ON public.sale_items FOR UPDATE USING (sale_id IN (SELECT id FROM public.sales));
CREATE POLICY "Users can delete company sale_items" ON public.sale_items FOR DELETE USING (sale_id IN (SELECT id FROM public.sales));

GRANT EXECUTE ON FUNCTION public.caixa_saldo_esperado(uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calc_fechamento_caixa(uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_fechamento_caixa(uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_cash_balance(uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale_with_reversal(uuid, text) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_atomic_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, numeric, numeric, text, uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_estoque(uuid, integer, text) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_caixas_periodo(timestamptz, timestamptz) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.relatorio_comissoes(timestamptz, timestamptz) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_commission_percent(uuid, numeric) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_subscription_statuses() TO PUBLIC, anon;

-- Corpo original de update_subscription_statuses (global, como no remoto antes do hotfix)
CREATE OR REPLACE FUNCTION public.update_subscription_statuses() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update expired trials
  UPDATE company_subscriptions
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'trial'
    AND trial_end_date < NOW()
    AND converted_to_paid_at IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$;

COMMIT;
