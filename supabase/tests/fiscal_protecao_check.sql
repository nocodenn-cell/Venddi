-- Teste da migration 032: credenciais fiscais e transições de status (Go-live 02).
-- Roda dentro de BEGIN/ROLLBACK com o schema completo (run_local_db_tests.sh).
BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('85111111-1111-1111-1111-111111111111', 'Fiscal Teste', '85.111.111/0001-85', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('85111111-1111-1111-1111-111111111111', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('85000000-0000-4000-8000-000000000001', '85111111-1111-1111-1111-111111111111', '85000000-0000-4000-8000-0000000000a1', 'dono@fiscal.test', 'Dono', 'owner', true);
INSERT INTO fiscal_configurations (id, company_id, provider, environment, api_token, cnpj, company_name, tax_regime, csc, csc_id, is_configured)
  VALUES ('85333333-3333-3333-3333-333333333333', '85111111-1111-1111-1111-111111111111', 'focus_nfe', 'homologacao',
          'TOKEN-SECRETO-NAO-PODE-VAZAR', '85.111.111/0001-85', 'Fiscal Teste', 'simples_nacional', 'CSC-SECRETO', '000001', true);
INSERT INTO sales (id, company_id, sale_number, operator_id, subtotal, total, status, sale_date)
  VALUES ('85444444-4444-4444-4444-444444444444', '85111111-1111-1111-1111-111111111111', 1,
          '85000000-0000-4000-8000-000000000001', 10, 10, 'completed', NOW());
INSERT INTO fiscal_documents (id, company_id, sale_id, reference, status)
  VALUES ('85555555-5555-5555-5555-555555555555', '85111111-1111-1111-1111-111111111111',
          '85444444-4444-4444-4444-444444444444', '85666666-6666-6666-6666-666666666666', 'pending');

DO $$
DECLARE v_status TEXT; n INT;
BEGIN
  -- A) Cliente (authenticated) não lê o token nem a CSC
  IF has_column_privilege('authenticated', 'fiscal_configurations', 'api_token', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU A1: authenticated pode ler api_token';
  END IF;
  IF has_column_privilege('authenticated', 'fiscal_configurations', 'csc', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU A2: authenticated pode ler csc';
  END IF;
  IF has_column_privilege('anon', 'fiscal_configurations', 'api_token', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU A3: anon pode ler api_token';
  END IF;
  -- B) Cliente não escreve em documentos fiscais nem na configuração
  IF has_table_privilege('authenticated', 'fiscal_documents', 'UPDATE')
     OR has_table_privilege('authenticated', 'fiscal_documents', 'INSERT') THEN
    RAISE EXCEPTION 'FALHOU B1: authenticated escreve em fiscal_documents';
  END IF;
  IF has_table_privilege('authenticated', 'fiscal_configurations', 'UPDATE')
     OR has_table_privilege('authenticated', 'fiscal_configurations', 'INSERT') THEN
    RAISE EXCEPTION 'FALHOU B2: authenticated escreve em fiscal_configurations';
  END IF;
  -- C) O colunas permitidas continuam legíveis
  IF NOT has_column_privilege('authenticated', 'fiscal_configurations', 'cnpj', 'SELECT') THEN
    RAISE EXCEPTION 'FALHOU C1: cnpj deveria ser legível';
  END IF;
  -- D) Transições válidas (superusuário, como o servidor)
  UPDATE fiscal_documents SET status = 'processing' WHERE id = '85555555-5555-5555-5555-555555555555';
  UPDATE fiscal_documents SET status = 'authorized' WHERE id = '85555555-5555-5555-5555-555555555555';
  SELECT status INTO v_status FROM fiscal_documents WHERE id = '85555555-5555-5555-5555-555555555555';
  IF v_status <> 'authorized' THEN RAISE EXCEPTION 'FALHOU D1: status = %', v_status; END IF;
  -- E) Transição inválida é recusada: autorizado não volta a pendente
  BEGIN
    UPDATE fiscal_documents SET status = 'pending' WHERE id = '85555555-5555-5555-5555-555555555555';
    RAISE EXCEPTION 'FALHOU E1: autorizado voltou para pending';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- F) Cancelamento a partir de autorizado é permitido
  UPDATE fiscal_documents SET status = 'cancelled' WHERE id = '85555555-5555-5555-5555-555555555555';
  -- G) Rejeitado é final
  INSERT INTO fiscal_documents (company_id, sale_id, reference, status)
    VALUES ('85111111-1111-1111-1111-111111111111', '85444444-4444-4444-4444-444444444444', '85666666-6666-6666-6666-666666666667', 'pending');
  UPDATE fiscal_documents SET status = 'processing' WHERE reference = '85666666-6666-6666-6666-666666666667';
  UPDATE fiscal_documents SET status = 'rejected' WHERE reference = '85666666-6666-6666-6666-666666666667';
  BEGIN
    UPDATE fiscal_documents SET status = 'processing' WHERE reference = '85666666-6666-6666-6666-666666666667';
    RAISE EXCEPTION 'FALHOU G1: rejeitado foi reemitido';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'FISCAL PROTECAO OK';
END $$;

-- H) Como authenticated de fato: SELECT do token é negado
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM api_token FROM fiscal_configurations;
  RAISE EXCEPTION 'FALHOU H1: authenticated leu api_token';
EXCEPTION WHEN insufficient_privilege THEN NULL; END $$;
RESET ROLE;

ROLLBACK;
