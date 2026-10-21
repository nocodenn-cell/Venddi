-- Venddi - Migration 016
-- 1) Trial de 15 dias (default e cadastro).
-- 2) Acesso às tabelas exige assinatura ativa ou trial não expirado.
--    Sem isso, o trial nunca expira: nenhuma regra no banco o aplica.

ALTER TABLE company_subscriptions ALTER COLUMN trial_days SET DEFAULT 15;

-- Cadastro: empresa, usuário owner e trial de 15 dias, na mesma transação
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

  -- Trial de 15 dias (trigger set_trial_end_date calcula o fim)
  INSERT INTO company_subscriptions (company_id, plan, status, trial_days)
  VALUES (v_company.id, 'starter', 'trial', 15);

  RETURN jsonb_build_object(
    'company', to_jsonb(v_company),
    'user', to_jsonb(v_user)
  );
END;
$$;

-- Acesso: usuário ativo, empresa ativa e assinatura válida (ativa ou trial no prazo)
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT u.company_id
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.auth_id = auth.uid()
      AND u.is_active = TRUE
      AND c.status = 'active'
      AND EXISTS (
        SELECT 1 FROM company_subscriptions s
        WHERE s.company_id = u.company_id
          AND (s.status = 'active' OR (s.status = 'trial' AND now() < s.trial_end_date))
      )
  );
END;
$$;

-- A própria assinatura precisa ser legível mesmo com trial expirado, senão o
-- login não consegue mostrar "Trial expirado" nem a loja consegue assinar.
-- Usa o acesso de usuário/empresa ativos, sem a checagem de assinatura.
CREATE OR REPLACE FUNCTION get_user_company_id_ignoring_subscription()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT u.company_id
    FROM users u
    JOIN companies c ON c.id = u.company_id
    WHERE u.auth_id = auth.uid()
      AND u.is_active = TRUE
      AND c.status = 'active'
  );
END;
$$;

DROP POLICY IF EXISTS "Users can view their company subscription" ON company_subscriptions;
CREATE POLICY "Users can view their company subscription" ON company_subscriptions FOR SELECT
  USING (company_id = get_user_company_id_ignoring_subscription());
