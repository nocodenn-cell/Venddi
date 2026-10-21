-- Venddi - Migration 012
-- Isolamento por empresa, identidade derivada do servidor, cadastro (bootstrap)
-- e decisões de assinatura/funcionalidade no banco.
-- Date: 2026-10-20
--
-- Regras desta migration:
--  * Não edita migrations anteriores. É idempotente e defensiva: funciona tanto
--    sobre a cadeia 001-011 aplicada por completo quanto sobre um banco em que
--    005/006/008/010 falharam parcialmente (ver docs/SEGURANCA_TENANT_012.md).
--  * A empresa e o operador SEMPRE vêm de auth.uid() -> users.auth_id.
--    Parâmetros p_company_id / p_operator_id enviados pelo navegador são aceitos
--    apenas por compatibilidade e, se divergirem da identidade real, a chamada é recusada.

-- ============================================
-- 0. Colunas que as RPCs usam (008 pode não ter sido aplicada)
-- ============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS idempotency_key UUID;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_expenses DECIMAL(10,2) DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES cash_registers(id) ON DELETE SET NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id);
ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Uma empresa por usuário Auth (o vínculo é o auth_id já UNIQUE em users).
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_company_idempotency
  ON sales(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============================================
-- 1. Identidade do chamador (SECURITY DEFINER, search_path fixo)
-- ============================================
-- CREATE OR REPLACE mantém as policies dependentes (o DROP da 008 falhava por isso).
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.company_id
  FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.auth_id = auth.uid()
    AND u.is_active
    AND c.status = 'active'
$$;

CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.auth_id = auth.uid() AND u.is_active AND c.status = 'active'
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.role FROM public.users u
  JOIN public.companies c ON c.id = u.company_id
  WHERE u.auth_id = auth.uid() AND u.is_active AND c.status = 'active'
$$;

CREATE OR REPLACE FUNCTION current_user_has_role(p_roles user_role[])
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_user_role() = ANY (p_roles), false)
$$;

-- ============================================
-- 2. Funcionalidades da plataforma (decisão no servidor)
-- ============================================
CREATE TABLE IF NOT EXISTS platform_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL,
  description TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE platform_feature_flags ENABLE ROW LEVEL SECURITY;

INSERT INTO platform_feature_flags (key, enabled, description) VALUES
  ('FISCAL_ENABLED', false, 'Módulo fiscal (NFC-e) congelado nesta fase.'),
  ('AUTO_TRIAL', false, 'Sem teste grátis automático: avaliação liberada pela equipe após contato comercial.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION platform_flag(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((SELECT enabled FROM public.platform_feature_flags WHERE key = p_key), false)
$$;

-- ============================================
-- 3. Assinatura: status "pending" (aguardando liberação comercial)
-- ============================================
CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('starter', 'professional', 'business')),
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 30,
  status VARCHAR(20) NOT NULL,
  converted_to_paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.company_subscriptions'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE company_subscriptions DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
ALTER TABLE company_subscriptions ADD CONSTRAINT company_subscriptions_status_check
  CHECK (status IN ('pending', 'trial', 'active', 'expired', 'suspended', 'canceled'));

-- Direitos da empresa do chamador. O frontend só reflete este resultado.
-- Empresa sem linha de assinatura (clientes criados antes da 011) continua liberada.
CREATE OR REPLACE FUNCTION get_company_entitlements()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_sub RECORD;
  v_status TEXT;
  v_can_operate BOOLEAN;
BEGIN
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('authenticated', auth.uid() IS NOT NULL, 'has_company', false,
      'can_operate', false, 'fiscal_enabled', false, 'reason', 'no_active_membership');
  END IF;

  SELECT status, trial_end_date INTO v_sub
  FROM company_subscriptions WHERE company_id = v_company;

  IF NOT FOUND THEN
    v_status := 'legacy';
    v_can_operate := true;
  ELSE
    v_status := CASE WHEN v_sub.status = 'trial' AND v_sub.trial_end_date <= NOW() THEN 'expired' ELSE v_sub.status END;
    v_can_operate := v_status IN ('trial', 'active');
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'has_company', true,
    'company_id', v_company,
    'user_id', current_app_user_id(),
    'role', current_user_role(),
    'subscription_status', v_status,
    'trial_end_date', CASE WHEN v_status IN ('trial', 'expired') THEN v_sub.trial_end_date END,
    'can_operate', v_can_operate,
    'fiscal_enabled', platform_flag('FISCAL_ENABLED'),
    'auto_trial', platform_flag('AUTO_TRIAL'),
    'reason', CASE WHEN v_can_operate THEN NULL ELSE 'subscription_' || v_status END
  );
END;
$$;

CREATE OR REPLACE FUNCTION company_can_operate(p_company UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN s.company_id IS NULL THEN true
    WHEN s.status = 'active' THEN true
    WHEN s.status = 'trial' AND s.trial_end_date > NOW() THEN true
    ELSE false END
  FROM (SELECT p_company AS id) x
  LEFT JOIN company_subscriptions s ON s.company_id = x.id
$$;

-- Liberação da avaliação pela equipe (somente service_role / SQL do painel).
CREATE OR REPLACE FUNCTION approve_company_evaluation(p_company_id UUID, p_days INTEGER DEFAULT 30)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RAISE EXCEPTION 'p_days fora do intervalo 1..90';
  END IF;
  UPDATE company_subscriptions
  SET status = 'trial', trial_started_at = NOW(), trial_days = p_days,
      trial_end_date = NOW() + make_interval(days => p_days), updated_at = NOW()
  WHERE company_id = p_company_id AND status IN ('pending', 'expired');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa sem assinatura pendente/expirada: %', p_company_id;
  END IF;
END;
$$;

-- ============================================
-- 4. Cadastro: empresa + vínculo criados no servidor
-- ============================================
CREATE OR REPLACE FUNCTION bootstrap_company_for_auth_user(
  p_auth_id UUID, p_email TEXT, p_full_name TEXT, p_company_name TEXT, p_cnpj TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company UUID;
  v_user UUID;
BEGIN
  SELECT company_id INTO v_company FROM users WHERE auth_id = p_auth_id;
  IF v_company IS NOT NULL THEN
    RETURN v_company; -- idempotente
  END IF;

  IF coalesce(length(trim(p_company_name)), 0) < 2 THEN RAISE EXCEPTION 'Nome da loja inválido'; END IF;
  IF coalesce(length(trim(p_full_name)), 0) < 3 THEN RAISE EXCEPTION 'Nome inválido'; END IF;
  IF p_cnpj IS NULL OR p_cnpj !~ '^\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}$' THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE cnpj = p_cnpj) THEN
    RAISE EXCEPTION 'CNPJ já cadastrado';
  END IF;

  INSERT INTO companies (name, cnpj, email, plan, status)
  VALUES (trim(p_company_name), p_cnpj, p_email, 'starter', 'active')
  RETURNING id INTO v_company;

  INSERT INTO users (company_id, auth_id, email, full_name, role, is_active)
  VALUES (v_company, p_auth_id, p_email, trim(p_full_name), 'owner', true)
  RETURNING id INTO v_user;

  -- Sem teste automático: a avaliação fica "pending" até a liberação comercial.
  INSERT INTO company_subscriptions (company_id, plan, trial_started_at, trial_end_date, trial_days, status)
  VALUES (v_company, 'starter', NOW(), NOW(), 0,
          CASE WHEN platform_flag('AUTO_TRIAL') THEN 'trial' ELSE 'pending' END);
  IF platform_flag('AUTO_TRIAL') THEN
    UPDATE company_subscriptions SET trial_days = 30, trial_end_date = NOW() + interval '30 days'
    WHERE company_id = v_company;
  END IF;

  INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (v_company, v_user, 'company.bootstrap', 'company', v_company,
          jsonb_build_object('source', 'signup'));
  RETURN v_company;
END;
$$;

-- RPC chamada pelo navegador logado (fallback se o gatilho não criou a empresa).
CREATE OR REPLACE FUNCTION bootstrap_my_company(p_full_name TEXT, p_company_name TEXT, p_cnpj TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_company UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  v_company := bootstrap_company_for_auth_user(v_uid, v_email, p_full_name, p_company_name, p_cnpj);
  RETURN jsonb_build_object('success', true, 'company_id', v_company);
END;
$$;

-- Gatilho em auth.users: funciona também com confirmação de e-mail ligada.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'company_name' THEN
    BEGIN
      PERFORM bootstrap_company_for_auth_user(
        NEW.id, NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'company_name',
        NEW.raw_user_meta_data->>'cnpj');
    EXCEPTION WHEN OTHERS THEN
      -- Não bloqueia a criação do login; a empresa pode ser criada depois por bootstrap_my_company.
      RAISE WARNING 'bootstrap falhou para %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap ON auth.users;
CREATE TRIGGER on_auth_user_created_bootstrap
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================
-- 5. Policies: recriação limpa em todas as tabelas de empresa
-- ============================================
DO $$
DECLARE
  t TEXT;
  r RECORD;
  v_tables TEXT[] := ARRAY['companies','users','audit_logs','categories','products','stock_movements',
    'customers','suppliers','sales','sale_items','payments','cash_registers','cash_movements',
    'financial_accounts','financial_categories','fiscal_configurations','product_fiscal_data',
    'fiscal_documents','fiscal_events','company_subscriptions','trial_notifications','platform_feature_flags'];
BEGIN
  FOREACH t IN ARRAY v_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;

  -- Leitura: membros ativos da própria empresa.
  FOREACH t IN ARRAY ARRAY['audit_logs','categories','products','stock_movements','customers','suppliers',
    'sales','cash_registers','cash_movements','financial_accounts','financial_categories',
    'fiscal_configurations','product_fiscal_data','fiscal_documents','fiscal_events',
    'company_subscriptions','trial_notifications'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('CREATE POLICY tenant_select ON public.%I FOR SELECT TO authenticated USING (company_id = get_user_company_id())', t);
  END LOOP;

  -- Escrita direta mantida (comportamento atual do app), sempre presa à empresa do chamador.
  FOREACH t IN ARRAY ARRAY['categories','products','customers','suppliers','stock_movements',
    'cash_registers','cash_movements','financial_accounts','financial_categories','product_fiscal_data'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id())', t);
    EXECUTE format('CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (company_id = get_user_company_id()) WITH CHECK (company_id = get_user_company_id())', t);
    EXECUTE format('CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (company_id = get_user_company_id())', t);
  END LOOP;
END $$;

-- Movimento de caixa só no caixa da própria empresa.
DROP POLICY IF EXISTS tenant_insert ON cash_movements;
CREATE POLICY tenant_insert ON cash_movements FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id()
    AND EXISTS (SELECT 1 FROM cash_registers cr WHERE cr.id = cash_register_id AND cr.company_id = get_user_company_id()));

-- Auditoria: só inserção na própria empresa; sem UPDATE/DELETE.
CREATE POLICY tenant_insert ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id());

-- Vendas, itens e pagamentos: leitura por empresa; escrita SOMENTE pelas RPCs.
CREATE POLICY tenant_select ON sale_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()));
CREATE POLICY tenant_select ON payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = payments.sale_id AND s.company_id = get_user_company_id()));

-- Empresa: ver a própria; dono atualiza (sem trocar status/plano pelo navegador, ver gatilho abaixo).
CREATE POLICY company_select ON companies FOR SELECT TO authenticated USING (id = get_user_company_id());
CREATE POLICY company_update ON companies FOR UPDATE TO authenticated
  USING (id = get_user_company_id() AND current_user_has_role(ARRAY['owner']::user_role[]))
  WITH CHECK (id = get_user_company_id());

-- Usuários: ver colegas; dono/admin gerenciam, sem recursão (helpers SECURITY DEFINER).
CREATE POLICY users_select ON users FOR SELECT TO authenticated USING (company_id = get_user_company_id());
CREATE POLICY users_insert ON users FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id()
    AND current_user_has_role(ARRAY['owner','admin']::user_role[])
    AND (role <> 'owner' OR current_user_has_role(ARRAY['owner']::user_role[])));
CREATE POLICY users_update ON users FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id() AND current_user_has_role(ARRAY['owner','admin']::user_role[]))
  WITH CHECK (company_id = get_user_company_id()
    AND (role <> 'owner' OR current_user_has_role(ARRAY['owner']::user_role[])));

-- Fiscal: configuração só dono/admin e só com o módulo ligado no servidor.
DO $$ BEGIN
  IF to_regclass('public.fiscal_configurations') IS NOT NULL THEN
    EXECUTE $p$CREATE POLICY fiscal_config_write ON fiscal_configurations FOR ALL TO authenticated
      USING (company_id = get_user_company_id() AND current_user_has_role(ARRAY['owner','admin']::user_role[]) AND platform_flag('FISCAL_ENABLED'))
      WITH CHECK (company_id = get_user_company_id() AND current_user_has_role(ARRAY['owner','admin']::user_role[]) AND platform_flag('FISCAL_ENABLED'))$p$;
  END IF;
END $$;
-- fiscal_documents / fiscal_events: sem escrita pelo navegador (emissão é do servidor).
-- company_subscriptions / trial_notifications: sem escrita pelo navegador.
-- platform_feature_flags: sem acesso direto; leitura via get_company_entitlements().

-- Navegador não altera status/plano/CNPJ da empresa.
-- SECURITY INVOKER de propósito: current_user precisa ser o papel do chamador.
CREATE OR REPLACE FUNCTION guard_company_protected_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND
     (NEW.status IS DISTINCT FROM OLD.status OR NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.cnpj IS DISTINCT FROM OLD.cnpj OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Campos protegidos da empresa não podem ser alterados pelo aplicativo';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_company_protected ON companies;
CREATE TRIGGER trg_guard_company_protected BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION guard_company_protected_columns();

-- Usuário não muda o próprio vínculo nem o auth_id.
-- SECURITY INVOKER de propósito: current_user precisa ser o papel do chamador.
CREATE OR REPLACE FUNCTION guard_user_protected_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND
     (NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.auth_id IS DISTINCT FROM OLD.auth_id) THEN
    RAISE EXCEPTION 'Vínculo do usuário não pode ser alterado pelo aplicativo';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_user_protected ON users;
CREATE TRIGGER trg_guard_user_protected BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_user_protected_columns();

-- ============================================
-- 6. Venda atômica com identidade do servidor
-- ============================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname IN ('create_atomic_sale', 'cancel_sale_with_reversal') LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;

CREATE FUNCTION create_atomic_sale(
  p_items JSONB,
  p_payments JSONB,
  p_cash_register_id UUID DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_discount DECIMAL DEFAULT 0,
  p_additional_expenses DECIMAL DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL,
  -- Compatibilidade: ignorados como fonte de verdade; se enviados e divergentes, recusa.
  p_company_id UUID DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_operator UUID := current_app_user_id();
  v_sale_id UUID;
  v_sale_number INTEGER;
  v_subtotal DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2);
  v_total_payments DECIMAL(10,2) := 0;
  v_item JSONB;
  v_payment JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price DECIMAL(10,2);
  v_item_discount DECIMAL(10,2);
  v_item_subtotal DECIMAL(10,2);
  v_cost DECIMAL(10,2);
  v_balance INTEGER;
  v_method TEXT;
  v_amount DECIMAL(10,2);
  v_installments INTEGER;
  v_cash_amount DECIMAL(10,2) := 0;
  v_existing UUID;
  v_n INTEGER;
BEGIN
  IF v_company IS NULL OR v_operator IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa ativa';
  END IF;
  IF p_company_id IS NOT NULL AND p_company_id <> v_company THEN
    RAISE EXCEPTION 'Empresa informada não corresponde ao usuário autenticado';
  END IF;
  IF p_operator_id IS NOT NULL AND p_operator_id <> v_operator THEN
    RAISE EXCEPTION 'Operador informado não corresponde ao usuário autenticado';
  END IF;
  IF NOT company_can_operate(v_company) THEN
    RAISE EXCEPTION 'Assinatura da empresa não permite vendas';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Venda sem itens';
  END IF;
  IF coalesce(p_discount, 0) < 0 OR coalesce(p_additional_expenses, 0) < 0 THEN
    RAISE EXCEPTION 'Valores negativos não são permitidos';
  END IF;

  -- Serializa vendas da empresa (número sequencial e idempotência sem corrida).
  PERFORM 1 FROM companies WHERE id = v_company FOR UPDATE;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing FROM sales WHERE company_id = v_company AND idempotency_key = p_idempotency_key;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'sale_id', v_existing, 'message', 'Sale already exists (idempotent)');
    END IF;
  END IF;

  IF p_cash_register_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM cash_registers WHERE id = p_cash_register_id AND company_id = v_company AND status = 'open') THEN
      RAISE EXCEPTION 'Caixa não encontrado, de outra empresa ou fechado';
    END IF;
  END IF;

  IF p_customer_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND company_id = v_company) THEN
    RAISE EXCEPTION 'Cliente não pertence à empresa';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::DECIMAL;
    v_item_discount := COALESCE((v_item->>'discount')::DECIMAL, 0);
    IF v_quantity IS NULL OR v_quantity <= 0 OR v_unit_price IS NULL OR v_unit_price < 0 OR v_item_discount < 0 THEN
      RAISE EXCEPTION 'Item inválido';
    END IF;
    v_subtotal := v_subtotal + (v_quantity * v_unit_price) - v_item_discount;
  END LOOP;

  v_total := v_subtotal - coalesce(p_discount, 0) + coalesce(p_additional_expenses, 0);

  FOR v_payment IN SELECT * FROM jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) LOOP
    v_total_payments := v_total_payments + (v_payment->>'amount')::DECIMAL;
  END LOOP;
  IF ABS(v_total_payments - v_total) > 0.01 THEN
    RAISE EXCEPTION 'Payment total (%) does not match sale total (%)', v_total_payments, v_total;
  END IF;

  SELECT COALESCE(MAX(sale_number), 0) + 1 INTO v_sale_number FROM sales WHERE company_id = v_company;

  INSERT INTO sales (company_id, sale_number, customer_id, operator_id, salesperson_id, cash_register_id,
                     subtotal, discount, additional_expenses, total, status, notes, sale_date, idempotency_key)
  VALUES (v_company, v_sale_number, p_customer_id, v_operator, v_operator, p_cash_register_id,
          v_subtotal, coalesce(p_discount, 0), coalesce(p_additional_expenses, 0), v_total, 'completed',
          p_notes, NOW(), p_idempotency_key)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'productId')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_unit_price := (v_item->>'unitPrice')::DECIMAL;
    v_item_discount := COALESCE((v_item->>'discount')::DECIMAL, 0);
    v_item_subtotal := (v_quantity * v_unit_price) - v_item_discount;

    -- Baixa condicional: só debita se houver saldo e o produto for da empresa.
    UPDATE products
    SET stock_quantity = stock_quantity - v_quantity, updated_at = NOW()
    WHERE id = v_product_id AND company_id = v_company AND stock_quantity >= v_quantity
    RETURNING cost_price, stock_quantity INTO v_cost, v_balance;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      IF EXISTS (SELECT 1 FROM products WHERE id = v_product_id AND company_id = v_company) THEN
        RAISE EXCEPTION 'Insufficient stock for product: %', v_product_id;
      END IF;
      RAISE EXCEPTION 'Product not found or does not belong to company: %', v_product_id;
    END IF;

    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, discount, total, cost_price)
    VALUES (v_sale_id, v_product_id, v_quantity, v_unit_price, v_item_discount, v_item_subtotal, v_cost);

    INSERT INTO stock_movements (company_id, product_id, user_id, type, quantity, reason, reference_type, reference_id, balance_after)
    VALUES (v_company, v_product_id, v_operator, 'out', v_quantity, 'Venda #' || v_sale_number, 'sale', v_sale_id, v_balance);
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) LOOP
    v_method := v_payment->>'method';
    v_amount := (v_payment->>'amount')::DECIMAL;
    v_installments := COALESCE((v_payment->>'installments')::INTEGER, 1);
    INSERT INTO payments (sale_id, method, amount, installments) VALUES (v_sale_id, v_method, v_amount, v_installments);
    IF v_method = 'cash' THEN v_cash_amount := v_cash_amount + v_amount; END IF;

    IF v_method = 'credit_card' AND v_installments > 1 THEN
      FOR v_n IN 1..v_installments LOOP
        INSERT INTO financial_accounts (company_id, type, description, amount, due_date, category, status,
                                        reference_type, reference_id, person_id, person_type)
        VALUES (v_company, 'receivable',
                'Venda #' || v_sale_number || ' - Parcela ' || v_n || '/' || v_installments,
                round(v_amount / v_installments, 2), (NOW() + make_interval(months => v_n))::date,
                'Vendas', 'pending', 'sale', v_sale_id, p_customer_id, 'customer');
      END LOOP;
    END IF;
  END LOOP;

  IF v_cash_amount > 0 AND p_cash_register_id IS NOT NULL THEN
    UPDATE cash_registers SET total_sales = total_sales + v_cash_amount, updated_at = NOW()
    WHERE id = p_cash_register_id AND company_id = v_company;
    INSERT INTO cash_movements (cash_register_id, company_id, user_id, operator_id, type, amount, description,
                                reference_type, reference_id, balance_after)
    SELECT id, v_company, v_operator, v_operator, 'sale', v_cash_amount, 'Venda #' || v_sale_number,
           'sale', v_sale_id, initial_amount + total_sales + total_deposits - total_withdrawals
    FROM cash_registers WHERE id = p_cash_register_id;
  END IF;

  INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (v_company, v_operator, 'sale.create', 'sale', v_sale_id,
          jsonb_build_object('sale_number', v_sale_number, 'total', v_total, 'items_count', jsonb_array_length(p_items)));

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'sale_number', v_sale_number, 'total', v_total);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE FUNCTION cancel_sale_with_reversal(
  p_sale_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company UUID := get_user_company_id();
  v_operator UUID := current_app_user_id();
  v_sale RECORD;
  v_item RECORD;
  v_balance INTEGER;
  v_cash_amount DECIMAL(10,2) := 0;
BEGIN
  IF v_company IS NULL OR v_operator IS NULL THEN RAISE EXCEPTION 'Usuário sem empresa ativa'; END IF;
  IF p_company_id IS NOT NULL AND p_company_id <> v_company THEN
    RAISE EXCEPTION 'Empresa informada não corresponde ao usuário autenticado';
  END IF;
  IF p_operator_id IS NOT NULL AND p_operator_id <> v_operator THEN
    RAISE EXCEPTION 'Operador informado não corresponde ao usuário autenticado';
  END IF;

  SELECT * INTO v_sale FROM sales WHERE id = p_sale_id AND company_id = v_company FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.status = 'cancelled' THEN RAISE EXCEPTION 'Sale already cancelled'; END IF;

  UPDATE sales SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = p_reason, updated_at = NOW()
  WHERE id = p_sale_id;

  FOR v_item IN SELECT product_id, quantity FROM sale_items WHERE sale_id = p_sale_id LOOP
    UPDATE products SET stock_quantity = stock_quantity + v_item.quantity, updated_at = NOW()
    WHERE id = v_item.product_id AND company_id = v_company
    RETURNING stock_quantity INTO v_balance;
    INSERT INTO stock_movements (company_id, product_id, user_id, type, quantity, reason, reference_type, reference_id, balance_after)
    VALUES (v_company, v_item.product_id, v_operator, 'in', v_item.quantity,
            'Cancelamento da venda #' || v_sale.sale_number, 'sale_cancellation', p_sale_id, coalesce(v_balance, 0));
  END LOOP;

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_amount FROM payments WHERE sale_id = p_sale_id AND method = 'cash';
  IF v_cash_amount > 0 AND v_sale.cash_register_id IS NOT NULL THEN
    UPDATE cash_registers SET total_sales = total_sales - v_cash_amount, updated_at = NOW()
    WHERE id = v_sale.cash_register_id AND company_id = v_company;
    INSERT INTO cash_movements (cash_register_id, company_id, user_id, operator_id, type, amount, description,
                                reference_type, reference_id, balance_after)
    SELECT id, v_company, v_operator, v_operator, 'refund', v_cash_amount, 'Estorno venda #' || v_sale.sale_number,
           'sale_cancellation', p_sale_id, initial_amount + total_sales + total_deposits - total_withdrawals
    FROM cash_registers WHERE id = v_sale.cash_register_id;
  END IF;

  UPDATE financial_accounts SET status = 'cancelled', updated_at = NOW()
  WHERE company_id = v_company AND reference_type = 'sale' AND reference_id = p_sale_id AND status = 'pending';

  INSERT INTO audit_logs (company_id, user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_company, v_operator, 'sale.cancel', 'sale', p_sale_id,
          jsonb_build_object('status', v_sale.status), jsonb_build_object('status', 'cancelled', 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'sale_id', p_sale_id, 'message', 'Sale cancelled successfully');
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- 7. Privilégios de execução (PUBLIC herda EXECUTE por padrão)
-- ============================================
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'get_user_company_id()', 'current_app_user_id()', 'current_user_role()', 'current_user_has_role(user_role[])',
    'platform_flag(text)', 'get_company_entitlements()', 'company_can_operate(uuid)',
    'approve_company_evaluation(uuid,integer)', 'bootstrap_company_for_auth_user(uuid,text,text,text,text)',
    'bootstrap_my_company(text,text,text)', 'handle_new_auth_user()',
    'create_atomic_sale(jsonb,jsonb,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid)',
    'cancel_sale_with_reversal(uuid,text,uuid,uuid)',
    'guard_company_protected_columns()', 'guard_user_protected_columns()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', f);
  END LOOP;
  -- Funções antigas com p_company_id vindo do cliente: bloqueadas para o navegador.
  IF to_regprocedure('is_trial_active(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION is_trial_active(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('get_remaining_trial_days(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION get_remaining_trial_days(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('update_subscription_statuses()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION update_subscription_statuses() FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('get_next_sale_number(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION get_next_sale_number(uuid) FROM PUBLIC, anon, authenticated;
  END IF;
  IF to_regprocedure('calculate_cash_balance(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION calculate_cash_balance(uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('create_company_rls_policies(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION create_company_rls_policies(text) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION get_user_company_id(), current_app_user_id(), current_user_role(),
  current_user_has_role(user_role[]), platform_flag(text), get_company_entitlements(),
  company_can_operate(uuid), bootstrap_my_company(text,text,text),
  create_atomic_sale(jsonb,jsonb,uuid,uuid,numeric,numeric,text,uuid,uuid,uuid),
  cancel_sale_with_reversal(uuid,text,uuid,uuid) TO authenticated;
-- O Supabase concede EXECUTE a authenticated por privilégio padrão: revogar das funções internas.
REVOKE ALL ON FUNCTION approve_company_evaluation(uuid,integer) FROM authenticated;
REVOKE ALL ON FUNCTION bootstrap_company_for_auth_user(uuid,text,text,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION handle_new_auth_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION approve_company_evaluation(uuid,integer) TO service_role;

-- Anônimo não lê nem escreve tabelas de empresa.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','users','audit_logs','categories','products','stock_movements',
    'customers','suppliers','sales','sale_items','payments','cash_registers','cash_movements',
    'financial_accounts','financial_categories','fiscal_configurations','product_fiscal_data',
    'fiscal_documents','fiscal_events','company_subscriptions','trial_notifications','platform_feature_flags'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;
-- Vendas/itens/pagamentos/auditoria/assinatura: navegador não escreve direto.
REVOKE INSERT, UPDATE, DELETE ON sales, sale_items, payments, company_subscriptions FROM authenticated;
REVOKE UPDATE, DELETE ON audit_logs FROM authenticated;
REVOKE ALL ON platform_feature_flags FROM authenticated;
