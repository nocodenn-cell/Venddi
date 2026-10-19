# BLUM ERP

Sistema de gestão empresarial SaaS para pequenas lojas físicas brasileiras.

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
- **Email:** admin@blum.com
- **Senha:** qualquer

## 📁 Estrutura

```
src/
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
├── ARCHITECTURE.md   # Arquitetura
├── DATABASE.md       # Schema do banco
├── SECURITY.md       # Segurança
├── ROADMAP.md        # Roadmap
├── BACKLOG.md        # Backlog
└── PROGRESS.md       # Progresso
```

## 🏗️ Stack

- React 18 + TypeScript (strict)
- Vite
- Tailwind CSS
- Zustand (state)
- React Hook Form + Zod
- React Router v6
- Supabase (PostgreSQL + Auth + RLS)

## 📋 Sprints

- [x] Sprint 01 — Foundation ✅
- [ ] Sprint 02 — Products & Cadastros
- [ ] Sprint 03 — Stock
- [ ] Sprint 04 — PDV
- [ ] Sprint 05 — Cashier
- [ ] Sprint 06 — Financial
- [ ] Sprint 07 — Reports
- [ ] Sprint 08 — SaaS Commercial
- [ ] Sprint 09 — Quality & Homologation

## 📄 Licença

Proprietário — Mature Code
