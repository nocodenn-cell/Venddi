-- Venddi - Migration 031
-- Regra de desconto no banco (P0 da auditoria go-live).
--
-- Problema: o limite de 5% e a regra "desconto só com pagamento em dinheiro" existiam só
-- no cliente (src/lib/api/sales.ts e PDVPage.tsx). A RPC create_atomic_sale (migration 026)
-- aplica p_discount sem qualquer limite: uma chamada direta à API conseguia dar 100% de
-- desconto ou pagar desconto no cartão.
--
-- Correção: triggers no banco, que valem para qualquer caminho de escrita (RPC, API, SQL).
--   1) sales BEFORE INSERT: desconto entre 0 e 5% do subtotal (mesma tolerância do cliente).
--   2) payments AFTER INSERT: venda com desconto só aceita pagamento em dinheiro.
-- Como a RPC insere venda e pagamentos na mesma transação, uma violação desfaz a venda inteira.
--
-- Fora de escopo desta migration: autorização do gerente para desconto acima de 5%
-- (exige um campo de autorização e a identidade do gerente; ver PROXIMOS_PASSOS.md).

CREATE OR REPLACE FUNCTION fn_sales_discount_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.discount IS NULL OR NEW.discount < 0 THEN
    RAISE EXCEPTION 'Desconto inválido' USING ERRCODE = '22023';
  END IF;
  IF NEW.discount > 0 AND NEW.discount > ROUND(NEW.subtotal * 0.05, 2) + 0.001 THEN
    RAISE EXCEPTION 'Desconto máximo de 5%% sem autorização do gerente' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_discount_limit ON sales;
CREATE TRIGGER trg_sales_discount_limit
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION fn_sales_discount_limit();

CREATE OR REPLACE FUNCTION fn_payments_discount_cash_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.method IS DISTINCT FROM 'cash' AND EXISTS (
    SELECT 1 FROM sales s WHERE s.id = NEW.sale_id AND s.discount > 0
  ) THEN
    RAISE EXCEPTION 'Venda com desconto só pode ser paga em dinheiro' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_discount_cash_only ON payments;
CREATE TRIGGER trg_payments_discount_cash_only
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION fn_payments_discount_cash_only();
