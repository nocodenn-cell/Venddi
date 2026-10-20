# Guia de Execução de Testes - Sprint 08

**Data:** 2026-10-19  
**Objetivo:** Executar testes automatizados no ambiente local

---

## 🚀 Passo a Passo

### 1. Atualizar Código

```bash
cd C:\Naturecode\venddi-github

# Se já tem o repositório
git pull origin feat/sprint-08-homologation

# OU se precisa clonar
git clone https://github.com/nocodenn-cell/Venddi.git
cd Venddi
git checkout feat/sprint-08-homologation
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Verificar .env

```bash
type .env
```

**Deve conter:**
```
VITE_SUPABASE_URL=https://jcvblxyzceszzehehyjd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Executar Testes Unitários

```bash
npm run test
```

**Resultado esperado:**
```
✓ wholesale-calculations.test.ts (15 tests)
✓ sales-validation.test.ts (12 tests)
✓ schema-validation.test.ts (8 tests)

Test Files  3 passed (3)
Tests      35 passed (35)
```

**Se algum teste falhar:**
- Anote o nome do teste
- Anote a mensagem de erro
- Me envie para correção

### 5. Executar Testes E2E

```bash
# Instalar browsers do Playwright (primeira vez)
npx playwright install

# Executar testes
npx playwright test
```

**Resultado esperado:**
```
Running 15 tests using 1 worker

✓ fluxos-criticos.spec.ts (15 tests)

15 passed (Xs)
```

**Se algum teste falhar:**
- Anote o nome do teste
- Tire screenshot (automático em falhas)
- Anote a mensagem de erro
- Me envie para correção

### 6. Verificar Cobertura (Opcional)

```bash
npm run test -- --coverage
```

**Resultado esperado:**
- Cobertura > 70% das funções testadas

---

## 📋 Checklist de Execução

### Pré-requisitos
- [ ] Node.js 18+ instalado
- [ ] npm instalado
- [ ] .env configurado
- [ ] Supabase rodando (local ou cloud)
- [ ] Migrations aplicadas

### Testes Unitários
- [ ] `npm run test` executado
- [ ] Todos os 35 testes passaram
- [ ] Sem erros no console

### Testes E2E
- [ ] `npx playwright install` executado
- [ ] `npx playwright test` executado
- [ ] Todos os 15 testes passaram
- [ ] Sem erros no console

### Reportar Resultados
- [ ] Screenshot dos resultados
- [ ] Lista de testes que passaram
- [ ] Lista de testes que falharam (se houver)
- [ ] Mensagens de erro (se houver)

---

## 🐛 Se Encontrar Bugs

### Template para Reportar

```markdown
## Bug Encontrado no Teste

**Teste:** [Nome do teste]
**Arquivo:** [Caminho do arquivo]
**Linha:** [Número da linha]

**Erro:**
```
[Cole a mensagem de erro completa]
```

**Passos para Reproduzir:**
1. [Primeiro passo]
2. [Segundo passo]
3. [Terceiro passo]

**Resultado Esperado:**
[O que deveria acontecer]

**Resultado Real:**
[O que realmente aconteceu]

**Screenshot:**
[Anexe screenshot se possível]

**Ambiente:**
- SO: [Windows/Mac/Linux]
- Node: [versão]
- npm: [versão]
- Navegador: [Chrome/Firefox/Edge]
```

---

## 📊 Métricas de Sucesso

### Meta da Sprint 08

| Métrica | Meta | Resultado |
|---------|------|-----------|
| Testes unitários | 35 | [A preencher] |
| Testes E2E | 15 | [A preencher] |
| Taxa de sucesso | 100% | [A preencher] |
| Tempo de execução | < 2 min | [A preencher] |
| Cobertura | > 70% | [A preencher] |

---

## 🎯 Próximos Passos Após Testes

### Se Todos os Testes Passarem ✅

1. **Otimizar Performance**
   - Code splitting
   - Lazy loading
   - Reduzir bundle size

2. **Preparar Loja Piloto**
   - Selecionar loja
   - Criar materiais
   - Configurar ambiente

3. **Lançar Beta**
   - Deploy em produção
   - Onboarding da loja
   - Monitoramento

### Se Alguns Testes Falharem ❌

1. **Analisar Falhas**
   - Identificar causa raiz
   - Priorizar bugs críticos
   - Criar plano de correção

2. **Corrigir Bugs**
   - Implementar correções
   - Re-executar testes
   - Validar correções

3. **Re-testar**
   - Executar todos os testes
   - Garantir 100% de sucesso
   - Documentar resultados

---

## 📞 Suporte

### Problemas Comuns

**Problema:** "Cannot find module '@playwright/test'"
**Solução:** `npm install @playwright/test`

**Problema:** "Browser not installed"
**Solução:** `npx playwright install`

**Problema:** "Supabase not configured"
**Solução:** Verificar arquivo `.env`

**Problema:** "Tests failing"
**Solução:** Verificar se Supabase está rodando e migrations aplicadas

### Contato

- **Documentação:** `docs/SPRINT_08_HOMOLOGATION_REPORT.md`
- **Testes:** `src/lib/__tests__/` e `e2e/`
- **Configuração:** `vitest.config.ts` e `playwright.config.ts`

---

## ✅ Checklist Final

Antes de me enviar o relatório:

- [ ] Executei todos os testes unitários
- [ ] Executei todos os testes E2E
- [ ] Anotei resultados (passou/falhou)
- [ ] Capturei screenshots (se necessário)
- [ ] Reportei bugs encontrados
- [ ] Informei métricas de performance

---

**Pronto para executar! 🚀**

Me envie os resultados após executar os testes!
