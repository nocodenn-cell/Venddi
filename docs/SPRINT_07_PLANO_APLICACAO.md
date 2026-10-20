# Sprint 07 - Plano de Aplicação de Migrations

**Data:** 2026-10-19  
**Status:** ⏸️ AGUARDANDO AUTORIZAÇÃO  
**Projeto Supabase:** jcvblxyzceszzehehyjd

---

## ⚠️ AVISO CRÍTICO

**ESTE DOCUMENTO REQUER AUTORIZAÇÃO EXPRESSA DO PROPRIETÁRIO**

Não execute nenhuma migration sem:
1. ✅ Backup completo do banco atual
2. ✅ Validação do backup (restauração testada)
3. ✅ Autorização expressa do proprietário
4. ✅ Ambiente de rollback documentado

---

## 📋 Status Atual

### Configuração do Supabase

- **URL do Projeto:** https://jcvblxyzceszzehehyjd.supabase.co
- **Status da Conexão:** ⏳ Aguardando configuração do `.env`
- **Migrations Aplicadas:** ❓ Desconhecido (requer verificação)
- **Dados Existentes:** ❓ Desconhecido (requer verificação)

### Arquivo `.env`

**Status:** ❌ Não configurado

**Ação Necessária:**
```bash
# Criar arquivo .env na raiz do projeto
cat > .env << EOF
VITE_SUPABASE_URL=https://jcvblxyzceszzehehyjd.supabase.co
VITE_SUPABASE_ANON_KEY=<SUA_ANON_KEY_AQUI>
EOF

# IMPORTANTE:
# - Use APENAS a chave anon public
# - NÃO use service_role
# - NÃO commite este arquivo
```

**Onde encontrar a chave anon:**
1. Acesse: https://supabase.com/dashboard/project/jcvblxyzceszzehehyjd/settings/api
2. Role até "Project API keys"
3. Copie a chave `anon` `public`

---

## 🔍 Verificação do Estado Atual do Banco

### Passo 1: Conectar ao Banco

```bash
# Usando Supabase CLI (recomendado)
supabase link --project-ref jcvblxyzceszzehehyjd

# Ou usando psql diretamente
psql "postgresql://postgres:[DATABASE_PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres"
```

### Passo 2: Verificar Tabelas Existentes

```sql
-- Listar todas as tabelas
\dt

-- Contar tabelas
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';
```

**Interpretação:**
- **0 tabelas:** Banco vazio, pode aplicar todas as migrations
- **1-10 tabelas:** Algumas migrations aplicadas, verificar quais
- **20+ tabelas:** Todas as migrations provavelmente aplicadas

### Passo 3: Verificar Migrations Aplicadas

```sql
-- Verificar se tabela companies existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'companies'
) as companies_exists;

-- Verificar se tabela products existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'products'
) as products_exists;

-- Verificar se tabela sales existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'sales'
) as sales_exists;

-- Verificar se tabela company_subscriptions existe
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'company_subscriptions'
) as subscriptions_exists;
```

### Passo 4: Verificar Funções Existentes

```sql
-- Listar todas as funções
\df

-- Verificar funções críticas
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'get_user_company_id',
  'create_atomic_sale',
  'cancel_sale_with_reversal',
  'is_trial_active',
  'get_remaining_trial_days'
);
```

### Passo 5: Verificar Dados Existentes

```sql
-- Contar registros em tabelas principais
SELECT 
  'companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'company_subscriptions', COUNT(*) FROM company_subscriptions;
```

**IMPORTANTE:**
- Se houver dados reais, **FAÇA BACKUP ANTES DE QUALQUER ALTERAÇÃO**
- Consulte `docs/SPRINT_07_BACKUP_RESTORE.md` para procedimento de backup

---

## 📊 Cenários Possíveis

### Cenário A: Banco Vazio (0 tabelas)

**Status:** ✅ Seguro para aplicar todas as migrations

**Plano:**
```bash
# Aplicar todas as migrations em sequência
supabase db push

# Ou aplicar manualmente em ordem
psql -f supabase/migrations/001_foundation.sql
psql -f supabase/migrations/002_products_stock.sql
psql -f supabase/migrations/003_sales_customers.sql
psql -f supabase/migrations/004_cashier_financial.sql
psql -f supabase/migrations/005_rls_policies.sql
psql -f supabase/migrations/006_atomic_sale_rpc.sql
psql -f supabase/migrations/007_sale_enhancements.sql
psql -f supabase/migrations/008_critical_fixes.sql
psql -f supabase/migrations/009_fiscal_module.sql
psql -f supabase/migrations/010_fiscal_rls_policies.sql
psql -f supabase/migrations/011_trial_subscription.sql
```

**Risco:** ⚠️ Baixo  
**Tempo estimado:** 2-5 minutos

---

### Cenário B: Algumas Migrations Aplicadas (1-10 tabelas)

**Status:** ⚠️ Requer análise cuidadosa

**Plano:**
1. Identificar quais migrations já foram aplicadas
2. Identificar quais estão pendentes
3. Aplicar apenas as pendentes em ordem

**Exemplo:**
```sql
-- Verificar quais tabelas existem
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Mapeamento:**
- `companies`, `users`, `audit_logs` → Migration 001 aplicada
- `products`, `categories`, `stock_movements` → Migration 002 aplicada
- `customers`, `sales`, `sale_items`, `payments` → Migration 003 aplicada
- `cash_registers`, `cash_movements`, `financial_accounts` → Migration 004 aplicada
- `company_subscriptions`, `trial_notifications` → Migration 011 aplicada

**Risco:** ⚠️ Médio  
**Tempo estimado:** 5-15 minutos

---

### Cenário C: Todas as Migrations Aplicadas (20+ tabelas)

**Status:** ✅ Banco completo

**Plano:**
1. Verificar integridade do schema
2. Testar funcionalidades críticas
3. Validar RLS policies
4. Executar testes de homologação

**Risco:** ⚠️ Baixo  
**Tempo estimado:** 30-60 minutos (testes)

---

### Cenário D: Migrations Conflitantes

**Status:** 🔴 Requer intervenção manual

**Sintomas:**
- Erros ao aplicar migrations
- Tabelas com estrutura diferente do esperado
- Funções duplicadas ou conflitantes

**Plano:**
1. Identificar conflitos específicos
2. Decidir entre:
   - Opção A: Resetar banco e aplicar do zero (se não houver dados importantes)
   - Opção B: Criar migration de correção (se houver dados importantes)
3. Executar plano escolhido

**Risco:** 🔴 Alto  
**Tempo estimado:** 1-4 horas

---

## 🎯 Plano de Aplicação Recomendado

### Fase 0: Preparação (Obrigatório)

**Checklist:**
- [ ] Arquivo `.env` configurado com URL e anon key
- [ ] Backup completo do banco (se houver dados)
- [ ] Backup validado (restauração testada)
- [ ] Ambiente de rollback documentado
- [ ] Autorização expressa do proprietário

**Comandos:**
```bash
# 1. Configurar .env
cat > .env << EOF
VITE_SUPABASE_URL=https://jcvblxyzceszzehehyjd.supabase.co
VITE_SUPABASE_ANON_KEY=<SUA_ANON_KEY_AQUI>
EOF

# 2. Linkar projeto Supabase
supabase link --project-ref jcvblxyzceszzehehyjd

# 3. Verificar status do banco
supabase db pull

# 4. Fazer backup (se houver dados)
# Seguir docs/SPRINT_07_BACKUP_RESTORE.md
```

---

### Fase 1: Verificação do Estado Atual

**Objetivo:** Entender o estado atual do banco

**Comandos:**
```bash
# Conectar ao banco
psql "postgresql://postgres:[PASSWORD]@db.jcvblxyzceszzehehyjd.supabase.co:5432/postgres"

# Executar queries de verificação
# (Ver seção "Verificação do Estado Atual do Banco" acima)
```

**Resultado Esperado:**
- Lista de tabelas existentes
- Lista de funções existentes
- Contagem de registros
- Identificação de migrations aplicadas

---

### Fase 2: Aplicação das Migrations Pendentes

**Objetivo:** Aplicar apenas migrations que ainda não foram aplicadas

**Comando (se banco vazio):**
```bash
supabase db push
```

**Comando (se algumas migrations aplicadas):**
```bash
# Aplicar apenas migrations específicas
psql -f supabase/migrations/005_rls_policies.sql
psql -f supabase/migrations/006_atomic_sale_rpc.sql
# ... etc
```

**Validação:**
```bash
# Verificar se todas as tabelas foram criadas
psql -c "\dt" | wc -l
# Esperado: 20+ tabelas

# Verificar se todas as funções foram criadas
psql -c "\df" | wc -l
# Esperado: 12+ funções
```

---

### Fase 3: Validação Pós-Aplicação

**Objetivo:** Garantir que tudo está funcionando corretamente

**Checklist:**
- [ ] Todas as 20+ tabelas criadas
- [ ] Todas as 12+ funções criadas
- [ ] Todos os índices criados
- [ ] Todos os triggers funcionando
- [ ] Policies RLS ativas
- [ ] Foreign keys válidas
- [ ] Aplicação conecta ao banco
- [ ] Login funciona
- [ ] CRUD de produtos funciona
- [ ] Venda atômica funciona
- [ ] Trial é criado automaticamente

**Script de Validação:**
```sql
-- validar_aplicacao.sql

-- 1. Verificar tabelas
SELECT COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';
-- Esperado: 20+

-- 2. Verificar funções
SELECT COUNT(*) as total_functions
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';
-- Esperado: 12+

-- 3. Verificar RLS policies
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';
-- Esperado: 30+

-- 4. Verificar dados críticos
SELECT 
  'companies' as table_name, COUNT(*) as count FROM companies
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'sales', COUNT(*) FROM sales;
```

---

### Fase 4: Testes Funcionais

**Objetivo:** Validar fluxos críticos do sistema

**Teste 1: Cadastro e Trial**
```bash
# 1. Acessar http://localhost:3000/cadastro
# 2. Preencher formulário
# 3. Verificar se subscription foi criada
psql -c "SELECT * FROM company_subscriptions;"
# Esperado: 1 registro com status='trial', trial_days=30
```

**Teste 2: Venda Atômica**
```bash
# 1. Criar produto de teste
# 2. Abrir caixa
# 3. Realizar venda
# 4. Verificar se estoque foi atualizado
psql -c "SELECT stock_quantity FROM products WHERE sku = 'TEST-001';"
# Esperado: estoque reduzido

# 5. Verificar se venda foi registrada
psql -c "SELECT * FROM sales ORDER BY created_at DESC LIMIT 1;"
# Esperado: 1 registro com status='completed'
```

**Teste 3: Isolamento Multiempresa**
```bash
# 1. Criar empresa A
# 2. Criar empresa B
# 3. Login como empresa A
# 4. Tentar acessar dados da empresa B
# Esperado: Acesso negado (RLS)
```

**Teste 4: Cancelamento de Venda**
```bash
# 1. Realizar venda
# 2. Cancelar venda
# 3. Verificar se estoque foi restaurado
psql -c "SELECT stock_quantity FROM products WHERE sku = 'TEST-001';"
# Esperado: estoque restaurado

# 4. Verificar se venda foi marcada como cancelada
psql -c "SELECT status FROM sales WHERE id = '[SALE_ID]';"
# Esperado: status='cancelled'
```

---

## 🚨 Procedimentos de Rollback

### Cenário: Migration Falhou

**Sintomas:**
- Erro durante aplicação de migration
- Banco em estado inconsistente
- Aplicação não funciona

**Ação:**
```bash
# 1. NÃO PANIC!

# 2. Restaurar backup
# Seguir docs/SPRINT_07_BACKUP_RESTORE.md

# 3. Identificar migration problemática
# Verificar logs de erro

# 4. Corrigir migration (se necessário)
# Editar arquivo SQL

# 5. Tentar aplicar novamente
```

### Cenário: Dados Corrompidos

**Sintomas:**
- Dados inconsistentes
- Foreign keys violadas
- Queries retornam resultados errados

**Ação:**
```bash
# 1. Restaurar backup mais recente

# 2. Verificar integridade
psql -c "REINDEX DATABASE postgres;"

# 3. Validar constraints
psql << EOF
ALTER TABLE sales VALIDATE CONSTRAINT sales_company_id_fkey;
ALTER TABLE products VALIDATE CONSTRAINT products_company_id_fkey;
-- Repetir para todas as foreign keys
EOF

# 4. Se problemas persistirem, restaurar de backup anterior
```

---

## 📋 Checklist Final de Aplicação

### Pré-Aplicação

- [ ] Arquivo `.env` configurado
- [ ] Backup completo realizado
- [ ] Backup validado (restauração testada)
- [ ] Autorização do proprietário obtida
- [ ] Plano de rollback documentado
- [ ] Equipe notificada (se necessário)

### Durante Aplicação

- [ ] Migrations aplicadas em ordem correta
- [ ] Sem erros durante aplicação
- [ ] Todas as tabelas criadas (20+)
- [ ] Todas as funções criadas (12+)
- [ ] Policies RLS ativas

### Pós-Aplicação

- [ ] Aplicação conecta ao banco
- [ ] Login funciona
- [ ] CRUD de produtos funciona
- [ ] Venda atômica funciona
- [ ] Cancelamento funciona
- [ ] Trial é criado automaticamente
- [ ] Isolamento multiempresa funciona
- [ ] RLS policies validadas
- [ ] Testes funcionais passaram

---

## 📊 Métricas de Sucesso

| Métrica | Valor Esperado |
|---------|----------------|
| **Tabelas criadas** | 20+ |
| **Funções criadas** | 12+ |
| **Policies RLS** | 30+ |
| **Tempo de aplicação** | 5-15 minutos |
| **Tempo de validação** | 30-60 minutos |
| **Taxa de sucesso** | 100% |

---

## 🎯 Critérios de Aceite

A aplicação das migrations será considerada bem-sucedida quando:

1. ✅ Todas as 11 migrations aplicadas sem erros
2. ✅ Todas as 20+ tabelas criadas
3. ✅ Todas as 12+ funções criadas
4. ✅ Policies RLS ativas e funcionando
5. ✅ Aplicação conecta ao banco
6. ✅ Todos os testes funcionais passam
7. ✅ Isolamento multiempresa validado
8. ✅ Trial criado automaticamente
9. ✅ Venda atômica funcionando
10. ✅ Cancelamento com estorno funcionando

---

## 📞 Contato e Aprovação

**Para aprovar a aplicação das migrations:**

1. Revise este documento
2. Confirme que backup foi realizado
3. Confirme que autoriza a aplicação
4. Informe: "Autorizo a aplicação das migrations"

**Para solicitar informações adicionais:**
- Consulte `docs/SPRINT_07_MIGRATIONS_AUDIT.md`
- Consulte `docs/SPRINT_07_BACKUP_RESTORE.md`
- Consulte `docs/GUIA_HOMOLOGACAO.md`

---

## 📚 Documentação Relacionada

| Documento | Descrição |
|-----------|-----------|
| `SPRINT_07_MIGRATIONS_AUDIT.md` | Auditoria detalhada das migrations |
| `SPRINT_07_BACKUP_RESTORE.md` | Procedimento de backup e restauração |
| `GUIA_HOMOLOGACAO.md` | Guia completo de homologação |
| `SPRINT_07_RESULTADO.md` | Resultado final da Sprint 07 |

---

**Documento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** ⏸️ AGUARDANDO AUTORIZAÇÃO  
**Próximo passo:** Obter autorização e executar aplicação controlada
