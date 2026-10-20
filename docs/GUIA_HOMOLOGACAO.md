# Guia de Homologação - Venddi

**Data:** 2026-10-19  
**Versão:** 1.0  
**Status:** ✅ Pronto para Execução

---

## 🎯 Objetivo

Este guia fornece instruções passo a passo para configurar o ambiente local de homologação da Venddi e validar todos os fluxos críticos antes do lançamento para loja piloto.

---

## 📋 Pré-requisitos

### Software Necessário

1. **Node.js** (v18+)
   ```bash
   node --version
   # Deve retornar v18.x.x ou superior
   ```

2. **npm** (v9+)
   ```bash
   npm --version
   # Deve retornar 9.x.x ou superior
   ```

3. **Docker Desktop**
   - Download: https://www.docker.com/products/docker-desktop
   - Instalar e iniciar o Docker Desktop
   - Verificar: `docker --version`

4. **Supabase CLI**
   ```bash
   npm install -g supabase
   supabase --version
   # Deve retornar 2.x.x ou superior
   ```

5. **Git**
   ```bash
   git --version
   # Deve retornar 2.x.x ou superior
   ```

### Hardware Recomendado

- **CPU:** 4 cores ou mais
- **RAM:** 8GB ou mais
- **Disco:** 10GB livres
- **Internet:** Conexão estável

---

## 🚀 Passo 1: Clonar o Repositório

```bash
# Navegar até o diretório de projetos
cd C:\Naturecode

# Clonar o repositório (se ainda não clonado)
git clone <repository-url> venddi
cd venddi

# Ou, se já clonado, atualizar para a branch da Sprint 06
git checkout feat/sprint-06-mvp-consolidation
git pull origin feat/sprint-06-mvp-consolidation
```

---

## 🔧 Passo 2: Instalar Dependências

```bash
# Instalar todas as dependências
npm install

# Verificar se não há erros
npm list --depth=0
```

**Tempo estimado:** 2-5 minutos

---

## 🗄️ Passo 3: Configurar Supabase Local

### 3.1 Iniciar Supabase

```bash
# Iniciar o Supabase local
supabase start
```

**Aguarde** até ver a mensagem:
```
Started Supabase local development setup.

You can now view your projects in the browser:
- Studio: http://localhost:54323
- API: http://localhost:54321
```

**Anote as credenciais:**
```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.2 Configurar Variáveis de Ambiente

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<cole-a-anon-key-aqui>
```

**⚠️ IMPORTANTE:** 
- Use APENAS a `anon key` (NÃO use `service_role`)
- Nunca commite o arquivo `.env`
- O `.gitignore` já está configurado para ignorar `.env`

### 3.3 Aplicar Migrations

```bash
# Aplicar todas as migrations
supabase db reset
```

**O que isso faz:**
1. Reseta o banco de dados
2. Aplica migrations 001-011 em ordem
3. Cria tabelas, índices e funções
4. Configura RLS policies

**Tempo estimado:** 30-60 segundos

### 3.4 Verificar Migrations

```bash
# Conectar ao banco
psql -h localhost -p 54322 -U postgres -d postgres

# Listar tabelas
\dt

# Esperado: 15+ tabelas
# - companies
# - users
# - products
# - sales
# - sale_items
# - payments
# - cash_registers
# - cash_movements
# - financial_accounts
# - company_subscriptions
# - audit_logs
# - etc.

# Listar funções
\df

# Esperado: 10+ funções
# - create_atomic_sale
# - cancel_sale_with_reversal
# - get_user_company_id
# - is_trial_active
# - get_remaining_trial_days
# - etc.

# Sair
\q
```

---

## 🧪 Passo 4: Executar Testes

### 4.1 Testes de Isolamento RLS

```bash
# Conectar ao banco
psql -h localhost -p 54322 -U postgres -d postgres

# Executar testes RLS
\i supabase/tests/rls_integration_tests.sql
```

**Resultado esperado:**
```
test1_count | test1_cross_company
------------+---------------------
          2 |                   0

test2_count | test2_cross_company
------------+---------------------
          1 |                   0

...

-- Todos os testes devem passar
```

**Se algum teste falhar:**
1. Verificar se todas as migrations foram aplicadas
2. Verificar se RLS policies estão habilitadas
3. Consultar `docs/SPRINT_06_AUDITORIA.md`

### 4.2 Testes Unitários

```bash
# Executar testes unitários
npm run test
```

**Resultado esperado:**
```
✓ permissions.test.ts (11 tests)
✓ sales.test.ts (13 tests)
✓ schemas.test.ts (7 tests)
✓ utils.test.ts (6 tests)

Test Files  4 passed (4)
Tests      37 passed (37)
```

### 4.3 Build de Produção

```bash
# Gerar build de produção
npm run build
```

**Resultado esperado:**
```
✓ 1570 modules transformed
dist/index.html                   3.29 kB
dist/assets/index-*.css          41.09 kB
dist/assets/index-*.js          720.75 kB
✓ built in 9.00s
```

---

## 🌐 Passo 5: Iniciar Aplicação

```bash
# Iniciar servidor de desenvolvimento
npm run dev
```

**Acesse:** http://localhost:3000

---

## ✅ Passo 6: Validar Fluxos Críticos

### Fluxo 1: Cadastro com Trial Automático

1. **Acessar página de cadastro**
   - URL: http://localhost:3000/cadastro
   - Preencher formulário:
     - Nome: "João Silva"
     - Email: "joao@teste.com"
     - Senha: "123456"
     - Nome da loja: "Loja Teste"
     - CNPJ: "12.345.678/0001-90"

2. **Verificar criação automática de trial**
   ```bash
   # Conectar ao banco
   psql -h localhost -p 54322 -U postgres -d postgres
   
   # Verificar subscription
   SELECT * FROM company_subscriptions WHERE company_id = (
     SELECT id FROM companies WHERE cnpj = '12.345.678/0001-90'
   );
   ```
   
   **Resultado esperado:**
   ```
   status | trial_days | trial_end_date
   -------+------------+------------------
   trial  |         30 | 2026-11-18 ...
   ```

3. **Verificar TrialStatusBanner**
   - Banner deve aparecer no topo
   - Mostrar "Trial ativo - 30 dias restantes"

### Fluxo 2: Venda com PDV

1. **Abrir caixa**
   - Menu: Caixas → Abrir Caixa
   - Valor inicial: R$ 100,00
   - Confirmar

2. **Cadastrar produto de teste**
   - Menu: Produtos → Novo Produto
   - Nome: "Produto Teste"
   - SKU: "TEST-001"
   - Preço: R$ 50,00
   - Estoque: 10
   - Salvar

3. **Realizar venda**
   - Menu: PDV
   - Buscar "Produto Teste"
   - Adicionar ao carrinho (quantidade: 2)
   - Total: R$ 100,00
   - Selecionar pagamento: Dinheiro
   - Finalizar venda

4. **Verificar atualizações**
   ```bash
   # Verificar venda
   SELECT * FROM sales WHERE sale_number = 1;
   
   # Verificar estoque
   SELECT stock_quantity FROM products WHERE sku = 'TEST-001';
   # Esperado: 8 (10 - 2)
   
   # Verificar movimentação de caixa
   SELECT * FROM cash_movements WHERE type = 'sale';
   # Esperado: 1 registro com amount = 100.00
   ```

### Fluxo 3: Cancelamento de Venda

1. **Acessar histórico de vendas**
   - Menu: Vendas
   - Localizar venda #1

2. **Cancelar venda**
   - Clicar em "Cancelar"
   - Motivo: "Cancelamento de teste - erro de digitação"
   - Confirmar

3. **Verificar estornos**
   ```bash
   # Verificar status da venda
   SELECT status FROM sales WHERE sale_number = 1;
   # Esperado: 'cancelled'
   
   # Verificar estoque restaurado
   SELECT stock_quantity FROM products WHERE sku = 'TEST-001';
   # Esperado: 10 (restaurado)
   
   # Verificar estorno de caixa
   SELECT * FROM cash_movements WHERE type = 'refund';
   # Esperado: 1 registro com amount = 100.00
   
   # Verificar auditoria
   SELECT * FROM audit_logs WHERE action = 'sale.cancel';
   # Esperado: 1 registro
   ```

### Fluxo 4: Expiração de Trial

1. **Simular expiração de trial**
   ```bash
   # Conectar ao banco
   psql -h localhost -p 54322 -U postgres -d postgres
   
   # Atualizar trial_end_date para ontem
   UPDATE company_subscriptions 
   SET trial_end_date = NOW() - INTERVAL '1 day'
   WHERE company_id = (
     SELECT id FROM companies WHERE cnpj = '12.345.678/0001-90'
   );
   ```

2. **Tentar acessar sistema**
   - Fazer logout
   - Fazer login novamente
   - Tentar acessar /app/pdv

3. **Verificar redirecionamento**
   - Deve ser redirecionado para /precos
   - Mensagem: "Trial expirado. Assine um plano para continuar."

4. **Restaurar trial**
   ```bash
   # Restaurar trial para 30 dias
   UPDATE company_subscriptions 
   SET trial_end_date = NOW() + INTERVAL '30 days'
   WHERE company_id = (
     SELECT id FROM companies WHERE cnpj = '12.345.678/0001-90'
   );
   ```

---

## 🔒 Passo 7: Validar Segurança

### 7.1 Isolamento Multiempresa

1. **Criar segunda empresa**
   - Logout
   - Cadastrar nova empresa:
     - Nome: "Maria Santos"
     - Email: "maria@teste.com"
     - Senha: "123456"
     - Nome da loja: "Loja Maria"
     - CNPJ: "98.765.432/0001-10"

2. **Verificar isolamento**
   ```bash
   # Conectar ao banco
   psql -h localhost -p 54322 -U postgres -d postgres
   
   # Verificar produtos da empresa 1
   SELECT COUNT(*) FROM products WHERE company_id = (
     SELECT id FROM companies WHERE cnpj = '12.345.678/0001-90'
   );
   # Esperado: 1 (Produto Teste)
   
   # Verificar produtos da empresa 2
   SELECT COUNT(*) FROM products WHERE company_id = (
     SELECT id FROM companies WHERE cnpj = '98.765.432/0001-10'
   );
   # Esperado: 0 (nenhum produto)
   ```

3. **Testar acesso cruzado**
   - Login como "joao@teste.com"
   - Tentar acessar produto da empresa 2 via API
   - **Resultado esperado:** Acesso negado (RLS)

### 7.2 Permissões por Role

1. **Criar usuário cashier**
   - Login como owner (joao@teste.com)
   - Menu: Configurações → Usuários
   - Criar usuário:
     - Nome: "Operador Caixa"
     - Email: "operador@teste.com"
     - Senha: "123456"
     - Role: cashier

2. **Testar permissões**
   - Login como "operador@teste.com"
   - Verificar menus disponíveis:
     - ✅ PDV
     - ✅ Caixas
     - ❌ Configurações
     - ❌ Financeiro
   - Tentar acessar /app/configuracoes
   - **Resultado esperado:** Acesso negado

---

## 📊 Passo 8: Gerar Relatório de Homologação

Crie um arquivo `HOMOLOGACAO_REPORT.md` com:

```markdown
# Relatório de Homologação

**Data:** [DATA]
**Ambiente:** Supabase Local
**Versão:** Sprint 06

## ✅ Testes Realizados

### Fluxos Críticos
- [ ] Cadastro com trial automático
- [ ] Venda com PDV
- [ ] Cancelamento de venda
- [ ] Expiração de trial

### Segurança
- [ ] Isolamento multiempresa
- [ ] Permissões por role
- [ ] RLS policies

### Performance
- [ ] Tempo de resposta < 2s
- [ ] Build sem erros
- [ ] Typecheck sem erros

## 🐛 Bugs Encontrados

[Listar bugs encontrados durante homologação]

## 📝 Observações

[Observações gerais sobre a homologação]

## ✅ Status Final

- [ ] Pronto para loja piloto
- [ ] Requer ajustes
- [ ] Não recomendado
```

---

## 🎯 Passo 9: Preparar para Loja Piloto

### 9.1 Selecionar Loja Piloto

**Critérios:**
- Loja física pequena (1-5 caixas)
- Alto volume de vendas (50+ vendas/dia)
- Produtos diversificados (100+ SKUs)
- Proprietário disposto a dar feedback
- Localização próxima (para suporte presencial)

### 9.2 Preparar Ambiente de Produção

**Opção A: Supabase Cloud (Recomendado)**
```bash
# Criar projeto em https://supabase.com
# Anotar credenciais
# Atualizar .env com credenciais de produção
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

**Opção B: Servidor Próprio**
- Instalar PostgreSQL 15+
- Configurar Supabase self-hosted
- Configurar SSL
- Configurar backup automático

### 9.3 Deploy da Aplicação

**Opção A: Vercel (Recomendado)**
```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

**Opção B: Netlify**
```bash
# Instalar Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

### 9.4 Configurar Domínio

1. **Comprar domínio** (ex: venddi.com.br)
2. **Configurar DNS** para apontar para Vercel/Netlify
3. **Configurar SSL** (automático na Vercel/Netlify)
4. **Testar acesso** via domínio personalizado

---

## 📞 Suporte

### Documentação Interna
- `docs/SPRINT_06_RESULTADO.md` - Resultado da Sprint 06
- `docs/SPRINT_06_AUDITORIA.md` - Auditoria de bugs
- `docs/VENDDI_HOMOLOGATION_PLAN.md` - Plano de homologação

### Documentação Externa
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)

### Contato
- **Email:** suporte@venddi.com.br
- **WhatsApp:** (11) 99999-9999
- **Horário:** Seg-Sex, 8h-18h

---

## ✅ Checklist Final

### Pré-Homologação
- [ ] Docker Desktop instalado e rodando
- [ ] Supabase CLI instalado
- [ ] Dependências instaladas (`npm install`)
- [ ] Supabase local iniciado (`supabase start`)
- [ ] Migrations aplicadas (`supabase db reset`)
- [ ] Variáveis de ambiente configuradas (`.env`)

### Testes
- [ ] Testes RLS executados
- [ ] Testes unitários executados
- [ ] Build de produção gerado
- [ ] Aplicação iniciada (`npm run dev`)

### Fluxos Críticos
- [ ] Cadastro com trial automático
- [ ] Venda com PDV
- [ ] Cancelamento de venda
- [ ] Expiração de trial

### Segurança
- [ ] Isolamento multiempresa validado
- [ ] Permissões por role validadas
- [ ] RLS policies funcionando

### Produção
- [ ] Loja piloto selecionada
- [ ] Ambiente de produção configurado
- [ ] Deploy realizado
- [ ] Domínio configurado
- [ ] SSL ativo

---

**Guia elaborado por:** Venddi Team  
**Data:** 2026-10-19  
**Versão:** 1.0  
**Status:** ✅ Pronto para Execução
