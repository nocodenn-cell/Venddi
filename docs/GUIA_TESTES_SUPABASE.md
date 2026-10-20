# Guia de Testes - Venddi com Supabase Real

**Data:** 2026-10-19  
**Objetivo:** Validar todos os fluxos críticos com banco de dados real

---

## 📋 Pré-requisitos

- ✅ Arquivo `.env` configurado com URL e chave anon do Supabase
- ✅ Migrations 001-013 aplicadas
- ✅ Dependências instaladas (`npm install`)
- ✅ Supabase rodando (local ou cloud)

---

## 🧪 Teste 1: Verificação de Conexão

### 1.1 Verificar se o `.env` está configurado

```bash
# No Windows PowerShell
cd C:\Naturecode\venddi-github
type .env
```

**Resultado esperado:**
```
VITE_SUPABASE_URL=https://jcvblxyzceszzehehyjd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 1.2 Verificar tabelas no Supabase

Acesse o Supabase SQL Editor e execute:

```sql
-- Contar tabelas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- Esperado: 25+ tabelas

-- Listar tabelas principais
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'companies', 'users', 'products', 'sales', 
  'cash_registers', 'company_subscriptions',
  'product_wholesale_tiers', 'company_margin_policies'
)
ORDER BY table_name;

-- Esperado: 8 tabelas listadas
```

### 1.3 Verificar funções

```sql
-- Contar funções
SELECT COUNT(*) as total_funcoes
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';

-- Esperado: 20+ funções

-- Listar funções críticas
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'create_atomic_sale',
  'cancel_sale_with_reversal',
  'resolve_product_price',
  'get_user_company_id',
  'is_trial_active',
  'get_remaining_trial_days',
  'calc_gross_profit',
  'calc_gross_margin_percent'
)
ORDER BY routine_name;

-- Esperado: 8 funções listadas
```

---

## 🧪 Teste 2: Iniciar Aplicação

### 2.1 Iniciar servidor de desenvolvimento

```bash
npm run dev
```

**Resultado esperado:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 2.2 Acessar no navegador

Abra: http://localhost:3000

**Resultado esperado:**
- ✅ Página de login aparece
- ✅ Logo Venddi visível
- ✅ Formulário de login funcional

### 2.3 Verificar console do navegador

Abra DevTools (F12) → Console

**Resultado esperado:**
- ✅ Sem erros vermelhos
- ✅ Mensagem: "Supabase conectado com sucesso" (ou similar)
- ⚠️ Se aparecer "Supabase não configurado", verifique o `.env`

---

## 🧪 Teste 3: Login e Autenticação

### 3.1 Login com credenciais de teste

**Credenciais:**
- Email: `admin@venddi.com`
- Senha: `admin123`

**Passos:**
1. Acesse http://localhost:3000/login
2. Digite email e senha
3. Clique em "Entrar"

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para `/app/pdv`
- ✅ Dashboard ou PDV carregado
- ✅ Nome do usuário visível no header

### 3.2 Verificar sessão no Supabase

No Supabase SQL Editor:

```sql
-- Verificar se há usuários ativos
SELECT 
  id,
  email,
  full_name,
  role,
  is_active,
  last_login_at
FROM users
WHERE email = 'admin@venddi.com';

-- Esperado: 1 linha com is_active = true
```

### 3.3 Verificar trial

```sql
-- Verificar subscription
SELECT 
  cs.id,
  c.name as company_name,
  cs.plan,
  cs.status,
  cs.trial_days,
  cs.trial_started_at,
  cs.trial_end_date,
  get_remaining_trial_days(c.id) as days_remaining
FROM company_subscriptions cs
JOIN companies c ON c.id = cs.company_id
WHERE c.name LIKE '%Venddi%' OR c.name LIKE '%Demo%';

-- Esperado: 1 linha com status = 'trial' e days_remaining > 0
```

---

## 🧪 Teste 4: Cadastro de Produto com Atacado

### 4.1 Criar produto via interface

**Passos:**
1. Acesse `/app/produtos`
2. Clique em "Novo Produto"
3. Preencha:
   - Nome: "Camiseta Teste"
   - SKU: "CAM-TEST-001"
   - Código de barras: "7891234567890"
   - Custo: R$ 25,00
   - Preço de venda: R$ 50,00
   - Estoque: 100
   - Estoque mínimo: 10
4. Clique em "Salvar"

**Resultado esperado:**
- ✅ Produto criado com sucesso
- ✅ Aparece na lista de produtos
- ✅ Margem calculada: 50%
- ✅ Markup calculado: 100%

### 4.2 Verificar produto no banco

```sql
-- Verificar produto criado
SELECT 
  id,
  sku,
  name,
  cost_price,
  sell_price,
  stock_quantity,
  min_stock,
  is_active
FROM products
WHERE sku = 'CAM-TEST-001';

-- Esperado: 1 linha com os dados corretos
```

### 4.3 Adicionar faixas de atacado

**Passos:**
1. No produto criado, clique em "Editar"
2. Na seção "Preço de Atacado", clique em "Adicionar Faixa"
3. Adicione 2 faixas:
   - Faixa 1: 6+ unidades → R$ 45,00
   - Faixa 2: 12+ unidades → R$ 40,00
4. Clique em "Salvar"

**Resultado esperado:**
- ✅ Faixas salvas com sucesso
- ✅ Margem de cada faixa calculada
- ✅ Preços decrescentes validados

### 4.4 Verificar faixas no banco

```sql
-- Verificar faixas de atacado
SELECT 
  pwt.id,
  p.name as product_name,
  pwt.min_quantity,
  pwt.unit_price,
  calc_gross_margin_percent(pwt.unit_price, p.cost_price) as margin_percent
FROM product_wholesale_tiers pwt
JOIN products p ON p.id = pwt.product_id
WHERE p.sku = 'CAM-TEST-001'
ORDER BY pwt.min_quantity;

-- Esperado: 2 linhas
-- Linha 1: min_quantity = 6, unit_price = 45.00, margin = 44.44%
-- Linha 2: min_quantity = 12, unit_price = 40.00, margin = 37.50%
```

---

## 🧪 Teste 5: Resolução de Preço

### 5.1 Testar função resolve_product_price

```sql
-- Obter IDs
SELECT id INTO v_company_id FROM companies LIMIT 1;
SELECT id INTO v_product_id FROM products WHERE sku = 'CAM-TEST-001';

-- Testar resolução para 1 unidade (varejo)
SELECT resolve_product_price(
  (SELECT id FROM companies LIMIT 1),
  (SELECT id FROM products WHERE sku = 'CAM-TEST-001'),
  1
);

-- Esperado: unitPrice = 50.00, origin = 'retail'

-- Testar resolução para 8 unidades (ataco 6+)
SELECT resolve_product_price(
  (SELECT id FROM companies LIMIT 1),
  (SELECT id FROM products WHERE sku = 'CAM-TEST-001'),
  8
);

-- Esperado: unitPrice = 45.00, origin = 'wholesale'

-- Testar resolução para 15 unidades (ataco 12+)
SELECT resolve_product_price(
  (SELECT id FROM companies LIMIT 1),
  (SELECT id FROM products WHERE sku = 'CAM-TEST-001'),
  15
);

-- Esperado: unitPrice = 40.00, origin = 'wholesale'
```

---

## 🧪 Teste 6: Abertura de Caixa

### 6.1 Abrir caixa via interface

**Passos:**
1. Acesse `/app/caixas`
2. Clique em "Abrir Caixa"
3. Informe valor inicial: R$ 100,00
4. Clique em "Confirmar"

**Resultado esperado:**
- ✅ Caixa aberto com sucesso
- ✅ Status mostra "Aberto"
- ✅ Valor inicial: R$ 100,00
- ✅ Operador: admin@venddi.com

### 6.2 Verificar caixa no banco

```sql
-- Verificar caixa aberto
SELECT 
  id,
  operator_id,
  status,
  initial_amount,
  total_sales,
  opened_at
FROM cash_registers
WHERE status = 'open'
ORDER BY opened_at DESC
LIMIT 1;

-- Esperado: 1 linha com status = 'open' e initial_amount = 100.00
```

---

## 🧪 Teste 7: Venda Atômica

### 7.1 Realizar venda via PDV

**Passos:**
1. Acesse `/app/pdv`
2. Busque "Camiseta Teste"
3. Adicione 10 unidades ao carrinho
4. Clique em "Finalizar Venda"
5. Selecione pagamento: Dinheiro
6. Valor recebido: R$ 500,00 (10 × R$ 45,00 = R$ 450,00 + troco R$ 50,00)
7. Clique em "Confirmar"

**Resultado esperado:**
- ✅ Venda finalizada com sucesso
- ✅ Número da venda exibido
- ✅ Preço unitário: R$ 45,00 (atacado 6+)
- ✅ Total: R$ 450,00
- ✅ Troco: R$ 50,00
- ✅ Estoque atualizado: 90 unidades

### 7.2 Verificar venda no banco

```sql
-- Verificar venda criada
SELECT 
  s.id,
  s.sale_number,
  s.status,
  s.subtotal,
  s.discount,
  s.total,
  s.operator_id,
  s.cash_register_id,
  s.created_at
FROM sales s
ORDER BY s.created_at DESC
LIMIT 1;

-- Esperado: 1 linha com status = 'completed' e total = 450.00

-- Verificar itens da venda
SELECT 
  si.product_id,
  p.name,
  si.quantity,
  si.unit_price,
  si.cost_price,
  si.price_origin,
  si.wholesale_tier_id,
  si.total
FROM sale_items si
JOIN products p ON p.id = si.product_id
WHERE si.sale_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1);

-- Esperado: 1 linha
-- quantity = 10
-- unit_price = 45.00
-- cost_price = 25.00
-- price_origin = 'wholesale'
-- total = 450.00

-- Verificar pagamentos
SELECT 
  method,
  amount,
  installments
FROM payments
WHERE sale_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1);

-- Esperado: 1 linha
-- method = 'cash'
-- amount = 450.00
-- installments = 1

-- Verificar movimentação de caixa
SELECT 
  type,
  amount,
  description,
  balance_after
FROM cash_movements
WHERE reference_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1)
AND type = 'sale';

-- Esperado: 1 linha
-- type = 'sale'
-- amount = 450.00
-- description = 'Venda #[número]'

-- Verificar movimentação de estoque
SELECT 
  type,
  quantity,
  reason,
  balance_after
FROM stock_movements
WHERE reference_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1)
AND type = 'out';

-- Esperado: 1 linha
-- type = 'out'
-- quantity = 10
-- reason = 'Venda #[número]'
-- balance_after = 90
```

---

## 🧪 Teste 8: Cancelamento de Venda

### 8.1 Cancelar venda via interface

**Passos:**
1. Acesse `/app/vendas`
2. Localize a venda criada
3. Clique em "Cancelar"
4. Informe motivo: "Cancelamento de teste - validação de estorno"
5. Clique em "Confirmar"

**Resultado esperado:**
- ✅ Venda cancelada com sucesso
- ✅ Status muda para "Cancelada"
- ✅ Estoque restaurado: 100 unidades
- ✅ Caixa estornado: R$ 450,00

### 8.2 Verificar cancelamento no banco

```sql
-- Verificar venda cancelada
SELECT 
  id,
  sale_number,
  status,
  cancelled_at,
  cancellation_reason
FROM sales
WHERE id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1);

-- Esperado: 1 linha
-- status = 'cancelled'
-- cancelled_at não nulo
-- cancellation_reason = 'Cancelamento de teste - validação de estorno'

-- Verificar estoque restaurado
SELECT 
  id,
  sku,
  name,
  stock_quantity
FROM products
WHERE sku = 'CAM-TEST-001';

-- Esperado: stock_quantity = 100 (restaurado)

-- Verificar estorno de caixa
SELECT 
  type,
  amount,
  description
FROM cash_movements
WHERE reference_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1)
AND type = 'refund';

-- Esperado: 1 linha
-- type = 'refund'
-- amount = 450.00
-- description = 'Estorno venda #[número]'

-- Verificar log de auditoria
SELECT 
  action,
  entity_type,
  entity_id,
  old_values,
  new_values,
  created_at
FROM audit_logs
WHERE entity_id = (SELECT id FROM sales ORDER BY created_at DESC LIMIT 1)
AND action = 'sale.cancel';

-- Esperado: 1 linha
-- action = 'sale.cancel'
-- old_values = {"status": "completed"}
-- new_values = {"status": "cancelled", "reason": "..."}
```

---

## 🧪 Teste 9: Isolamento Multiempresa

### 9.1 Criar segunda empresa

No Supabase SQL Editor:

```sql
-- Criar segunda empresa
INSERT INTO companies (name, cnpj, plan, status)
VALUES (
  'Empresa Teste B',
  '22.222.222/0001-22',
  'starter',
  'active'
) RETURNING id;

-- Anote o company_id retornado

-- Criar usuário para Empresa B
INSERT INTO users (company_id, email, full_name, role, is_active)
VALUES (
  '[COMPANY_B_ID]',
  'testeB@venddi.com',
  'Proprietário B',
  'owner',
  true
);

-- Criar subscription para Empresa B
INSERT INTO company_subscriptions (company_id, plan, trial_days, status)
VALUES (
  '[COMPANY_B_ID]',
  'starter',
  30,
  'trial'
);

-- Criar produto para Empresa B
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
```

### 9.2 Testar isolamento

```sql
-- Login como Empresa A
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = '[AUTH_ID_USER_A]';

-- Tentar ver produtos da Empresa B
SELECT COUNT(*) as produtos_empresa_b
FROM products
WHERE company_id = '[COMPANY_B_ID]';

-- Esperado: 0 (RLS bloqueia acesso)

-- Ver produtos da Empresa A
SELECT COUNT(*) as produtos_empresa_a
FROM products
WHERE company_id = '[COMPANY_A_ID]';

-- Esperado: 1 (apenas produtos da própria empresa)

RESET ROLE;
```

---

## 🧪 Teste 10: Idempotência

### 10.1 Testar venda duplicada

```sql
-- Gerar chave de idempotência
SELECT uuid_generate_v4() as idempotency_key;

-- Anote o UUID retornado

-- Primeira venda
SELECT create_atomic_sale(
  '[COMPANY_A_ID]',
  '[USER_A_ID]',
  '[CASH_REGISTER_ID]',
  '[
    {
      "productId": "[PRODUCT_A_ID]",
      "quantity": 5,
      "unitPrice": 50.00,
      "discount": 0
    }
  ]'::jsonb,
  '[
    {
      "method": "cash",
      "amount": 250.00,
      "installments": 1
    }
  ]'::jsonb,
  NULL,
  0,
  0,
  NULL,
  '[IDEMPOTENCY_KEY]'::uuid
);

-- Anote o sale_id retornado

-- Segunda venda com MESMA chave de idempotência
SELECT create_atomic_sale(
  '[COMPANY_A_ID]',
  '[USER_A_ID]',
  '[CASH_REGISTER_ID]',
  '[
    {
      "productId": "[PRODUCT_A_ID]",
      "quantity": 5,
      "unitPrice": 50.00,
      "discount": 0
    }
  ]'::jsonb,
  '[
    {
      "method": "cash",
      "amount": 250.00,
      "installments": 1
    }
  ]'::jsonb,
  NULL,
  0,
  0,
  NULL,
  '[IDEMPOTENCY_KEY]'::uuid
);

-- Esperado: Retorna o MESMO sale_id da primeira venda
-- Mensagem: "Sale already exists (idempotent)"
```

---

## 📊 Relatório de Testes

### Template para Registrar Resultados

```markdown
## Resultado do Teste X

**Data:** YYYY-MM-DD
**Executado por:** [Nome]
**Ambiente:** Supabase Cloud / Local

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

## 🎯 Checklist Final de Homologação

### Funcionalidades Críticas

- [ ] Login funciona
- [ ] Trial de 30 dias criado automaticamente
- [ ] Cadastro de produtos funciona
- [ ] Faixas de atacado configuráveis
- [ ] Resolução de preço automática
- [ ] Abertura de caixa funciona
- [ ] Venda atômica funciona
- [ ] Estoque atualizado corretamente
- [ ] Caixa atualizado corretamente
- [ ] Cancelamento com estorno funciona
- [ ] Isolamento multiempresa funciona
- [ ] Idempotência funciona
- [ ] Auditoria registrada

### Segurança

- [ ] RLS policies funcionando
- [ ] Validação de auth.uid()
- [ ] Validação de propriedade da empresa
- [ ] Validação de operador ativo
- [ ] Proteção contra manipulação de company_id
- [ ] Proteção contra auto-elevação de privilégios

### Performance

- [ ] Tempo de resposta < 2s
- [ ] Build sem erros
- [ ] Typecheck sem erros
- [ ] Sem warnings críticos

---

## 📞 Suporte

### Problemas Comuns

**Problema:** "Supabase não configurado"
**Solução:** Verificar arquivo `.env` e reiniciar servidor

**Problema:** "Permission denied"
**Solução:** Verificar RLS policies e auth.uid()

**Problema:** "Function does not exist"
**Solução:** Verificar se migrations foram aplicadas

**Problema:** "Column does not exist"
**Solução:** Verificar se migrations foram aplicadas na ordem correta

### Contato

- **Documentação:** `docs/`
- **Migrations:** `supabase/migrations/`
- **Testes:** `supabase/tests/`

---

**Guia elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ✅ Pronto para execução  
**Próximo passo:** Executar testes e registrar resultados
