-- Venddi - Migration 012
-- Atomic tenant provisioning: company + owner user + trial subscription.
--
-- Por que existe: não há política de INSERT em `companies`, e a política de
-- INSERT em `users` só aceita owner/admin já existente. Logo, o cadastro
-- direto pelo cliente falhava e deixava o usuário do Auth órfão. A função
-- abaixo roda como SECURITY DEFINER, usa auth.uid() e cria tudo na mesma
-- transação.
--
-- Observação: a chamada exige sessão ativa. Se o projeto exigir confirmação
-- de e-mail, o signUp não retorna sessão e esta função falha com 42501.

CREATE OR REPLACE FUNCTION register_tenant(
  p_company_name TEXT,
  p_cnpj TEXT,
  p_full_name TEXT,
  p_plan company_plan DEFAULT 'starter'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_id UUID := auth.uid();
  v_email TEXT;
  v_company companies%ROWTYPE;
  v_user users%ROWTYPE;
BEGIN
  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE auth_id = v_auth_id) THEN
    RAISE EXCEPTION 'Usuário já possui empresa cadastrada' USING ERRCODE = '23505';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_auth_id;

  INSERT INTO companies (name, cnpj, plan, status)
  VALUES (p_company_name, p_cnpj, p_plan, 'active')
  RETURNING * INTO v_company;

  INSERT INTO users (company_id, auth_id, email, full_name, role, is_active)
  VALUES (v_company.id, v_auth_id, v_email, p_full_name, 'owner', TRUE)
  RETURNING * INTO v_user;

  -- Trial de 30 dias (trigger set_trial_end_date calcula o fim)
  INSERT INTO company_subscriptions (company_id, plan, status, trial_days)
  VALUES (v_company.id, 'starter', 'trial', 30);

  RETURN jsonb_build_object(
    'company', to_jsonb(v_company),
    'user', to_jsonb(v_user)
  );
END;
$$;

REVOKE ALL ON FUNCTION register_tenant(TEXT, TEXT, TEXT, company_plan) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_tenant(TEXT, TEXT, TEXT, company_plan) TO authenticated;
