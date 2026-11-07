-- Venddi - Migration 032
-- Proteção de credenciais e de estados na camada fiscal (Go-live 02).
--
-- Problema encontrado: fiscal_configurations guarda api_token (token do provedor) e csc, e o
-- navegador lia e gravava essas colunas (src/lib/api/fiscal.ts) e chamava o provedor direto
-- (src/lib/services/focusNFeProvider.ts). Qualquer usuário autenticado da empresa lia o token.
--
-- Correção no banco:
--   1) authenticated/anon perdem SELECT da tabela e ganham SELECT só nas colunas não sensíveis.
--      api_token e csc ficam acessíveis só ao servidor (service_role / Edge Function).
--   2) authenticated/anon perdem INSERT/UPDATE/DELETE em fiscal_configurations e fiscal_documents.
--      Emissão e configuração passam pelo servidor.
--   3) fiscal_documents.status só muda por transições válidas (mesma tabela de core.ts).
--
-- Não ativa nenhuma emissão. FISCAL_ENABLED continua false.

-- 1) Configuração fiscal: sem token e sem CSC para o cliente --------------------------------
REVOKE ALL ON fiscal_configurations FROM authenticated, anon;
GRANT SELECT (
  id, company_id, provider, environment, cnpj, state_registration, municipal_registration,
  company_name, trade_name, address, tax_regime, csc_id, nfce_series, nfce_number_start,
  is_active, is_configured, created_at, updated_at
) ON fiscal_configurations TO authenticated;

-- 2) Documentos fiscais: escrita só pelo servidor ------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON fiscal_documents FROM authenticated, anon;

-- 3) Transições de status do documento fiscal (espelha FISCAL_TRANSITIONS em src/lib/fiscal/core.ts)
CREATE OR REPLACE FUNCTION fn_fiscal_transicao_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_permitidas TEXT[];
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_permitidas := CASE OLD.status
    WHEN 'pending' THEN ARRAY['processing', 'contingency']
    WHEN 'processing' THEN ARRAY['authorized', 'rejected', 'denied', 'pending', 'contingency']
    WHEN 'contingency' THEN ARRAY['processing', 'authorized', 'rejected']
    WHEN 'authorized' THEN ARRAY['cancelled']
    ELSE ARRAY[]::TEXT[]
  END;

  IF NOT (NEW.status = ANY (v_permitidas)) THEN
    RAISE EXCEPTION 'Transição fiscal inválida: % → %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fiscal_transicao_status ON fiscal_documents;
CREATE TRIGGER trg_fiscal_transicao_status
  BEFORE UPDATE OF status ON fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION fn_fiscal_transicao_status();
