# Planejamento — Sprint 06: Finalização do MVP Core

**Data:** 2026-10-19  
**Status:** 📋 Planejamento  
**Duração Estimada:** 2 semanas  
**Objetivo:** Completar funcionalidades P0 críticas e preparar para homologação

---

## 🎯 Contexto

### O que foi feito até agora:
- ✅ Fase 1 - MVP Comercial (congelamento fiscal, trial, produtos, PDV, caixa)
- ✅ Análise de concorrentes (Bling e Tiny)
- ✅ Melhorias de UX (onboarding, checklist, preços, central de ajuda)
- ✅ Dashboard expandido (tendências, alertas, filtros, exportação)
- ✅ Melhorias no PDV (atalhos, busca, modo contínuo)
- ✅ Integrações de hardware (impressoras, scanners, gavetas)

### O que falta (P0):
- ❌ Integração do trial com fluxo de cadastro
- ❌ Controle de estoque completo (entrada, ajustes, inventário)
- ❌ Finalização atômica de vendas (com Supabase real)
- ❌ Cancelamento de vendas com estorno
- ❌ Validação de RLS policies em ambiente real

---

## 📋 Objetivos da Sprint 06

### Prioridade Alta (Semana 1)

#### 1. Integração Trial com Cadastro
**Status:** ⏳ Pendente  
**Complexidade:** Média

**Tarefas:**
- [ ] Modificar fluxo de registro para criar subscription automaticamente
- [ ] Validar acesso baseado no trial (API + RLS)
- [ ] Bloquear acesso após expiração
- [ ] Exibir dias restantes no banner
- [ ] Testar fluxo completo (cadastro → trial → expiração)

**Arquivos a modificar:**
- `src/pages/SignUpPage.tsx` - Integrar criação de subscription
- `src/lib/api/subscription.ts` - Função de criação automática
- `src/lib/router.tsx` - Validação de acesso
- `supabase/migrations/011_trial_subscription.sql` - Verificar RLS

**Critério de aceite:**
- Novo usuário recebe trial de 30 dias automaticamente
- Acesso é bloqueado após expiração
- Banner mostra dias restantes corretamente

#### 2. Controle de Estoque Completo
**Status:** ⏳ Pendente  
**Complexidade:** Alta

**Tarefas:**
- [ ] Criar página de entrada de estoque
- [ ] Criar página de ajustes de estoque
- [ ] Implementar inventário básico
- [ ] Alertas de estoque mínimo
- [ ] Histórico de movimentações
- [ ] Integração com vendas (atualização automática)

**Arquivos a criar:**
- `src/pages/StockEntryPage.tsx` - Entrada de estoque
- `src/pages/StockAdjustmentPage.tsx` - Ajustes
- `src/pages/InventoryPage.tsx` - Inventário
- `src/lib/api/stock.ts` - API de estoque

**Critério de aceite:**
- Entrada de estoque atualiza saldo
- Ajustes são auditáveis
- Vendas reduzem estoque automaticamente
- Alertas são exibidos quando estoque < mínimo

#### 3. Finalização Atômica de Vendas
**Status:** ⏳ Pendente  
**Complexidade:** Alta

**Tarefas:**
- [ ] Configurar Supabase local (Docker)
- [ ] Aplicar migrations 001-011
- [ ] Testar RPC `create_atomic_sale`
- [ ] Validar idempotência
- [ ] Testar rollback em caso de erro
- [ ] Integrar com PDVPage

**Arquivos a modificar:**
- `src/pages/PDVPage.tsx` - Usar API real
- `src/lib/api/sales.ts` - Garantir atomicidade
- `supabase/migrations/006_atomic_sale_rpc.sql` - Verificar

**Critério de aceite:**
- Venda é criada atomicamente (tudo ou nada)
- Estoque é atualizado corretamente
- Caixa é atualizado corretamente
- Idempotência previne duplicação

### Prioridade Média (Semana 2)

#### 4. Cancelamento de Vendas
**Status:** ⏳ Pendente  
**Complexidade:** Média

**Tarefas:**
- [ ] Criar interface de cancelamento
- [ ] Implementar estorno de estoque
- [ ] Implementar estorno financeiro
- [ ] Implementar estorno de caixa
- [ ] Registro de auditoria
- [ ] Validação de permissões

**Arquivos a criar/modificar:**
- `src/pages/SalesHistoryPage.tsx` - Histórico com cancelamento
- `src/lib/api/sales.ts` - Função `cancelSale`
- `supabase/migrations/007_sale_enhancements.sql` - Verificar

**Critério de aceite:**
- Venda pode ser cancelada (dentro do prazo)
- Estoque é restaurado
- Financeiro é estornado
- Caixa é ajustado
- Auditoria é registrada

#### 5. Validação de RLS Policies
**Status:** ⏳ Pendente  
**Complexidade:** Alta

**Tarefas:**
- [ ] Executar testes RLS (`supabase/tests/rls_integration_tests.sql`)
- [ ] Validar isolamento entre empresas
- [ ] Validar permissões por role
- [ ] Validar proteção contra manipulação de company_id
- [ ] Corrigir políticas se necessário

**Arquivos a validar:**
- `supabase/migrations/005_rls_policies.sql`
- `supabase/migrations/008_critical_fixes.sql`
- `supabase/migrations/009_fiscal_module.sql`
- `supabase/migrations/010_fiscal_rls_policies.sql`
- `supabase/tests/rls_integration_tests.sql`

**Critério de aceite:**
- Empresa A não vê dados da Empresa B
- Usuário não pode elevar seu próprio role
- Usuário não pode mudar de empresa
- RPCs validam propriedade

#### 6. Preparação para Homologação
**Status:** ⏳ Pendente  
**Complexidade:** Baixa

**Tarefas:**
- [ ] Criar script de seed com dados de teste
- [ ] Documentar processo de instalação
- [ ] Criar guia de homologação passo a passo
- [ ] Testar fluxo completo (cadastro → venda → relatório)
- [ ] Preparar ambiente de demonstração

**Arquivos a criar:**
- `supabase/seed/seed_data.sql` - Dados de teste
- `docs/HOMOLOGATION_GUIDE.md` - Guia de homologação
- `docs/DEMO_ENVIRONMENT.md` - Ambiente de demonstração

**Critério de aceite:**
- Script de seed cria dados válidos
- Guia é claro e completo
- Fluxo completo funciona sem erros

---

## 📊 Estimativa de Esforço

| Tarefa | Complexidade | Tempo Estimado | Prioridade |
|--------|--------------|----------------|------------|
| Integração Trial | Média | 2 dias | 🔴 Alta |
| Controle de Estoque | Alta | 3 dias | 🔴 Alta |
| Finalização Atômica | Alta | 2 dias | 🔴 Alta |
| Cancelamento de Vendas | Média | 2 dias | 🟡 Média |
| Validação RLS | Alta | 1 dia | 🟡 Média |
| Preparação Homologação | Baixa | 1 dia | 🟡 Média |

**Total:** ~11 dias (2 semanas + 1 dia)

---

## 🎯 Critérios de Sucesso da Sprint

### Funcional
- [ ] Trial integrado com cadastro
- [ ] Controle de estoque completo
- [ ] Finalização atômica funcionando
- [ ] Cancelamento de vendas implementado
- [ ] RLS policies validadas

### Técnico
- [ ] Supabase local configurado
- [ ] Migrations aplicadas sem erros
- [ ] Testes RLS passando
- [ ] Build aprovado
- [ ] Typecheck aprovado

### Qualidade
- [ ] Fluxo completo testado (cadastro → venda → relatório)
- [ ] Dados de teste criados
- [ ] Documentação atualizada
- [ ] Guia de homologação criado

---

## 🚧 Dependências e Riscos

### Dependências Externas
1. **Docker Desktop** - Necessário para Supabase local
2. **Supabase CLI** - Necessário para migrations
3. **Git** - Necessário para controle de versão

### Riscos Identificados
1. **Supabase local não disponível**
   - **Mitigação:** Usar Supabase Cloud (gratuito) para testes
   - **Impacto:** Alto (bloqueia homologação)

2. **RLS policies com bugs**
   - **Mitigação:** Testar extensivamente antes de produção
   - **Impacto:** Crítico (violação de dados)

3. **Finalização atômica com erros**
   - **Mitigação:** Testes exaustivos de rollback
   - **Impacto:** Alto (perda de dados)

---

## 📋 Checklist de Entrega

### Semana 1
- [ ] Integração Trial com Cadastro
- [ ] Controle de Estoque Completo
- [ ] Finalização Atômica de Vendas
- [ ] Build e typecheck aprovados

### Semana 2
- [ ] Cancelamento de Vendas
- [ ] Validação de RLS Policies
- [ ] Preparação para Homologação
- [ ] Documentação atualizada
- [ ] Relatório da sprint

---

## 🎯 Próxima Sprint (Sprint 07)

**Objetivo:** Validação com Loja Piloto

**Tarefas previstas:**
- [ ] Selecionar 3-5 lojas piloto
- [ ] Onboarding personalizado
- [ ] Coleta de feedback
- [ ] Correção de bugs críticos
- [ ] Ajustes de UX baseado em feedback
- [ ] Preparação para lançamento beta

---

## 📚 Documentação a Criar

| Arquivo | Descrição |
|---------|-----------|
| `SPRINT_06_PLAN.md` | Este planejamento |
| `HOMOLOGATION_GUIDE.md` | Guia de homologação passo a passo |
| `DEMO_ENVIRONMENT.md` | Configuração do ambiente de demonstração |
| `SPRINT_06_REPORT.md` | Relatório da sprint (ao final) |

---

## 🎉 Conclusão do Planejamento

**Próxima sprint:** Sprint 06 - Finalização do MVP Core  
**Duração:** 2 semanas  
**Objetivo principal:** Completar funcionalidades P0 críticas  
**Critério de sucesso:** MVP pronto para homologação com loja piloto

**Dependências críticas:**
1. Configurar Supabase local ou Cloud
2. Validar RLS policies
3. Testar finalização atômica

**Risco principal:** Supabase não disponível para testes reais  
**Mitigação:** Usar Supabase Cloud gratuito para homologação

---

**Planejamento elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Status:** 📋 Planejamento  
**Aprovação:** Pendente
