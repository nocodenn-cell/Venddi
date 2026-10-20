# Auditoria Sprint 06 - Bugs e Problemas Identificados

**Data:** 2026-10-19  
**Status:** 🔍 Em Andamento

---

## 🐛 Bugs Críticos Identificados

### 1. Company ID Hardcoded em sales.ts
**Arquivo:** `src/lib/api/sales.ts`  
**Linha:** 82  
**Problema:** `p_company_id: 'cmp_001'` está hardcoded  
**Impacto:** Viola isolamento multiempresa - todas as vendas vão para a mesma empresa  
**Severidade:** 🔴 CRÍTICO  
**Solução:** Obter company_id do contexto de autenticação

### 2. Produtos Mockados no PDV
**Arquivo:** `src/pages/PDVPage.tsx`  
**Linhas:** 97-104  
**Problema:** Produtos estão mockados em vez de usar API real  
**Impacto:** PDV não funciona com produtos reais do banco  
**Severidade:** 🟡 ALTA  
**Solução:** Integrar com getProducts() da API

### 3. Inconsistência de Documentação em subscription.ts
**Arquivo:** `src/lib/api/subscription.ts`  
**Linha:** 10  
**Problema:** Comentário diz "15-day trial" mas código usa 30 dias  
**Impacto:** Documentação incorreta  
**Severidade:** 🟢 BAIXA  
**Solução:** Corrigir comentário para "30-day trial"

### 4. Trial Não Criado Automaticamente no Registro
**Arquivo:** `src/lib/store/auth.ts`  
**Linhas:** 87-120  
**Problema:** Função register() cria usuário e empresa, mas NÃO cria subscription  
**Impacto:** Usuários não recebem trial de 30 dias automaticamente  
**Severidade:** 🔴 CRÍTICO  
**Solução:** Chamar createTrialSubscription() após criar empresa

### 5. Validação de Trial Ausente no Router
**Arquivo:** `src/lib/router.tsx`  
**Problema:** Não valida se trial está ativo antes de permitir acesso  
**Impacto:** Usuários com trial expirado ainda podem acessar  
**Severidade:** 🔴 CRÍTICO  
**Solução:** Adicionar validação de trial no ProtectedRoute

---

## 🔍 Bugs Adicionais a Investigar

### 6. Cancelamento de Vendas Não Implementado
**Arquivo:** `src/lib/api/sales.ts`  
**Problema:** Função cancelSale() existe mas não está integrada ao PDV  
**Impacto:** Não é possível cancelar vendas pela interface  
**Severidade:** 🟡 MÉDIA  
**Solução:** Criar interface de cancelamento no histórico de vendas

### 7. Estoque Não Atualizado em Vendas Mock
**Arquivo:** `src/lib/api/sales.ts`  
**Linhas:** 49-76  
**Problema:** Modo mock não atualiza estoque  
**Impacto:** Estoque não reflete vendas em desenvolvimento  
**Severidade:** 🟢 BAIXA  
**Solução:** Atualizar mockProducts após venda

### 8. RLS Policies Não Testadas
**Arquivo:** `supabase/tests/rls_integration_tests.sql`  
**Problema:** Testes criados mas nunca executados  
**Impacto:** Isolamento multiempresa não validado  
**Severidade:** 🔴 CRÍTICO  
**Solução:** Executar testes com Supabase local

---

## 📋 Plano de Correção

### Prioridade 1 (Críticos)
1. ✅ Corrigir company_id hardcoded em sales.ts
2. ✅ Integrar trial automático no registro
3. ✅ Adicionar validação de trial no router
4. ✅ Integrar produtos reais no PDV

### Prioridade 2 (Altos)
5. ✅ Corrigir documentação de trial
6. ✅ Implementar interface de cancelamento
7. ✅ Atualizar estoque no modo mock

### Prioridade 3 (Médios)
8. ✅ Executar testes RLS
9. ✅ Validar isolamento multiempresa

---

## 🎯 Critérios de Aceite

- [ ] Todos os bugs críticos corrigidos
- [ ] Trial criado automaticamente no registro
- [ ] Company_id obtido do contexto de autenticação
- [ ] PDV usando produtos reais
- [ ] Validação de trial no router
- [ ] Testes RLS executados
- [ ] Build aprovado
- [ ] Typecheck aprovado

---

**Auditoria realizada por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** 🔍 Concluída - 8 bugs identificados
