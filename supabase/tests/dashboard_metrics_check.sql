-- Venddi - Testes da função metricas_dashboard (migration 023)
-- Cobre: vendas concluídas por dia (cancelada fora), saldo do caixa com depósito,
-- sangria, venda e estorno (balance_after zerado de propósito), caixa fechado fora,
-- estoque baixo sem produto inativo, histórico antigo nas recentes e isolamento
-- entre empresas (RLS + get_user_company_id).
-- Executar com migrations 001..023 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/dashboard_metrics_check.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('44444444-4444-4444-4444-444444444444', 'Dash A', '44.444.444/0001-44', 'starter', 'active'),
  ('55555555-5555-5555-5555-555555555555', 'Dash B', '55.555.555/0001-55', 'starter', 'active');
-- Sem assinatura ativa a migration 016 não resolve a empresa (controle de trial).
INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('66666666-6666-6666-6666-666666666666', 'Dash C', '66.666.666/0001-66', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('44444444-4444-4444-4444-444444444444', 'starter', 'active', 15),
  ('55555555-5555-5555-5555-555555555555', 'starter', 'active', 15),
  ('66666666-6666-6666-6666-666666666666', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('f6000000-0000-4000-8000-000000000001', '66666666-6666-6666-6666-666666666666', 'f6000000-0000-4000-8000-0000000000c1', 'owner@dash-c.test', 'Owner C', 'owner', true);
INSERT INTO sales (company_id, sale_number, subtotal, total, status, sale_date) VALUES
  ('66666666-6666-6666-6666-666666666666', 1, 30, 30, 'completed', date_trunc('day', now()) - interval '10 days');
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('f4000000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-0000000000a1', 'owner@dash-a.test', 'Owner A', 'owner', true),
  ('f4000000-0000-4000-8000-000000000002', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-0000000000a2', 'caixa@dash-a.test', 'Caixa A', 'cashier', true),
  ('f5000000-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555', 'f5000000-0000-4000-8000-0000000000b1', 'owner@dash-b.test', 'Owner B', 'owner', true);

INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('f4100000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'D-1', 'Baixo', 1, 2, 1, 2, true),
  ('f4100000-0000-4000-8000-000000000002', '44444444-4444-4444-4444-444444444444', 'D-2', 'Ok', 1, 2, 9, 2, true),
  ('f4100000-0000-4000-8000-000000000003', '44444444-4444-4444-4444-444444444444', 'D-3', 'Inativo zerado', 1, 2, 0, 0, false);

-- Vendas: hoje (2 concluídas + 1 cancelada), ontem (1 concluída), antiga (10 dias)
INSERT INTO sales (company_id, sale_number, subtotal, total, status, sale_date) VALUES
  ('44444444-4444-4444-4444-444444444444', 1, 40, 40, 'completed', date_trunc('day', now())),
  ('44444444-4444-4444-4444-444444444444', 2, 60, 60, 'completed', date_trunc('day', now())),
  ('44444444-4444-4444-4444-444444444444', 3, 999, 999, 'cancelled', date_trunc('day', now())),
  ('44444444-4444-4444-4444-444444444444', 4, 100, 100, 'completed', date_trunc('day', now()) - interval '12 hours'),
  ('44444444-4444-4444-4444-444444444444', 5, 77, 77, 'completed', date_trunc('day', now()) - interval '10 days');

-- Caixa aberto da empresa A (valor inicial 100), caixa fechado (fora), caixa aberto da B
INSERT INTO cash_registers (id, company_id, user_id, status, initial_amount) VALUES
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'open', 100),
  ('f4200000-0000-4000-8000-000000000002', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'closed', 999),
  ('f5200000-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555', 'f5000000-0000-4000-8000-000000000001', 'open', 7777);

-- Dados da B para o isolamento não ser trivial: venda de hoje e produto no mínimo
INSERT INTO sales (company_id, sale_number, subtotal, total, status, sale_date) VALUES
  ('55555555-5555-5555-5555-555555555555', 1, 500, 500, 'completed', date_trunc('day', now()));
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('f5100000-0000-4000-8000-000000000001', '55555555-5555-5555-5555-555555555555', 'B-1', 'Baixo B', 1, 2, 0, 1, true);

-- Movimentos do caixa A: venda +40, depósito +50, sangria -30, estorno -10 (balance_after = 0)
-- Venda cancelada de hoje com venda e estorno no caixa: total e contagem não mudam, saldo fica neutro
INSERT INTO sales (company_id, sale_number, subtotal, total, status, sale_date) VALUES
  ('44444444-4444-4444-4444-444444444444', 6, 25, 25, 'cancelled', date_trunc('day', now()) + interval '2 hours');

INSERT INTO cash_movements (cash_register_id, company_id, user_id, type, amount, balance_after) VALUES
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'sale', 40, 0),
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'deposit', 50, 0),
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'withdrawal', 30, 0),
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'refund', 10, 0),
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'sale', 25, 0),
  ('f4200000-0000-4000-8000-000000000001', '44444444-4444-4444-4444-444444444444', 'f4000000-0000-4000-8000-000000000002', 'refund', 25, 0);

DO $$
DECLARE
  AUTH_A CONSTANT UUID := 'f4000000-0000-4000-8000-0000000000a1';
  AUTH_B CONSTANT UUID := 'f5000000-0000-4000-8000-0000000000b1';
  AUTH_C CONSTANT UUID := 'f6000000-0000-4000-8000-0000000000c1';
  hoje TIMESTAMPTZ := date_trunc('day', now());
  amanha TIMESTAMPTZ := date_trunc('day', now()) + interval '1 day';
  ontem TIMESTAMPTZ := date_trunc('day', now()) - interval '1 day';
  r JSONB;
BEGIN
  -- Dono da empresa A
  PERFORM set_config('request.jwt.claim.sub', AUTH_A::text, true);
  SET LOCAL ROLE authenticated;
  r := metricas_dashboard(ontem, hoje, amanha);
  RESET ROLE;

  IF (r->'vendas_hoje'->>'total')::numeric <> 100 OR (r->'vendas_hoje'->>'count')::int <> 2 THEN
    RAISE EXCEPTION 'FALHOU: vendas de hoje %', r->'vendas_hoje';
  END IF;
  IF (r->'vendas_ontem'->>'total')::numeric <> 100 OR (r->'vendas_ontem'->>'count')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: vendas de ontem %', r->'vendas_ontem';
  END IF;
  IF (r->>'estoque_baixo')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: estoque baixo % (esperado 1, produto inativo não conta)', r->>'estoque_baixo';
  END IF;
  -- 100 inicial + 40 venda + 50 depósito - 30 sangria - 10 estorno = 150
  IF (r->>'saldo_caixa')::numeric <> 150 THEN
    RAISE EXCEPTION 'FALHOU: saldo do caixa % (esperado 150)', r->>'saldo_caixa';
  END IF;
  IF jsonb_array_length(r->'recentes') <> 5 THEN
    RAISE EXCEPTION 'FALHOU: recentes deveria trazer 5 vendas, veio %', jsonb_array_length(r->'recentes');
  END IF;
  IF (r->'recentes'->0->>'sale_number')::int <> 6 THEN
    RAISE EXCEPTION 'FALHOU: a mais recente deveria ser a venda 6 (cancelada): %', r->'recentes'->0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'recentes') x WHERE (x->>'sale_number')::int = 6 AND x->>'status' = 'cancelled') THEN
    RAISE EXCEPTION 'FALHOU: venda cancelada deveria aparecer nas recentes com status cancelled';
  END IF;

  -- Empresa C: único histórico é antigo (10 dias). Recentes não podem ficar vazias por causa do corte de data.
  PERFORM set_config('request.jwt.claim.sub', AUTH_C::text, true);
  SET LOCAL ROLE authenticated;
  r := metricas_dashboard(ontem, hoje, amanha);
  RESET ROLE;
  IF jsonb_array_length(r->'recentes') <> 1 OR (r->'recentes'->0->>'sale_number')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: empresa C deveria ver a venda antiga nas recentes: %', r->'recentes';
  END IF;
  IF (r->'vendas_hoje'->>'count')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: empresa C não deveria ter vendas de hoje';
  END IF;

  -- Dona da empresa B: vê só os próprios indicadores (venda de 500, 1 produto no mínimo,
  -- caixa de 7777) e nada da A (vendas de 100, estoque baixo 1, saldo 150, 6 vendas)
  PERFORM set_config('request.jwt.claim.sub', AUTH_B::text, true);
  SET LOCAL ROLE authenticated;
  r := metricas_dashboard(ontem, hoje, amanha);
  RESET ROLE;

  IF (r->'vendas_hoje'->>'total')::numeric <> 500 OR (r->'vendas_hoje'->>'count')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: vendas de hoje da B % (esperado 500 e 1; vazamento se 100)', r->'vendas_hoje';
  END IF;
  IF (r->'vendas_ontem'->>'count')::int <> 0 THEN
    RAISE EXCEPTION 'FALHOU: vendas de ontem da B %', r->'vendas_ontem';
  END IF;
  IF (r->>'estoque_baixo')::int <> 1 THEN
    RAISE EXCEPTION 'FALHOU: estoque baixo da B % (esperado 1, o produto dela)', r->>'estoque_baixo';
  END IF;
  IF (r->>'saldo_caixa')::numeric <> 7777 THEN
    RAISE EXCEPTION 'FALHOU: saldo da B % (esperado 7777, só o próprio caixa)', r->>'saldo_caixa';
  END IF;
  IF jsonb_array_length(r->'recentes') <> 1 OR (r->'recentes'->0->>'total')::numeric <> 500 THEN
    RAISE EXCEPTION 'FALHOU: recentes da B deveria trazer só a venda de 500: %', r->'recentes';
  END IF;

  -- Sem usuário autenticado: nada é devolvido (get_user_company_id é nulo)
  PERFORM set_config('request.jwt.claim.sub', '', true);
  SET LOCAL ROLE authenticated;
  r := metricas_dashboard(ontem, hoje, amanha);
  RESET ROLE;
  IF (r->'vendas_hoje'->>'count')::int <> 0 OR (r->>'saldo_caixa')::numeric <> 0 THEN
    RAISE EXCEPTION 'FALHOU: dados sem usuário autenticado %', r;
  END IF;

  -- Listagem de estoque baixo (view produtos_estoque_baixo) segue o mesmo isolamento
  -- e a mesma regra do indicador do painel.
  PERFORM set_config('request.jwt.claim.sub', AUTH_A::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM produtos_estoque_baixo) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: view de estoque baixo da A deveria ter 1 produto';
  END IF;
  IF EXISTS (SELECT 1 FROM produtos_estoque_baixo WHERE company_id <> '44444444-4444-4444-4444-444444444444') THEN
    RAISE EXCEPTION 'FALHOU: view de estoque baixo vazou produto de outra empresa';
  END IF;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', AUTH_B::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM produtos_estoque_baixo) <> 1 OR EXISTS (SELECT 1 FROM produtos_estoque_baixo WHERE sku = 'D-1') THEN
    RAISE EXCEPTION 'FALHOU: view de estoque baixo da B deveria trazer só o produto dela';
  END IF;
  RESET ROLE;
END $$;

SELECT 'DASHBOARD METRICS OK' AS r;
ROLLBACK;
