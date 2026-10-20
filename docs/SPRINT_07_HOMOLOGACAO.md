# Sprint 07 - Homologação Funcional

**Data:** 2026-10-19  
**Status:** ⏳ Scripts Preparados (Aguardando Execução)  
**Projeto Supabase:** jcvblxyzceszzehehyjd

---

## 📋 Resumo Executivo

Este documento contém todos os scripts e procedimentos para homologação funcional da Venddi após aplicação das migrations.

**IMPORTANTE:**
- ⚠️ Execute estes testes APENAS após aplicar as migrations
- ⚠️ Use dados fictícios para testes
- ⚠️ Documente todos os resultados

---

## 🎯 Objetivos da Homologação

1. Validar cadastro e autenticação
2. Validar trial de 30 dias
3. Validar isolamento multiempresa
4. Validar vendas e estoque
5. Validar caixa e financeiro
6. Validar cancelamentos e estornos

---

## 🧪 Suite de Testes

### Teste 1: Cadastro e Autenticação

**Objetivo:** Validar fluxo completo de cadastro

**Script:**
```sql
-- teste_01_cadastro.sql

-- 1. Criar empresa de teste
INSERT INTO companies (name, trade_name, cnpj, plan, status)
VALUES (
  'Empresa Teste A',
  'Teste A',
  '11.111.111/0001-11',
  'starter',
  'active'
) RETURNING id;

-- Anote o company_id retornado

-- 2. Criar usuário proprietário
-- IMPORTANTE: auth_id deve vir do Supabase Auth
-- Este é apenas um exemplo conceitual
INSERT INTO users (company_id, email, full_name, role, is_active)
VALUES (
  '[COMPANY_ID]',
  'testeA@venddi.com',
  'Proprietário A',
  'owner',
  true
) RETURNING id;

-- 3. Verificar criação
SELECT 
  c.name as company_name,
  u.full_name as user_name,
  u.role,
  u.is_active
FROM companies c
JOIN users u ON u.company_id = c.id
WHERE c.cnpj = '11.111.111/0001-11';

-- Esperado: 1 registro com role='owner', is_active=true
```

**Validação via Aplicação:**
```bash
# 1. Acessar http://localhost:3000/cadastro
# 2. Preencher formulário:
#    - Nome: "Teste A"
#    - Email: "testeA@venddi.com"
#    - Senha: "123456"
#    - Nome da loja: "Empresa Teste A"
#    - CNPJ: "11.111.111/0001-11"
# 3. Clicar em "Criar conta"
# 4. Verificar redirecionamento para /app/pdv
# 5. Verificar TrialStatusBanner mostrando "30 dias restantes"
```

**Checklist:**
- [ ] Empresa criada no banco
- [ ] Usuário criado no banco
- [ ] Subscription criada automaticamente
- [ ] Trial de 30 dias configurado
- [ ] Login funciona
- [ ] TrialStatusBanner aparece

---

### Teste 2: Trial de 30 Dias

**Objetivo:** Validar cálculo e exibição do trial

**Script:**
```sql
-- teste_02_trial.sql

-- 1. Verificar subscription criada
SELECT 
  company_id,
  plan,
  status,
  trial_days,
  trial_started_at,
  trial_end_date,
  EXTRACT(DAY FROM trial_end_date - NOW()) as days_remaining
FROM company_subscriptions
WHERE company_id = '[COMPANY_ID]';

-- Esperado: status='trial', trial_days=30, days_remaining≈30

-- 2. Testar função is_trial_active()
SELECT is_trial_active('[COMPANY_ID]') as is_active;
-- Esperado: true

-- 3. Testar função get_remaining_trial_days()
SELECT get_remaining_trial_days('[COMPANY_ID]') as remaining_days;
-- Esperado: ≈30

-- 4. Simular expiração (apenas para teste)
UPDATE company_subscriptions
SET trial_end_date = NOW() - INTERVAL '1 day'
WHERE company_id = '[COMPANY_ID]';

-- 5. Verificar status após expiração
SELECT 
  status,
  is_trial_active('[COMPANY_ID]') as is_active,
  get_remaining_trial_days('[COMPANY_ID]') as remaining_days
FROM company_subscriptions
WHERE company_id = '[COMPANY_ID]';
-- Esperado: is_active=false, remaining_days=0

-- 6. Restaurar trial (após teste)
UPDATE company_subscriptions
SET trial_end_date = NOW() + INTERVAL '30 days'
WHERE company_id = '[COMPANY_ID]';
```

**Validação via Aplicação:**
```bash
# 1. Login com usuário de teste
# 2. Verificar TrialStatusBanner
# 3. Verificar se mostra "30 dias restantes"
# 4. Acessar /app/pdv
# 5. Verificar se acesso é permitido
```

**Checklist:**
- [ ] Subscription criada com trial_days=30
- [ ] trial_end_date calculada automaticamente
- [ ] is_trial_active() retorna true
- [ ] get_remaining_trial_days() retorna ≈30
- [ ] TrialStatusBanner exibe dias corretamente
- [ ] Acesso permitido durante trial
- [ ] Acesso bloqueado após expiração

---

### Teste 3: Isolamento Multiempresa (RLS)

**Objetivo:** Validar que Empresa A não acessa dados da Empresa B

**Script:**
```sql
-- teste_03_rls.sql

-- 1. Criar Empresa B
INSERT INTO companies (name, cnpj, plan, status)
VALUES (
  'Empresa Teste B',
  '22.222.222/0001-22',
  'starter',
  'active'
) RETURNING id;

-- Anote o company_id da Empresa B

-- 2. Criar usuário da Empresa B
INSERT INTO users (company_id, email, full_name, role, is_active)
VALUES (
  '[COMPANY_B_ID]',
  'testeB@venddi.com',
  'Proprietário B',
  'owner',
  true
);

-- 3. Criar produto para Empresa A
INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock)
VALUES (
  '[COMPANY_A_ID]',
  'PROD-A-001',
  'Produto Empresa A',
  10.00,
  20.00,
  100,
  10
);

-- 4. Criar produto para Empresa B
INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock)
VALUES (
  '[COMPANY_B_ID]',
  'PROD-B-001',
  'Produto Empresa B',
  15.00,
  30.00,
  50,
  5
);

-- 5. Testar RLS: Usuário A não deve ver produtos da Empresa B
-- (Este teste requer contexto de autenticação)
-- Simular com SET ROLE
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = '[AUTH_ID_USER_A]';

SELECT COUNT(*) as produtos_visiveis
FROM products
WHERE company_id = '[COMPANY_B_ID]';
-- Esperado: 0 (RLS bloqueia acesso)

SELECT COUNT(*) as produtos_visiveis
FROM products
WHERE company_id = '[COMPANY_A_ID]';
-- Esperado: 1 (apenas produtos da própria empresa)

RESET ROLE;

-- 6. Testar tentativa de inserção cruzada
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = '[AUTH_ID_USER_A]';

INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity)
VALUES (
  '[COMPANY_B_ID]',
  'PROD-FAKE',
  'Produto Falso',
  5.00,
  10.00,
  10
);
-- Esperado: ERRO (RLS bloqueia inserção em outra empresa)

RESET ROLE;
```

**Validação via Aplicação:**
```bash
# 1. Login como Empresa A
# 2. Verificar se vê apenas produtos da Empresa A
# 3. Tentar acessar URL direta de produto da Empresa B
# 4. Verificar se acesso é negado
# 5. Logout
# 6. Login como Empresa B
# 7. Verificar se vê apenas produtos da Empresa B
```

**Checklist:**
- [ ] Empresa A vê apenas seus produtos
- [ ] Empresa B vê apenas seus produtos
- [ ] Tentativa de acesso cruzado é bloqueada
- [ ] RLS policies funcionando corretamente
- [ ] Foreign keys validando company_id

---

### Teste 4: Venda Atômica

**Objetivo:** Validar criação de venda com todas as operações

**Script:**
```sql
-- teste_04_venda_atomica.sql

-- 1. Preparar dados
-- Criar produto
INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock)
VALUES (
  '[COMPANY_ID]',
  'TEST-001',
  'Produto Teste',
  10.00,
  50.00,
  100,
  10
) RETURNING id;

-- Anote o product_id

-- Abrir caixa
INSERT INTO cash_registers (company_id, operator_id, status, initial_amount, opened_at)
VALUES (
  '[COMPANY_ID]',
  '[USER_ID]',
  'open',
  100.00,
  NOW()
) RETURNING id;

-- Anote o cash_register_id

-- 2. Executar venda atômica
SELECT create_atomic_sale(
  '[COMPANY_ID]',
  '[USER_ID]',
  '[CASH_REGISTER_ID]',
  NULL, -- customer_id (opcional)
  '[
    {
      "productId": "[PRODUCT_ID]",
      "quantity": 2,
      "unitPrice": 50.00,
      "discount": 0
    }
  ]'::jsonb,
  '[
    {
      "method": "cash",
      "amount": 100.00,
      "installments": 1
    }
  ]'::jsonb,
  0, -- discount
  0, -- additional_expenses
  NULL, -- notes
  gen_random_uuid() -- idempotency_key
);

-- 3. Verificar resultados
-- Venda criada
SELECT * FROM sales WHERE company_id = '[COMPANY_ID]' ORDER BY created_at DESC LIMIT 1;
-- Esperado: status='completed', total=100.00

-- Estoque atualizado
SELECT stock_quantity FROM products WHERE id = '[PRODUCT_ID]';
-- Esperado: 98 (100 - 2)

-- Movimentação de estoque registrada
SELECT * FROM stock_movements WHERE product_id = '[PRODUCT_ID]' ORDER BY created_at DESC LIMIT 1;
-- Esperado: type='out', quantity=2

-- Caixa atualizado
SELECT total_sales FROM cash_registers WHERE id = '[CASH_REGISTER_ID]';
-- Esperado: 100.00

-- Movimentação de caixa registrada
SELECT * FROM cash_movements WHERE cash_register_id = '[CASH_REGISTER_ID]' ORDER BY created_at DESC LIMIT 1;
-- Esperado: type='sale', amount=100.00

-- 4. Testar idempotência (mesma chave)
SELECT create_atomic_sale(
  '[COMPANY_ID]',
  '[USER_ID]',
  '[CASH_REGISTER_ID]',
  NULL,
  '[{"productId": "[PRODUCT_ID]", "quantity": 2, "unitPrice": 50.00, "discount": 0}]'::jsonb,
  '[{"method": "cash", "amount": 100.00, "installments": 1}]'::jsonb,
  0, 0, NULL,
  '[IDEMPOTENCY_KEY_USADA_ACIMA]' -- Mesma chave
);
-- Esperado: Retorna venda existente (não cria duplicada)
```

**Validação via Aplicação:**
```bash
# 1. Login como Empresa A
# 2. Abrir caixa (R$ 100,00)
# 3. Ir para PDV
# 4. Buscar "Produto Teste"
# 5. Adicionar 2 unidades ao carrinho
# 6. Selecionar pagamento em dinheiro
# 7. Finalizar venda
# 8. Verificar:
#    - Venda registrada
#    - Estoque reduzido para 98
#    - Caixa com R$ 200,00 (100 inicial + 100 venda)
```

**Checklist:**
- [ ] Venda criada com status='completed'
- [ ] Estoque atualizado corretamente
- [ ] Movimentação de estoque registrada
- [ ] Caixa atualizado corretamente
- [ ] Movimentação de caixa registrada
- [ ] Idempotência funciona (não cria duplicada)
- [ ] Auditoria registrada

---

### Teste 5: Cancelamento de Venda com Estorno

**Objetivo:** Validar cancelamento completo com estorno

**Script:**
```sql
-- teste_05_cancelamento.sql

-- 1. Usar venda criada no Teste 4
SELECT id, sale_number, total, status
FROM sales
WHERE company_id = '[COMPANY_ID]'
ORDER BY created_at DESC
LIMIT 1;

-- Anote o sale_id

-- 2. Executar cancelamento
SELECT cancel_sale_with_reversal(
  '[SALE_ID]',
  '[COMPANY_ID]',
  '[USER_ID]',
  'Cancelamento de teste - validação de estorno'
);

-- 3. Verificar resultados
-- Venda cancelada
SELECT status, cancelled_at, cancellation_reason
FROM sales
WHERE id = '[SALE_ID]';
-- Esperado: status='cancelled', cancelled_at não nulo

-- Estoque restaurado
SELECT stock_quantity FROM products WHERE id = '[PRODUCT_ID]';
-- Esperado: 100 (restaurado)

-- Movimentação de estorno registrada
SELECT * FROM stock_movements
WHERE product_id = '[PRODUCT_ID]'
AND reference_id = '[SALE_ID]'
ORDER BY created_at DESC
LIMIT 1;
-- Esperado: type='in', quantity=2, reason contém 'Cancelamento'

-- Caixa estornado
SELECT total_sales FROM cash_registers WHERE id = '[CASH_REGISTER_ID]';
-- Esperado: 0.00 (100 - 100)

-- Movimentação de estorno de caixa
SELECT * FROM cash_movements
WHERE cash_register_id = '[CASH_REGISTER_ID]'
AND type = 'refund'
ORDER BY created_at DESC
LIMIT 1;
-- Esperado: type='refund', amount=100.00

-- Auditoria registrada
SELECT * FROM audit_logs
WHERE entity_id = '[SALE_ID]'
AND action = 'sale.cancel'
ORDER BY created_at DESC
LIMIT 1;
-- Esperado: 1 registro
```

**Validação via Aplicação:**
```bash
# 1. Login como Empresa A
# 2. Ir para /app/vendas
# 3. Localizar venda criada
# 4. Clicar em "Cancelar"
# 5. Informar motivo: "Cancelamento de teste"
# 6. Confirmar
# 7. Verificar:
#    - Venda marcada como cancelada
#    - Estoque restaurado
#    - Caixa ajustado
```

**Checklist:**
- [ ] Venda marcada como cancelada
- [ ] Estoque restaurado corretamente
- [ ] Movimentação de estorno registrada
- [ ] Caixa estornado corretamente
- [ ] Movimentação de estorno de caixa registrada
- [ ] Auditoria registrada
- [ ] Interface mostra venda cancelada

---

### Teste 6: Pagamento Dividido

**Objetivo:** Validar venda com múltiplas formas de pagamento

**Script:**
```sql
-- teste_06_pagamento_dividido.sql

-- 1. Executar venda com pagamento dividido
SELECT create_atomic_sale(
  '[COMPANY_ID]',
  '[USER_ID]',
  '[CASH_REGISTER_ID]',
  NULL,
  '[
    {
      "productId": "[PRODUCT_ID]",
      "quantity": 1,
      "unitPrice": 100.00,
      "discount": 0
    }
  ]'::jsonb,
  '[
    {
      "method": "cash",
      "amount": 50.00,
      "installments": 1
    },
    {
      "method": "credit_card",
      "amount": 50.00,
      "installments": 1
    }
  ]'::jsonb,
  0, 0, NULL,
  gen_random_uuid()
);

-- 2. Verificar pagamentos registrados
SELECT method, amount, installments
FROM payments
WHERE sale_id = (
  SELECT id FROM sales
  WHERE company_id = '[COMPANY_ID]'
  ORDER BY created_at DESC
  LIMIT 1
);
-- Esperado: 2 registros (cash=50, credit_card=50)

-- 3. Verificar movimentação de caixa (apenas dinheiro)
SELECT type, amount
FROM cash_movements
WHERE cash_register_id = '[CASH_REGISTER_ID]'
AND reference_type = 'sale'
ORDER BY created_at DESC
LIMIT 1;
-- Esperado: type='sale', amount=50.00 (apenas dinheiro)
```

**Validação via Aplicação:**
```bash
# 1. Login como Empresa A
# 2. Ir para PDV
# 3. Adicionar produto de R$ 100,00
# 4. Selecionar pagamento dividido:
#    - Dinheiro: R$ 50,00
#    - Cartão: R$ 50,00
# 5. Finalizar venda
# 6. Verificar:
#    - Venda registrada com total R$ 100,00
#    - 2 pagamentos registrados
#    - Caixa recebeu apenas R$ 50,00 (dinheiro)
```

**Checklist:**
- [ ] Venda criada com total correto
- [ ] Múltiplos pagamentos registrados
- [ ] Caixa recebeu apenas valor em dinheiro
- [ ] Soma dos pagamentos = total da venda

---

### Teste 7: Estoque Insuficiente

**Objetivo:** Validar que venda é rejeitada quando estoque é insuficiente

**Script:**
```sql
-- teste_07_estoque_insuficiente.sql

-- 1. Reduzir estoque para 1
UPDATE products
SET stock_quantity = 1
WHERE id = '[PRODUCT_ID]';

-- 2. Tentar vender 2 unidades
SELECT create_atomic_sale(
  '[COMPANY_ID]',
  '[USER_ID]',
  '[CASH_REGISTER_ID]',
  NULL,
  '[
    {
      "productId": "[PRODUCT_ID]",
      "quantity": 2,
      "unitPrice": 50.00,
      "discount": 0
    }
  ]'::jsonb,
  '[
    {
      "method": "cash",
      "amount": 100.00,
      "installments": 1
    }
  ]'::jsonb,
  0, 0, NULL,
  gen_random_uuid()
);
-- Esperado: ERRO "Insufficient stock for product"

-- 3. Verificar que venda não foi criada
SELECT COUNT(*) as vendas_criadas
FROM sales
WHERE created_at > NOW() - INTERVAL '1 minute';
-- Esperado: 0

-- 4. Verificar que estoque não foi alterado
SELECT stock_quantity FROM products WHERE id = '[PRODUCT_ID]';
-- Esperado: 1 (não alterado)

-- 5. Restaurar estoque
UPDATE products
SET stock_quantity = 100
WHERE id = '[PRODUCT_ID]';
```

**Validação via Aplicação:**
```bash
# 1. Login como Empresa A
# 2. Ir para PDV
# 3. Adicionar produto com estoque=1
# 4. Tentar adicionar 2 unidades
# 5. Verificar mensagem de erro: "Estoque insuficiente"
# 6. Verificar que venda não foi criada
```

**Checklist:**
- [ ] Venda rejeitada quando estoque insuficiente
- [ ] Mensagem de erro clara
- [ ] Estoque não alterado
- [ ] Nenhuma venda criada

---

## 📊 Resumo dos Testes

| # | Teste | Objetivo | Status |
|---|-------|----------|--------|
| 1 | Cadastro e Autenticação | Validar fluxo de cadastro | ⏳ Pendente |
| 2 | Trial de 30 Dias | Validar cálculo e exibição | ⏳ Pendente |
| 3 | Isolamento Multiempresa | Validar RLS | ⏳ Pendente |
| 4 | Venda Atômica | Validar criação de venda | ⏳ Pendente |
| 5 | Cancelamento | Validar estorno completo | ⏳ Pendente |
| 6 | Pagamento Dividido | Validar múltiplos pagamentos | ⏳ Pendente |
| 7 | Estoque Insuficiente | Validar rejeição | ⏳ Pendente |

---

## 🎯 Critérios de Aceite

A homologação será considerada bem-sucedida quando:

1. ✅ Todos os 7 testes executados
2. ✅ Todos os checklists validados
3. ✅ Sem erros críticos
4. ✅ Isolamento multiempresa confirmado
5. ✅ Venda atômica funcionando
6. ✅ Cancelamento com estorno funcionando
7. ✅ Trial criado automaticamente
8. ✅ RLS policies funcionando

---

## 📝 Registro de Resultados

**Template para registrar resultados:**

```markdown
## Resultado do Teste X

**Data:** YYYY-MM-DD
**Executado por:** [Nome]
**Ambiente:** [Local/Produção]

### Status: ✅ PASS / ❌ FAIL / ⚠️ PARCIAL

### Observações:
- [Listar observações]

### Evidências:
- [Queries executadas]
- [Screenshots]
- [Logs]

### Problemas Encontrados:
- [Listar problemas]

### Ações Corretivas:
- [Listar ações]
```

---

## 📞 Contato

**Dúvidas sobre homologação:**
- Consultar `docs/GUIA_HOMOLOGACAO.md`
- Consultar `docs/SPRINT_07_MIGRATIONS_AUDIT.md`

**Problemas críticos:**
- Restaurar backup
- Consultar `docs/SPRINT_07_BACKUP_RESTORE.md`

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ⏳ Scripts Preparados  
**Próximo passo:** Executar testes após aplicação das migrations
