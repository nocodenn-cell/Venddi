# Venddi

**Seu caixa simples. Sua loja sob controle.**

Sistema de PDV (Ponto de Venda) para pequenas lojas físicas brasileiras.

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Verificar tipos
npm run typecheck
```

## 🔐 Demo

Acesse `/login` e use:
- **Email:** admin@venddi.com
- **Senha:** admin123

## 📁 Estrutura

```
src/
├── assets/branding/  # Logos e identidade visual
├── components/
│   ├── ui/           # Design system
│   └── layout/       # Layout administrativo
├── lib/
│   ├── schemas.ts    # Schemas Zod + tipos
│   ├── utils.ts      # Utilitários
│   ├── store/        # Zustand stores
│   └── router.tsx    # Rotas
├── pages/            # Páginas
└── modules/          # Módulos de negócio (futuro)

supabase/
└── migrations/       # Migrations SQL versionadas

docs/
├── BRAND.md          # Manual de marca
├── ARCHITECTURE.md   # Arquitetura
├── DATABASE.md       # Schema do banco
├── SECURITY.md       # Segurança
└── PROGRESS.md       # Progresso
```

## 🎯 O que é a Venddi?

A Venddi é um **SaaS de PDV** focado em pequenas lojas físicas brasileiras.

**Não é:**
- ❌ ERP complexo
- ❌ Sistema com dezenas de módulos
- ❌ Plataforma para grandes empresas

**É:**
- ✅ PDV simples e rápido
- ✅ Controle básico de estoque
- ✅ Relatórios de vendas
- ✅ Trial gratuito de 15 dias
- ✅ Modelo de assinatura mensal

## 🏗️ Stack

- React 18 + TypeScript (strict)
- Vite
- Tailwind CSS
- Zustand (state)
- React Hook Form + Zod
- React Router v6
- Supabase (PostgreSQL + Auth + RLS)

## 🎨 Identidade Visual

A identidade visual da Venddi está documentada em:
- `docs/BRAND.md` — Manual de marca completo
- `src/assets/branding/` — Logos SVG

**Paleta principal:**
- Verde Venddi: `#0EA572`
- Verde escuro: `#087A54`
- Verde claro: `#D1FAE5`

## 📋 Fases de Desenvolvimento

### Fase 1 — Reposicionamento ✅
- Landing page redesenhada
- Página de preços
- Fluxo de cadastro
- PDV funcional (interface)
- Navegação reestruturada

### Fase 2 — Fundação SaaS (Próxima)
- Configurar Supabase
- Autenticação real
- Trial de 15 dias
- Criação de empresa
- Migrations aplicadas

### Fase 3 — PDV Completo
- Produtos e estoque reais
- Carrinho persistente
- Pagamentos integrados
- Vendas atômicas
- Caixa e comprovante

### Fase 4 — Administração
- Gestão de produtos
- Estoque
- Funcionários
- Histórico de vendas
- Relatórios básicos

### Fase 5 — BI e Comercial
- Dashboards gerenciais
- Indicadores confiáveis
- Onboarding
- Planos
- Homologação com loja piloto

## 📄 Licença

Proprietário — Mature Code
