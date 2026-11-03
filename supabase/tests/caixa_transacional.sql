-- Venddi - Caixa transacional (migration 029). Cobre abertura, sangria, suprimento, fechamento,
-- idempotência, permissões, isolamento entre empresas, caixa fechado e estorno em caixa fechado.
-- Executar com migrations 001..029 aplicadas:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/caixa_transacional.sql
-- Tudo roda dentro de BEGIN/ROLLBACK.

BEGIN;

INSERT INTO companies (id, name, cnpj, plan, status) VALUES
  ('c4111111-1111-4111-8111-111111111111', 'Caixa Tx A', '94.111.111/0001-11', 'starter', 'active'),
  ('c4222222-2222-4222-8222-222222222222', 'Caixa Tx B', '94.222.222/0001-22', 'starter', 'active');
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES
  ('c4111111-1111-4111-8111-111111111111', 'starter', 'active', 15),
  ('c4222222-2222-4222-8222-222222222222', 'starter', 'active', 15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'c4111111-1111-4111-8111-111111111111', 'c4000000-0000-4000-8000-0000000000a1', 'owner@cxtx.test', 'Owner A', 'owner', true),
  ('c4000000-0000-4000-8000-000000000002', 'c4111111-1111-4111-8111-111111111111', 'c4000000-0000-4000-8000-0000000000a2', 'caixa1@cxtx.test', 'Caixa 1', 'cashier', true),
  ('c4000000-0000-4000-8000-000000000003', 'c4111111-1111-4111-8111-111111111111', 'c4000000-0000-4000-8000-0000000000a3', 'vend@cxtx.test', 'Vendedor', 'salesperson', true),
  ('c4000000-0000-4000-8000-000000000004', 'c4111111-1111-4111-8111-111111111111', 'c4000000-0000-4000-8000-0000000000a4', 'caixa2@cxtx.test', 'Caixa 2', 'cashier', true),
  ('c4000000-0000-4000-8000-000000000005', 'c4111111-1111-4111-8111-111111111111', 'c4000000-0000-4000-8000-0000000000a5', 'gerente@cxtx.test', 'Gerente', 'manager', true),
  ('c4000000-0000-4000-8000-000000000006', 'c4222222-2222-4222-8222-222222222222', 'c4000000-0000-4000-8000-0000000000a6', 'owner@cxtxb.test', 'Owner B', 'owner', true);
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active) VALUES
  ('c4100000-0000-4000-8000-000000000001', 'c4111111-1111-4111-8111-111111111111', 'CX-1', 'Produto caixa', 1, 10, 50, 1, true);

CREATE OR REPLACE FUNCTION pg_temp.as_auth(p_auth UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);
  EXECUTE 'SET ROLE authenticated';
END;
$$;

-- Espera que a chamada falhe com a mensagem dada (RPC que lança exceção).
CREATE OR REPLACE FUNCTION pg_temp.expect_fail(p_label TEXT, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION 'FALHOU %: deveria ter sido recusado', p_label;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%' || p_msg || '%' THEN
    RAISE EXCEPTION 'FALHOU %: mensagem inesperada: %', p_label, SQLERRM;
  END IF;
END;
$$;

-- Espera que a RPC devolva {success:false} com a mensagem dada (venda e estorno devolvem JSON).
CREATE OR REPLACE FUNCTION pg_temp.expect_json_fail(p_label TEXT, p_sql TEXT, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_res JSONB;
BEGIN
  EXECUTE p_sql INTO v_res;
  IF (v_res->>'success') IS DISTINCT FROM 'false' OR POSITION(p_msg IN (v_res->>'error')) = 0 THEN
    RAISE EXCEPTION 'FALHOU %: resultado inesperado: %', p_label, v_res;
  END IF;
END;
$$;

DO $$
DECLARE
  OWNER_A CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a1';
  CAIXA1 CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a2';
  VENDEDOR CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a3';
  CAIXA2 CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a4';
  GERENTE CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a5';
  OWNER_B CONSTANT UUID := 'c4000000-0000-4000-8000-0000000000a6';
  U_OWNER_A CONSTANT UUID := 'c4000000-0000-4000-8000-000000000001';
  U_CAIXA1 CONSTANT UUID := 'c4000000-0000-4000-8000-000000000002';
  U_VEND CONSTANT UUID := 'c4000000-0000-4000-8000-000000000003';
  U_CAIXA2 CONSTANT UUID := 'c4000000-0000-4000-8000-000000000004';
  CO CONSTANT UUID := 'c4111111-1111-4111-8111-111111111111';
  PRODUTO CONSTANT UUID := 'c4100000-0000-4000-8000-000000000001';
  v_res JSONB;
  v_cr UUID;
  v_cr2 UUID;
  n INTEGER;
  v_saldo NUMERIC;
  v_status TEXT;
  v_diff NUMERIC;
  v_esperado NUMERIC;
  v_total_sales NUMERIC;
  v_sale_json JSONB;
BEGIN
  -- 1. Abertura ---------------------------------------------------------------------------
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := abrir_caixa(CO, 100, 'chave-abrir-1', 'abertura do dia');
  v_cr := (v_res->>'cash_register_id')::UUID;
  RESET ROLE;
  IF (v_res->>'success')::boolean IS NOT TRUE OR (v_res->>'replay')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'FALHOU 1: abertura não retornou sucesso: %', v_res;
  END IF;

  -- 2. Dois caixas abertos para o mesmo operador: recusado
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('2 abrir mesmo operador',
    $q$SELECT abrir_caixa('c4111111-1111-4111-8111-111111111111', 50, 'chave-abrir-2')$q$,
    'Já existe caixa aberto para este operador');
  RESET ROLE;

  -- 3. Repetição com a mesma chave devolve o resultado original, sem novo caixa
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := abrir_caixa(CO, 100, 'chave-abrir-1', 'abertura do dia');
  RESET ROLE;
  IF (v_res->>'replay')::boolean IS NOT TRUE OR (v_res->>'cash_register_id')::UUID <> v_cr THEN
    RAISE EXCEPTION 'FALHOU 3: replay de abertura não devolveu o caixa original: %', v_res;
  END IF;
  SELECT COUNT(*) INTO n FROM cash_registers WHERE user_id = U_CAIXA1;
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 3: replay criou caixa (% caixas)', n; END IF;

  -- 4. Mesma chave com outros dados: recusado
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('4 chave reutilizada',
    $q$SELECT abrir_caixa('c4111111-1111-4111-8111-111111111111', 999, 'chave-abrir-1')$q$,
    'Chave de idempotência já usada com outros dados');
  RESET ROLE;

  -- 5. Vendedor não abre caixa; empresa diferente não abre na empresa A
  PERFORM pg_temp.as_auth(VENDEDOR);
  PERFORM pg_temp.expect_fail('5 vendedor abre',
    $q$SELECT abrir_caixa('c4111111-1111-4111-8111-111111111111', 10, 'chave-vend-1')$q$,
    'Papel sem permissão para abrir caixa');
  RESET ROLE;
  PERFORM pg_temp.as_auth(OWNER_B);
  PERFORM pg_temp.expect_fail('5 owner B abre na empresa A',
    $q$SELECT abrir_caixa('c4111111-1111-4111-8111-111111111111', 10, 'chave-ownerb-1')$q$,
    'Acesso negado: empresa diferente da sessão');
  RESET ROLE;

  -- 6. Sangria: saldo e totais
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := registrar_movimento_caixa(v_cr, 'withdrawal', 30, 'Troco retirado', 'chave-sangria-1');
  RESET ROLE;
  IF (v_res->>'balance_after')::numeric <> 70 THEN
    RAISE EXCEPTION 'FALHOU 6: saldo após sangria deveria ser 70: %', v_res;
  END IF;
  SELECT total_withdrawals INTO v_saldo FROM cash_registers WHERE id = v_cr;
  IF v_saldo <> 30 THEN RAISE EXCEPTION 'FALHOU 6: total_withdrawals deveria ser 30 (%)', v_saldo; END IF;

  -- 7. Sangria acima do saldo: recusada
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('7 sangria acima do saldo',
    format($q$SELECT registrar_movimento_caixa('%s', 'withdrawal', 1000, 'Sangria grande', 'chave-sangria-big')$q$, v_cr),
    'Sangria maior que o saldo do caixa');
  RESET ROLE;
  -- Falha não grava nada: a sangria recusada não entra no razão nem nos totais
  SELECT COUNT(*) INTO n FROM cash_movements WHERE cash_register_id = v_cr AND type = 'withdrawal';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 7: sangria recusada gravou movimento (% sangrias)', n; END IF;
  SELECT total_withdrawals INTO v_saldo FROM cash_registers WHERE id = v_cr;
  IF v_saldo <> 30 THEN RAISE EXCEPTION 'FALHOU 7: sangria recusada alterou o total (%)', v_saldo; END IF;

  -- 8. Suprimento e repetição sem duplicar
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := registrar_movimento_caixa(v_cr, 'deposit', 20, 'Reforço de troco', 'chave-supr-1');
  v_res := registrar_movimento_caixa(v_cr, 'deposit', 20, 'Reforço de troco', 'chave-supr-1');
  RESET ROLE;
  IF (v_res->>'replay')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU 8: repetição de suprimento não foi reconhecida: %', v_res;
  END IF;
  SELECT COUNT(*) INTO n FROM cash_movements WHERE cash_register_id = v_cr AND type = 'deposit';
  IF n <> 1 THEN RAISE EXCEPTION 'FALHOU 8: suprimento duplicado (% movimentos)', n; END IF;

  -- 9. Descrição obrigatória e valor positivo
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('9 sem descrição',
    format($q$SELECT registrar_movimento_caixa('%s', 'deposit', 5, '  ', 'chave-desc-1')$q$, v_cr),
    'Descrição obrigatória');
  PERFORM pg_temp.expect_fail('9 valor zero',
    format($q$SELECT registrar_movimento_caixa('%s', 'deposit', 0, 'Zero', 'chave-zero-1')$q$, v_cr),
    'Valor deve ser maior que zero');
  RESET ROLE;

  -- 10. Permissões de movimento: vendedor recusado; outro caixa recusado; gerente aceito
  PERFORM pg_temp.as_auth(VENDEDOR);
  PERFORM pg_temp.expect_fail('10 vendedor sangria',
    format($q$SELECT registrar_movimento_caixa('%s', 'withdrawal', 5, 'Sangria vendedor', 'chave-vend-s')$q$, v_cr),
    'Papel sem permissão para movimentar caixa');
  RESET ROLE;
  PERFORM pg_temp.as_auth(CAIXA2);
  PERFORM pg_temp.expect_fail('10 caixa 2 mexe no caixa 1',
    format($q$SELECT registrar_movimento_caixa('%s', 'withdrawal', 5, 'Sangria alheia', 'chave-alheia-1')$q$, v_cr),
    'Só o operador do caixa ou a gerência pode movimentar este caixa');
  RESET ROLE;
  PERFORM pg_temp.as_auth(GERENTE);
  v_res := registrar_movimento_caixa(v_cr, 'deposit', 10, 'Suprimento da gerência', 'chave-gerente-1');
  RESET ROLE;
  IF (v_res->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU 10: gerente não conseguiu movimentar: %', v_res;
  END IF;

  -- 11. Venda em caixa aberto (cash 10) entra no saldo
  PERFORM pg_temp.as_auth(CAIXA1);
  v_sale_json := create_atomic_sale(CO, U_CAIXA1, v_cr,
    format('[{"productId":"%s","quantity":1,"unitPrice":10,"discount":0}]', PRODUTO)::jsonb,
    '[{"method":"cash","amount":10}]'::jsonb);
  RESET ROLE;
  IF (v_sale_json->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU 11: venda em caixa aberto não foi registrada: %', v_sale_json;
  END IF;

  -- 12. Fechamento com divergência exige observação
  -- Saldo esperado: 100 + 10 (venda) + 20 (suprimento) + 10 (gerente) - 30 (sangria) = 110
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('12 divergência sem observação',
    format($q$SELECT fechar_caixa('%s', 100, 'chave-fech-sem-obs')$q$, v_cr),
    'exige observação');
  RESET ROLE;

  -- 13. Fechamento com divergência e observação grava a diferença
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := fechar_caixa(v_cr, 100, 'chave-fech-1', 'Faltaram 10 reais, conferido com o operador');
  RESET ROLE;
  v_esperado := (v_res->>'expected_balance')::numeric;
  v_diff := (v_res->>'difference')::numeric;
  IF v_esperado <> 110 OR v_diff <> -10 THEN
    RAISE EXCEPTION 'FALHOU 13: fechamento deveria esperar 110 e diferença -10: %', v_res;
  END IF;
  SELECT status, closing_difference INTO v_status, v_diff FROM cash_registers WHERE id = v_cr;
  IF v_status <> 'closed' OR v_diff <> -10 THEN
    RAISE EXCEPTION 'FALHOU 13: caixa não ficou fechado com a diferença gravada (% %)', v_status, v_diff;
  END IF;

  -- 14. Repetir o fechamento com a mesma chave não fecha de novo nem altera o registro
  PERFORM pg_temp.as_auth(CAIXA1);
  v_res := fechar_caixa(v_cr, 100, 'chave-fech-1', 'Faltaram 10 reais, conferido com o operador');
  RESET ROLE;
  IF (v_res->>'replay')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'FALHOU 14: repetição de fechamento não foi reconhecida: %', v_res;
  END IF;

  -- 15. Movimento em caixa fechado: recusado
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_fail('15 sangria em caixa fechado',
    format($q$SELECT registrar_movimento_caixa('%s', 'withdrawal', 5, 'Depois do fechamento', 'chave-pos-1')$q$, v_cr),
    'Caixa fechado');
  PERFORM pg_temp.expect_fail('15 fechar caixa já fechado',
    format($q$SELECT fechar_caixa('%s', 110, 'chave-fech-2', 'Segunda tentativa')$q$, v_cr),
    'Caixa já está fechado');
  RESET ROLE;

  -- 16. Venda em caixa fechado: recusada, total do caixa não muda
  SELECT total_sales INTO v_total_sales FROM cash_registers WHERE id = v_cr;
  PERFORM pg_temp.as_auth(CAIXA1);
  PERFORM pg_temp.expect_json_fail('16 venda em caixa fechado',
    format($q$SELECT create_atomic_sale('%s', '%s', '%s', '[{"productId":"%s","quantity":1,"unitPrice":10,"discount":0}]'::jsonb, '[{"method":"cash","amount":10}]'::jsonb)$q$, CO, U_CAIXA1, v_cr, PRODUTO),
    'Caixa fechado');
  RESET ROLE;
  IF (SELECT total_sales FROM cash_registers WHERE id = v_cr) <> v_total_sales THEN
    RAISE EXCEPTION 'FALHOU 16: total de vendas mudou em caixa fechado';
  END IF;

  -- 17. Estorno de venda de caixa fechado: recusado
  SELECT id INTO v_cr2 FROM sales WHERE company_id = CO AND cash_register_id = v_cr LIMIT 1;
  PERFORM pg_temp.as_auth(OWNER_A);
  PERFORM pg_temp.expect_json_fail('17 estorno em caixa fechado',
    format($q$SELECT cancel_sale_with_reversal('%s', '%s', '%s', 'Teste')$q$, v_cr2, CO, U_OWNER_A),
    'Caixa da venda já foi fechado');
  RESET ROLE;

  -- 18. Escrita direta pela API é recusada (status, totais, valor final)
  PERFORM pg_temp.as_auth(CAIXA2);
  PERFORM pg_temp.expect_fail('18 cashier reabre pelo UPDATE',
    format($q$UPDATE cash_registers SET status = 'open' WHERE id = '%s'$q$, v_cr),
    'só pelas operações do sistema');
  RESET ROLE;
  PERFORM pg_temp.as_auth(CAIXA2);
  PERFORM pg_temp.expect_fail('18 cashier altera total pelo UPDATE',
    format($q$UPDATE cash_registers SET total_withdrawals = 0 WHERE id = '%s'$q$, v_cr),
    'só pelas operações do sistema');
  RESET ROLE;

  -- 19. Log de operações: uma linha por operação aceita; sem alteração nem exclusão
  SELECT COUNT(*) INTO n FROM cash_operation_log WHERE cash_register_id = v_cr;
  IF n <> 5 THEN
    RAISE EXCEPTION 'FALHOU 19: log deveria ter 5 operações (abertura, sangria, suprimento, suprimento do gerente, fechamento): %', n;
  END IF;
  PERFORM pg_temp.expect_fail('19 log não altera',
    $q$UPDATE cash_operation_log SET result = '{}'::jsonb$q$, 'imutável');
  PERFORM pg_temp.expect_fail('19 log não apaga',
    $q$DELETE FROM cash_operation_log$q$, 'imutável');

  -- 20. Vendedor não lê o log de outra empresa (RLS)
  PERFORM pg_temp.as_auth(OWNER_B);
  SELECT COUNT(*) INTO n FROM cash_operation_log;
  RESET ROLE;
  IF n <> 0 THEN RAISE EXCEPTION 'FALHOU 20: owner de outra empresa leu % operações', n; END IF;

  RAISE NOTICE 'CAIXA TRANSACIONAL OK';
END $$;

SELECT 'CAIXA TRANSACIONAL OK' AS r;
ROLLBACK;
