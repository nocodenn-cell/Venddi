# Venddi

**Gestão simples para vender mais.**

Sistema de gestão empresarial (ERP) para pequenas lojas físicas brasileiras.

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

# Executar testes
npm run test
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
├── BRAND_GUIDELINES.md # Diretrizes visuais
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

## 🎨 Identidade Visual

A identidade visual da Venddi está documentada em:
- `docs/BRAND.md` — Manual de marca completo
- `docs/BRAND_GUIDELINES.md` — Diretrizes técnicas
- `src/assets/branding/` — Logos SVG

**Paleta principal:**
- Verde Venddi: `#0EA572`
- Verde escuro: `#087A54`
- Verde claro: `#D1FAE5`

## 📋 Sprints

- [x] Sprint 01 — Foundation ✅
- [x] Sprint 01.1 — Integração Real ✅
- [x] Sprint 01.2 — Desbloqueio ✅
- [x] Rebranding — Blum → Venddi ✅
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
