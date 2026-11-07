-- Venddi - Migration 033
-- Overload legado cancel_sale_with_reversal(UUID, TEXT) (migration 021) mantinha uma regra
-- própria, separada da versão de 4 argumentos usada pela tela (migrations 026/028/029).
-- Agora a forma de 2 argumentos só resolve empresa e operador da sessão e delega para a
-- versão de 4 argumentos. Assim existe uma única regra de cancelamento (papel, empresa,
-- trava de estoque, estorno de caixa). Testes existentes que chamam a forma de 2 argumentos continuam válidos.

CREATE OR REPLACE FUNCTION cancel_sale_with_reversal(
  p_sale_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_operator UUID;
  v_result JSONB;
BEGIN
  SELECT u.id INTO v_operator
  FROM users u
  WHERE u.auth_id = auth.uid()
    AND u.company_id = v_company
    AND u.is_active;

  IF v_company IS NULL OR v_operator IS NULL THEN
    RAISE EXCEPTION 'Usuário sem acesso a uma empresa ativa' USING ERRCODE = '42501';
  END IF;

  v_result := cancel_sale_with_reversal(p_sale_id, v_company, v_operator, p_reason);

  -- A forma de 4 argumentos devolve {"success": false} em vez de lançar erro. Esta forma mantém
  -- o contrato antigo (lança erro), para que recusa de papel ou de estado nunca passe como sucesso.
  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'Cancelamento recusado') USING ERRCODE = '42501';
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_sale_with_reversal(UUID, TEXT) TO authenticated;

-- Motivo obrigatório no banco, para qualquer caminho de cancelamento (a forma de 4 argumentos,
-- usada pela tela, não validava o motivo; a regra existia só no cliente e no overload antigo).
CREATE OR REPLACE FUNCTION fn_cancelamento_motivo_minimo()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF char_length(btrim(COALESCE(NEW.cancellation_reason, ''))) < 5 THEN
      RAISE EXCEPTION 'Informe o motivo do cancelamento (mínimo 5 caracteres)' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancelamento_motivo_minimo ON sales;
CREATE TRIGGER trg_cancelamento_motivo_minimo
  BEFORE UPDATE OF status ON sales
  FOR EACH ROW
  EXECUTE FUNCTION fn_cancelamento_motivo_minimo();
