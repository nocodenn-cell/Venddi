-- Venddi - Migration 019
-- Convites de funcionários: unicidade de e-mail, controle de reenvio e
-- proteção da identidade dos usuários (papel, empresa, e-mail e auth_id).
--
-- ANTES DE APLICAR EM PRODUÇÃO: confirme que não há e-mails repetidos em users
--   select lower(email), count(*) from users group by 1 having count(*) > 1;
-- Se houver, corrija os registros antes (esta migration não altera dados).

-- 1) E-mail único (sem diferenciar maiúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

-- 2) Controle de convites
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_send_count INTEGER NOT NULL DEFAULT 0;

-- 3) Proteção da identidade. A política de UPDATE de users deixa um admin
--    alterar qualquer coluna de outro usuário da empresa. Por isso:
--    - auth_id, company_id e e-mail nunca mudam por sessão de usuário
--      (vínculo de login e isolamento da empresa);
--    - papel só muda por owner, e ninguém cria outro owner.
--    Chamadas sem sessão de usuário (service role, Edge Functions) não passam
--    por estas regras: elas têm controle próprio.
CREATE OR REPLACE FUNCTION guard_user_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.auth_id IS DISTINCT FROM OLD.auth_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Dados de identidade do usuário não podem ser alterados' USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_caller_role := get_user_role();
    IF v_caller_role IS DISTINCT FROM 'owner'
       AND (OLD.role IN ('owner', 'admin') OR NEW.role IN ('owner', 'admin')) THEN
      RAISE EXCEPTION 'Apenas o dono pode alterar papéis de administrador' USING ERRCODE = '42501';
    END IF;
    IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
      RAISE EXCEPTION 'Não é permitido criar outro dono' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_role_change ON users;
DROP TRIGGER IF EXISTS trg_guard_user_identity_change ON users;
CREATE TRIGGER trg_guard_user_identity_change
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_identity_change();
