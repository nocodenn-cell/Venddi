# Venddi — Roadmap Atualizado

**Data:** 2026-10-19  
**Status:** ✅ Ativo  
**Decisão:** Congelar módulo fiscal, focar no MVP comercial

---

## 🎯 Visão Atualizada

### Mudança de Prioridade

**Decisão do Fundador (2026-10-19):**
- ❌ Congelar módulo fiscal (Focus NFe)
- ✅ Focar no MVP comercial do PDV
- ✅ Priorizar primeiro cliente pagante
- ✅ Validar produto no mercado antes de expandir

### Nova Prioridade

**Objetivo:** Conseguir uma Venddi simples, confiável e pronta para demonstração e validação comercial.

---

## 📅 Roadmap Revisado

### Fase 1 — MVP Comercial (ATUAL)

**Status:** 🔄 Em Desenvolvimento  
**Duração:** 4-6 semanas  
**Objetivo:** Produto mínimo viável para demonstração e primeiro cliente

#### P0 — Segurança e Infraestrutura ✅
- [x] Revisar migrations
- [x] Preparar instalação Supabase independente
- [x] Validar autenticação
- [x] Garantir isolamento multiempresa
- [ ] Corrigir bugs críticos
- [ ] Executar testes disponíveis

#### P0 — Cadastro e Trial 🔄
- [x] Schema de subscription criado
- [x] Migration 011 (trial & subscription)
- [x] API de subscription
- [x] Componente TrialStatusBanner
- [ ] Integração com fluxo de cadastro
- [ ] Provisionamento automático de trial
- [ ] Exibição de dias restantes
- [ ] Controle de expiração no backend

#### P0 — Produtos e Estoque ✅
- [x] CRUD completo de produtos
- [x] Categorias
- [x] Controle de estoque
- [x] Histórico de movimentações
- [ ] Entrada de estoque
- [ ] Ajustes auditáveis
- [ ] Estoque mínimo com alertas

#### P0 — PDV e Caixa ✅
- [x] Busca rápida de produtos
- [x] Carrinho de compras
- [x] Múltiplas formas de pagamento
- [x] Pagamento dividido
- [x] Cálculo de troco
- [x] Abertura e fechamento de caixa
- [x] Sangria e suprimento
- [ ] Finalização atômica (com Supabase)
- [ ] Idempotência (com Supabase)
- [ ] Cancelamento de vendas
- [ ] Histórico auditável

#### P1 — Gestão e BI ✅
- [x] Dashboard com indicadores
- [x] Faturamento diário/mensal
- [x] Ticket médio
- [x] Produtos mais vendidos
- [x] Formas de pagamento
- [x] Vendas por operador
- [ ] Estoque baixo com alertas
- [ ] Relatórios de caixa
- [ ] Indicadores calculados com dados persistidos

#### P1 — Preparação Comercial 🔄
- [x] Página de preços
- [ ] Onboarding simples
- [ ] Demonstração comercial
- [ ] Orientações de uso
- [ ] Controle de assinatura
- [ ] Planejamento da cobrança recorrente
- [ ] Termos e privacidade para revisão
- [ ] Backup e restauração testados

---

### Fase 2 — Módulo Fiscal (CONGELADO)

**Status:** ❌ Congelado  
**Duração:** Indefinida  
**Objetivo:** Retomar após primeiro cliente pagante

#### Motivo do Congelamento

1. **Sem clientes pagantes ainda**
   - Não há demanda validada
   - Custo de integração sem retorno garantido

2. **Complexidade fiscal**
   - Cada estado tem regras diferentes
   - Requer consultoria contábil especializada
   - Responsabilidade legal significativa

3. **Foco no core business**
   - PDV é o produto principal
   - Fiscal é complemento, não essencial para MVP
   - Comerciantes podem usar sistemas fiscais dedicados

#### O que foi preservado

✅ **Código completo do módulo fiscal**
- Migration 009 (fiscal_module)
- Migration 010 (fiscal_rls_policies)
- Schemas TypeScript
- FocusNFeProvider (adaptador)
- MockFiscalProvider (testes)
- FiscalService (lógica de domínio)
- Interface de configuração fiscal

✅ **Documentação completa**
- Estudo técnico da Focus NFe
- Arquitetura do módulo
- Plano de homologação (15 cenários)
- Relatório de implementação
- Relatório de auditoria

✅ **Feature Flag**
- FISCAL_ENABLED = false
- Bloqueio efetivo no backend
- Fácil reativação futura

#### Critérios para Retomada

O módulo fiscal será retomado quando:

1. ✅ **Primeiro cliente pagante**
   - Validar produto no mercado
   - Gerar receita recorrente
   - Ter feedback real de usuários

2. ✅ **Demanda validada**
   - Múltiplos clientes solicitando emissão fiscal
   - Perda de oportunidades por falta de NFC-e
   - Custo de integração justificado

3. ✅ **Recursos disponíveis**
   - Time dedicado para desenvolvimento fiscal
   - Orçamento para consultoria contábil
   - Tempo para testes e homologação

---

### Fase 3 — Expansão (FUTURO)

**Status:** 📋 Planejado  
**Duração:** Indefinida  
**Objetivo:** Expandir funcionalidades após validação do MVP

#### Funcionalidades Planejadas

1. **Marketplace Integration**
   - Integração com Mercado Livre
   - Integração com Shopee
   - Sincronização de estoque

2. **E-commerce**
   - Loja virtual integrada
   - Checkout online
   - Gestão de pedidos

3. **POS Hardware**
   - Integração com maquininhas
   - Impressoras térmicas
   - Leitores de código de barras

4. **Advanced BI**
   - Power BI incorporado
   - Análises preditivas
   - Recomendações automáticas

5. **Multi-location**
   - Múltiplas lojas
   - Transferência entre lojas
   - Consolidação de relatórios

---

## 🎯 Objetivos de Curto Prazo (Próximas 4 Semanas)

### Semana 1-2: Finalizar MVP Core

**Prioridade:** P0

- [ ] Completar integração de cadastro com trial
- [ ] Implementar controle de expiração
- [ ] Finalizar CRUD de produtos com estoque
- [ ] Completar PDV com finalização atômica
- [ ] Implementar cancelamento de vendas

### Semana 3: Preparação Comercial

**Prioridade:** P1

- [ ] Criar onboarding simplificado
- [ ] Preparar demonstração comercial
- [ ] Revisar termos de uso e privacidade
- [ ] Implementar backup e restauração
- [ ] Testar fluxo completo (cadastro → venda → relatório)

### Semana 4: Validação e Lançamento

**Prioridade:** P0

- [ ] Executar testes completos
- [ ] Corrigir bugs críticos
- [ ] Preparar ambiente de demonstração
- [ ] Criar materiais de vendas
- [ ] Lançar beta fechado com 3-5 lojas piloto

---

## 📊 Métricas de Sucesso

### MVP Comercial

| Métrica | Meta | Status |
|---------|------|--------|
| Cadastros realizados | 50 | ⏳ Pendente |
| Trial ativos | 20 | ⏳ Pendente |
| Conversão trial → pago | 10% | ⏳ Pendente |
| Clientes pagantes | 5 | ⏳ Pendente |
| MRR (Monthly Recurring Revenue) | R$ 1.000 | ⏳ Pendente |

### Qualidade do Produto

| Métrica | Meta | Status |
|---------|------|--------|
| Build passing | 100% | ✅ Atingido |
| Typecheck passing | 100% | ✅ Atingido |
| Testes unitários | 80% cobertura | ⏳ Pendente |
| Bugs críticos | 0 | ⏳ Pendente |
| Tempo de resposta | < 2s | ⏳ Pendente |

---

## 🚧 Bloqueadores Atuais

### Críticos

1. **Supabase não configurado**
   - Migrations não aplicadas
   - Persistência não funciona
   - **Solução:** Configurar Supabase local

2. **Testes não executados**
   - Testes unitários preparados mas não rodados
   - Testes de integração pendentes
   - **Solução:** Executar testes com Supabase local

### Não-críticos

1. **Feature flags não testadas**
   - Sistema de feature flags criado
   - Não validado em produção
   - **Solução:** Testar com módulo fiscal desabilitado

2. **Trial não integrado**
   - Schema e API criados
   - Não integrado com fluxo de cadastro
   - **Solução:** Completar integração

---

## 📈 Roadmap Visual

```
2026-Q4 (OUT-DEZ)
├── Outubro
│   ├── Semana 1-2: MVP Core (P0)
│   ├── Semana 3: Preparação Comercial (P1)
│   └── Semana 4: Validação e Lançamento
│
├── Novembro
│   ├── Semana 1-2: Beta Fechado (3-5 lojas)
│   ├── Semana 3: Coleta de Feedback
│   └── Semana 4: Ajustes e Melhorias
│
└── Dezembro
    ├── Semana 1-2: Lançamento Público (Beta)
    ├── Semana 3: Marketing e Vendas
    └── Semana 4: Avaliação e Planejamento 2027

2027-Q1 (JAN-MAR)
├── Janeiro
│   ├── Primeiro cliente pagante (meta)
│   ├── Validação de produto
│   └── Iterações baseadas em feedback
│
├── Fevereiro
│   ├── Crescimento base de clientes
│   ├── Melhorias de UX
│   └── Avaliação de módulo fiscal
│
└── Março
    ├── Decisão: Retomar módulo fiscal?
    ├── Se SIM: Iniciar Fase 2
    └── Se NÃO: Focar em expansão de features

2027-Q2 (ABR-JUN)
├── Abril-Junho
│   ├── Fase 2: Módulo Fiscal (se aprovado)
│   ├── OU Expansão de Features (se adiado)
│   └── Preparação para escala
```

---

## 🎯 Princípios Guia

### Para esta fase (MVP Comercial):

1. **Simplicidade acima de complexidade**
   - Focar no essencial
   - Não adicionar features sem demanda validada

2. **Velocidade acima de perfeição**
   - Lançar rápido
   - Iterar baseado em feedback

3. **Clientes acima de features**
   - Priorizar necessidades reais
   - Validar com usuários reais

4. **Receita acima de escala**
   - Primeiro cliente pagante
   - Depois pensar em crescimento

### Para fases futuras:

1. **Qualidade acima de velocidade**
   - Testes completos
   - Documentação adequada

2. **Segurança acima de conveniência**
   - Criptografia de dados sensíveis
   - Auditoria completa

3. **Escalabilidade acima de funcionalidade**
   - Arquitetura preparada para crescimento
   - Performance otimizada

---

## 📚 Documentação Relacionada

- [ROADMAP.md](./ROADMAP.md) — Roadmap original (desatualizado)
- [BACKLOG.md](./BACKLOG.md) — Backlog de features
- [PROGRESS.md](./PROGRESS.md) — Progresso atual
- [AVISO-LEGAL-FISCAL.md](/AVISO-LEGAL-FISCAL.md) — Aviso sobre módulo fiscal

---

**Última atualização:** 2026-10-19  
**Próxima revisão:** 2026-11-19 (após 30 dias)  
**Responsável:** Time Venddi
