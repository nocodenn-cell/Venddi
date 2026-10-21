-- Venddi - Migration 019
-- Convites de funcionários: unicidade de e-mail, controle de reenvio e
-- bloqueio de escalada de privilégio por papel.
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

-- 3) Papel só muda por owner. Antes, a política de UPDATE deixava admin
--    promover a si mesmo ou outro usuário a owner/admin.
--    Chamadas sem sessão de usuário (service role, Edge Functions) não passam
--    por esta regra: elas têm controle próprio.
CREATE OR REPLACE FUNCTION guard_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role user_role;
BEGIN
  IF auth.uid() IS NULL OR NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  v_caller_role := get_user_role();

  -- Só o owner mexe em papéis de owner/admin, inclusive o próprio
  IF v_caller_role IS DISTINCT FROM 'owner'
     AND (OLD.role IN ('owner', 'admin') OR NEW.role IN ('owner', 'admin')) THEN
    RAISE EXCEPTION 'Apenas o dono pode alterar papéis de administrador' USING ERRCODE = '42501';
  END IF;

  -- Ninguém se promove além do próprio papel (owner não cria outro owner por aqui)
  IF NEW.role = 'owner' AND OLD.role <> 'owner' THEN
    RAISE EXCEPTION 'Não é permitido criar outro dono' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_role_change ON users;
CREATE TRIGGER trg_guard_user_role_change
  BEFORE UPDATE OF role ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_role_change();
