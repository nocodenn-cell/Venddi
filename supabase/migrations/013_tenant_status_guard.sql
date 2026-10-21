-- Venddi - Migration 013
-- Empresa suspensa/cancelada ou usuário desativado perdem o acesso via RLS.
-- get_user_company_id() passa a devolver NULL nesses casos; como todas as
-- políticas usam essa função, o bloqueio vale para todas as tabelas.

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
  );
END;
$$;
