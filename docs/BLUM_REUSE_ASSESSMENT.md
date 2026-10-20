# BLUM ERP — Sprint 00: Análise de Reutilização

**Produto:** Blum ERP  
**Empresa:** Mature Code  
**Público-alvo:** Pequenas lojas físicas  
**Data:** 2026-10-19  
**Status:** Diagnóstico inicial (Jinlong indisponível)

---

## 1. Limitação de Acesso ao Jinlong

### Status

O repositório Jinlong **não está disponível** no workspace atual. Não foi possível localizar:
- Diretório `jinlong/` ou `jinlong-erp/`
- Referências ao Jinlong em `package.json`, `README.md` ou configurações
- Módulos, componentes ou schemas compartilhados

### Impacto

Sem acesso ao código-fonte do Jinlong, não é possível realizar:
- Inventário de módulos reutilizáveis
- Análise de dependências e acoplamento
- Avaliação de regras de negócio genéricas
- Identificação de RPCs, migrations e componentes de UI

### Recomendação

Para completar esta análise, é necessário:
1. Clonar o repositório Jinlong em um diretório acessível
2. Garantir acesso de leitura às branches relevantes
3. Documentar a arquitetura atual (se existir)
4. Identificar módulos críticos para o Blum

**Ação necessária:** Solicitar acesso ao repositório Jinlong ou fornecer um dump estruturado da arquitetura.

---

## 2. Diagnóstico do Blum ERP (Sem Jinlong)

### 2.1 Requisitos do MVP

**Público-alvo:** Pequenas lojas físicas (1-5 caixas, até 50 funcionários)

**Funcionalidades essenciais:**
- PDV (Ponto de Venda) com emissão de NFC-e
- Controle de estoque básico (entradas, saídas, inventário)
- Cadastro de produtos e clientes
- Vendas e histórico de transações
- Financeiro básico (contas a pagar/receber, fluxo de caixa)
- Relatórios gerenciais simples
- Administração de usuários e permissões

**Fora do escopo (MVP):**
- Marketplaces (Mercado Livre, Shopee, Amazon)
- E-commerce / Loja virtual
- Integrações com transportadoras
- Multi-empresa / Multi-filial
- Ordem de produção
- Nota fiscal de serviço (NFS-e)

### 2.2 Stack Tecnológica Recomendada

**Frontend:**
- React 18+ com TypeScript
- Vite (build tool)
- Tailwind CSS (estilização)
- Zustand ou Redux Toolkit (state management)
- React Query / TanStack Query (server state)
- React Hook Form + Zod (formulários e validação)

**Backend:**
- Supabase (PostgreSQL + Auth + Realtime + Storage)
- Edge Functions (Deno) para lógica de negócio crítica
- Row Level Security (RLS) para multi-tenancy

**Infraestrutura:**
- Supabase (hosting do banco e auth)
- Vercel ou Netlify (frontend)
- GitHub Actions (CI/CD)

**Ferramentas:**
- ESLint + Prettier (code quality)
- Vitest (testes unitários)
- Playwright (testes E2E)

---

## 3. Arquitetura Recomendada para o Blum

### 3.1 Estrutura de Módulos

```
blum-erp/
├── apps/
│   └── web/                    # Aplicação React
│       ├── src/
│       │   ├── modules/        # Módulos de negócio
│       │   │   ├── pdv/        # Ponto de Venda
│       │   │   ├── inventory/  # Estoque
│       │   │   ├── sales/      # Vendas
│       │   │   ├── financial/  # Financeiro
│       │   │   ├── admin/      # Administração
│       │   │   └── reports/    # Relatórios
│       │   ├── shared/         # Componentes compartilhados
│       │   │   ├── components/ # UI components
│       │   │   ├── hooks/      # Custom hooks
│       │   │   ├── utils/      # Utilitários
│       │   │   └── types/      # TypeScript types
│       │   └── lib/            # Bibliotecas e configs
│       └── package.json
├── packages/
│   ├── database/               # Schemas e migrations
│   │   ├── migrations/
│   │   ├── seed/
│   │   └── types.ts            # Generated types
│   ├── shared/                 # Código compartilhado
│   │   ├── validators/         # Zod schemas
│   │   ├── constants/          # Constantes de negócio
│   │   └── utils/              # Utilitários
│   └── ui/                     # Design system
│       ├── components/
│       └── styles/
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Migrations do Supabase
└── docs/
```

### 3.2 Módulos de Negócio

#### Módulo PDV (Ponto de Venda)

**Responsabilidades:**
- Interface de venda rápida (teclado/touch)
- Emissão de NFC-e (Nota Fiscal do Consumidor Eletrônica)
- Cancelamento e devolução de vendas
- Abertura e fechamento de caixa
- Múltiplas formas de pagamento

**Entidades principais:**
- `sale` (venda)
- `sale_item` (item da venda)
- `payment` (pagamento)
- `cash_register` (caixa)
- `nfc_e` (nota fiscal)

**Regras de negócio:**
- Validação de estoque antes da venda
- Cálculo automático de impostos (ICMS, PIS, COFINS)
- Geração de DANFE simplificado
- Controle de sangrias e suprimentos

#### Módulo Estoque (Inventory)

**Responsabilidades:**
- Cadastro de produtos (simples e composto)
- Controle de entradas (compras, devoluções)
- Controle de saídas (vendas, perdas)
- Inventário rotativo
- Alertas de estoque mínimo

**Entidades principais:**
- `product` (produto)
- `product_variant` (variação - cor, tamanho)
- `stock_movement` (movimentação)
- `stock_adjustment` (ajuste de inventário)
- `supplier` (fornecedor)

**Regras de negócio:**
- Controle de lote e validade (opcional)
- Custo médio ponderado
- Multiple depósitos (futuro)
- Código de barras (EAN-13)

#### Módulo Vendas (Sales)

**Responsabilidades:**
- Histórico de vendas
- Gestão de clientes
- Orçamentos e propostas
- Comissões de vendedores

**Entidades principais:**
- `customer` (cliente)
- `quotation` (orçamento)
- `salesperson` (vendedor)
- `commission` (comissão)

**Regras de negócio:**
- Limite de crédito do cliente
- Histórico de compras
- Segmentação de clientes

#### Módulo Financeiro (Financial)

**Responsabilidades:**
- Contas a pagar
- Contas a receber
- Fluxo de caixa
- Conciliação bancária (futuro)

**Entidades principais:**
- `account_payable` (conta a pagar)
- `account_receivable` (conta a receber)
- `cash_flow` (fluxo de caixa)
- `bank_account` (conta bancária)
- `financial_transaction` (transação)

**Regras de negócio:**
- Categorização de despesas/receitas
- Alertas de vencimento
- Projeção de fluxo de caixa

#### Módulo Administração (Admin)

**Responsabilidades:**
- Gestão de usuários e permissões
- Configurações da empresa
- Logs de auditoria
- Parametrização do sistema

**Entidades principais:**
- `user` (usuário)
- `role` (papel)
- `permission` (permissão)
- `company` (empresa)
- `audit_log` (log de auditoria)

**Regras de negócio:**
- Multi-tenancy (RLS no Supabase)
- RBAC (Role-Based Access Control)
- Auditoria de alterações críticas

#### Módulo Relatórios (Reports)

**Responsabilidades:**
- Relatórios de vendas (diário, mensal, por produto)
- Relatórios de estoque (giro, valor, vencimento)
- Relatórios financeiros (DRE simplificado)
- Dashboard gerencial

**Entidades principais:**
- `report_config` (configuração de relatório)
- `report_snapshot` (snapshot de relatório)

**Regras de negócio:**
- Agregações performáticas (views materializadas)
- Exportação para PDF/Excel
- Agendamento de relatórios (futuro)

### 3.3 Schema de Banco de Dados (PostgreSQL)

```sql
-- Multi-tenancy
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users and Auth
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  company_id UUID REFERENCES companies(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'cashier', 'salesperson')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'UN',
  cost_price DECIMAL(10,2) NOT NULL,
  sell_price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, sku)
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  cpf_cnpj TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address JSONB,
  credit_limit DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  customer_id UUID REFERENCES customers(id),
  salesperson_id UUID REFERENCES users(id),
  sale_number INTEGER NOT NULL,
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'refunded')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) NOT NULL
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id),
  method TEXT NOT NULL CHECK (method IN ('cash', 'credit_card', 'debit_card', 'pix', 'boleto')),
  amount DECIMAL(10,2) NOT NULL,
  installments INTEGER DEFAULT 1,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stock Movements
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  product_id UUID REFERENCES products(id),
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID, -- sale_id, purchase_id, etc.
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash Register
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  initial_amount DECIMAL(10,2) NOT NULL,
  final_amount DECIMAL(10,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  user_id UUID REFERENCES users(id)
);

-- Financial
CREATE TABLE accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  customer_id UUID REFERENCES customers(id),
  sale_id UUID REFERENCES sales(id),
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  received_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'overdue', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_receivable ENABLE ROW LEVEL SECURITY;

-- Policies (exemplo)
CREATE POLICY "Users can view their company data"
ON products FOR SELECT
USING (company_id = auth.jwt() ->> 'company_id');

CREATE POLICY "Users can insert products for their company"
ON products FOR INSERT
WITH CHECK (company_id = auth.jwt() ->> 'company_id');

-- Indexes
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_products_sku ON products(company_id, sku);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_sales_company_date ON sales(company_id, sale_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_accounts_payable_due_date ON accounts_payable(due_date);
CREATE INDEX idx_accounts_receivable_due_date ON accounts_receivable(due_date);
```

### 3.4 Edge Functions (Supabase)

**Funções críticas:**

1. **`process-sale`** - Processa venda completa (valida estoque, cria registros, emite NFC-e)
2. **`calculate-taxes`** - Calcula impostos (ICMS, PIS, COFINS)
3. **`generate-nfce`** - Gera XML da NFC-e e assina digitalmente
4. **`update-stock`** - Atualiza estoque após venda/compra
5. **`send-email`** - Envia notificações por email
6. **`generate-report`** - Gera relatórios pesados em background

### 3.5 Componentes de UI Compartilhados

**Design System:**
- `Button` - Botões com variantes (primary, secondary, danger)
- `Input` - Campos de texto com validação
- `Select` - Dropdowns
- `Modal` - Modais e dialogs
- `Table` - Tabelas com sorting e paginação
- `Card` - Cards de conteúdo
- `Badge` - Badges de status
- `Alert` - Mensagens de alerta
- `Loading` - Spinners e skeletons
- `EmptyState` - Estados vazios

**Componentes de Negócio:**
- `ProductSelector` - Seletor de produtos com busca
- `CustomerSelector` - Seletor de clientes
- `PaymentForm` - Formulário de pagamento
- `StockBadge` - Badge de status de estoque
- `MoneyInput` - Input formatado para valores monetários
- `DateRangePicker` - Seletor de período

---

## 4. Plano Incremental de Construção

### Fase 1: Fundação (Sprint 1-2)

**Objetivo:** Setup inicial e autenticação

**Entregas:**
- [ ] Setup do monorepo (Turborepo ou npm workspaces)
- [ ] Configuração do Supabase (projeto, RLS, migrations)
- [ ] Autenticação com Supabase Auth
- [ ] Layout base (sidebar, header, main content)
- [ ] Design system básico (Button, Input, Card)
- [ ] Multi-tenancy funcionando (RLS)

**Critério de sucesso:** Usuário consegue fazer login e ver tela vazia com dados da sua empresa.

### Fase 2: Produtos e Estoque (Sprint 3-4)

**Objetivo:** Cadastro e controle de estoque

**Entregas:**
- [ ] CRUD de produtos
- [ ] CRUD de categorias
- [ ] Movimentações de estoque (entrada/saída manual)
- [ ] Ajuste de inventário
- [ ] Alertas de estoque mínimo
- [ ] Busca e filtros de produtos

**Critério de sucesso:** Usuário consegue cadastrar produtos e controlar estoque manualmente.

### Fase 3: PDV e Vendas (Sprint 5-7)

**Objetivo:** Ponto de venda funcional

**Entregas:**
- [ ] Interface de PDV (teclado/touch)
- [ ] Busca de produtos por nome/código de barras
- [ ] Carrinho de compras
- [ ] Múltiplas formas de pagamento
- [ ] Abertura/fechamento de caixa
- [ ] Emissão de NFC-e (integração com SEFAZ)
- [ ] Histórico de vendas
- [ ] Cancelamento de vendas

**Critério de sucesso:** Usuário consegue realizar uma venda completa com emissão de nota fiscal.

### Fase 4: Clientes e Financeiro (Sprint 8-9)

**Objetivo:** Gestão de clientes e financeiro básico

**Entregas:**
- [ ] CRUD de clientes
- [ ] Contas a pagar
- [ ] Contas a receber
- [ ] Fluxo de caixa
- [ ] Dashboard financeiro

**Critério de sucesso:** Usuário consegue gerenciar clientes e ter visão do fluxo de caixa.

### Fase 5: Relatórios e Dashboard (Sprint 10-11)

**Objetivo:** Insights gerenciais

**Entregas:**
- [ ] Dashboard principal (KPIs)
- [ ] Relatório de vendas (diário, mensal, por produto)
- [ ] Relatório de estoque (giro, valor)
- [ ] Relatório financeiro (DRE simplificado)
- [ ] Exportação para PDF/Excel

**Critério de sucesso:** Usuário consegue extrair relatórios gerenciais.

### Fase 6: Refinamento e Lançamento (Sprint 12-13)

**Objetivo:** Polimento e lançamento beta

**Entregas:**
- [ ] Testes E2E (Playwright)
- [ ] Documentação do usuário
- [ ] Onboarding de novos clientes
- [ ] Performance optimization
- [ ] Bug fixes e melhorias
- [ ] Lançamento beta privado

**Critério de sucesso:** 5 lojas físicas usando o Blum em produção.

---

## 5. Primeira Sprint de Implementação

### Sprint 1: Fundação (2 semanas)

**Objetivo:** Setup completo e autenticação funcionando

#### Semana 1: Setup e Autenticação

**Dia 1-2: Setup do Projeto**
- [ ] Inicializar monorepo com Turborepo
- [ ] Configurar apps/web (React + Vite + TypeScript)
- [ ] Configurar packages/database (migrations)
- [ ] Configurar packages/shared (validators, constants)
- [ ] Configurar packages/ui (design system)
- [ ] Setup ESLint, Prettier, Husky
- [ ] Criar README.md com instruções de setup

**Dia 3-4: Supabase e Auth**
- [ ] Criar projeto no Supabase
- [ ] Configurar variáveis de ambiente
- [ ] Criar migration inicial (schema completo)
- [ ] Configurar Supabase Auth (email/password)
- [ ] Criar tabela `companies` e `users`
- [ ] Implementar RLS policies básicas
- [ ] Testar multi-tenancy

**Dia 5: Layout Base**
- [ ] Criar layout principal (Sidebar + Header + Main)
- [ ] Implementar navegação básica
- [ ] Criar página de login
- [ ] Criar página de registro
- [ ] Implementar redirect após login
- [ ] Criar página de "primeiro acesso" (criar empresa)

#### Semana 2: Design System e CRUD Base

**Dia 6-7: Design System**
- [ ] Criar componente `Button` (variants: primary, secondary, danger, ghost)
- [ ] Criar componente `Input` (text, email, password, number)
- [ ] Criar componente `Select` (single, multi)
- [ ] Criar componente `Modal` (confirm, form)
- [ ] Criar componente `Card` (default, interactive)
- [ ] Criar componente `Badge` (status variants)
- [ ] Criar componente `Alert` (info, success, warning, error)
- [ ] Criar componente `Loading` (spinner, skeleton)

**Dia 8-9: CRUD de Empresas**
- [ ] Criar página de listagem de empresas (admin)
- [ ] Criar formulário de criação de empresa
- [ ] Implementar validação com Zod
- [ ] Implementar mutations com React Query
- [ ] Criar página de edição de empresa
- [ ] Implementar exclusão lógica (soft delete)

**Dia 10: CRUD de Usuários**
- [ ] Criar página de listagem de usuários
- [ ] Criar formulário de criação de usuário
- [ ] Implementar roles e permissões
- [ ] Implementar convite por email (futuro)
- [ ] Criar página de perfil do usuário
- [ ] Implementar alteração de senha

**Critério de Sucesso da Sprint 1:**
- Usuário consegue fazer login
- Usuário consegue criar uma empresa
- Usuário consegue ver e editar dados da empresa
- Multi-tenancy funcionando (RLS)
- Design system básico disponível

**Entregáveis:**
- Repositório Git com estrutura completa
- Supabase configurado com schema inicial
- Aplicação rodando localmente
- Documentação de setup (README.md)
- Demo para stakeholders

---

## 6. Riscos e Mitigações

### Risco 1: Complexidade da NFC-e

**Descrição:** Emissão de nota fiscal eletrônica envolve integração com SEFAZ, certificado digital, e regras fiscais complexas.

**Mitigação:**
- Usar serviço terceirizado (e-gestor, NFe.io, ou similar)
- Iniciar com NFC-e simplificada (modelo 65)
- Contratar contador especializado para validação
- Criar MVP sem NFC-e e adicionar posteriormente

### Risco 2: Performance do PDV

**Descrição:** PDV precisa ser rápido e responsivo, mesmo com muitos produtos.

**Mitigação:**
- Cache agressivo de produtos (React Query)
- Busca otimizada (índices no banco)
- Lazy loading de componentes
- Testes de performance desde o início

### Risco 3: Multi-tenancy e Segurança

**Descrição:** Vazamento de dados entre empresas (tenants).

**Mitigação:**
- RLS em todas as tabelas
- Testes automatizados de isolamento
- Auditoria de queries (logs)
- Code review rigoroso

### Risco 4: Regras Fiscais

**Descrição:** Regras de ICMS, PIS, COFINS variam por estado e tipo de produto.

**Mitigação:**
- Iniciar com regras simplificadas (SP)
- Documentar limitações claramente
- Planejar expansão gradual para outros estados
- Consultoria contábil especializada

---

## 7. Estimativa de Esforço

### Cenário A: Construir do Zero

**Estimativa:** 13 sprints (26 semanas / 6 meses)

**Vantagens:**
- Código limpo e otimizado para o Blum
- Sem dívida técnica herdada
- Arquitetura moderna desde o início

**Desvantagens:**
- Tempo maior de desenvolvimento
- Custo inicial mais alto

### Cenário B: Reutilização Seletiva do Jinlong (Hipotético)

**Estimativa:** 8-10 sprints (16-20 semanas / 4-5 meses)

**Economia estimada:** 20-30% do tempo total

**Vantagens:**
- Reutilização de regras de negócio validadas
- Componentes de UI prontos
- Migrations e schemas testados

**Desvantagens:**
- Risco de acoplamento com Jinlong
- Possível dívida técnica
- Necessidade de refatoração

**Recomendação:** Sem acesso ao Jinlong, seguir com Cenário A (construir do zero).

---

## 8. Próximos Passos

### Imediato (Antes da Sprint 1)

1. **Decidir sobre reutilização do Jinlong**
   - Solicitar acesso ao repositório
   - Ou confirmar que será construído do zero

2. **Validar requisitos com stakeholders**
   - Confirmar funcionalidades do MVP
   - Priorizar features críticas
   - Definir critérios de sucesso

3. **Setup de infraestrutura**
   - Criar projeto no Supabase
   - Configurar domínio e SSL
   - Setup de CI/CD (GitHub Actions)

4. **Contratar/definir equipe**
   - 1 frontend developer (React/TypeScript)
   - 1 backend developer (Supabase/PostgreSQL)
   - 1 designer (UI/UX) - parcial
   - 1 product manager - parcial

### Sprint 1 (2 semanas)

- Executar plano da Sprint 1 (Fundação)
- Review semanal com stakeholders
- Demo no final da sprint

### Sprint 2-13

- Seguir plano incremental
- Ajustar roadmap baseado em feedback
- Preparar para lançamento beta

---

## 9. Conclusão

Sem acesso ao repositório Jinlong, a recomendação é **construir o Blum ERP do zero**, seguindo uma arquitetura moderna e modular. O plano incremental de 13 sprints permite entregas frequentes e validação contínua com stakeholders.

A arquitetura proposta (monorepo + Supabase + React) oferece:
- Escalabilidade para crescimento futuro
- Multi-tenancy seguro com RLS
- Desenvolvimento rápido com ferramentas modernas
- Facilidade de manutenção e evolução

**Próxima ação:** Obter acesso ao Jinlong ou confirmar construção do zero, e iniciar Sprint 1.

---

**Autor:** Arquiteto de Software Sênior  
**Revisão:** Pendente  
**Aprovação:** Pendente
