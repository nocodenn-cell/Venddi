# Venddi — Architecture

## Overview

Venddi is a SaaS business management system for small Brazilian retail stores, built from scratch by Mature Code.

**Tagline:** *Gestão simples para vender mais.*

## Tech Stack

- **Frontend:** React 18 + TypeScript (strict mode) + Vite
- **Styling:** Tailwind CSS + custom design system
- **State:** Zustand (client state) + React Query (server state)
- **Forms:** React Hook Form + Zod validation
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **Routing:** React Router v6
- **Testing:** Vitest (unit). E2E (Playwright) ainda não configurado.

## Architecture Principles

1. **Multi-tenant isolation** — Every query filtered by `company_id` via RLS
2. **Atomic transactions** — Sales, stock, and cash operations are transactional
3. **Backend validation** — All business rules enforced server-side
4. **Role-based access** — Permissions checked at UI and database level
5. **Audit trail** — All sensitive operations logged
6. **Idempotency** — Financial operations use idempotency keys
7. **Error handling** — Explicit error types with user-friendly messages

## Directory Structure

```
src/
├── components/
│   ├── ui/           # Design system (Button, Input, Card, etc.)
│   └── layout/       # Admin layout, Sidebar, Header
├── lib/
│   ├── schemas.ts    # Zod schemas + types + permissions
│   ├── utils.ts      # Utility functions (cn, formatCurrency, etc.)
│   ├── store/        # Zustand stores (auth, etc.)
│   └── router.tsx    # React Router configuration
├── pages/            # Route pages
├── pages/            # (já existe) — módulos de negócio ainda não extraídos
└── lib/api/          # Camada de acesso ao Supabase por domínio

supabase/
└── migrations/       # Versioned SQL migrations
```

## Authentication Flow

1. User submits credentials → Supabase Auth
2. Auth returns JWT with `sub` (user ID)
3. Backend looks up `users` table by `auth_id`
4. JWT includes `company_id` for RLS filtering
5. Frontend stores session in Zustand (persisted)

## Multi-Tenancy

- Every table with business data has `company_id` column
- RLS policies ensure users only access their company's data
- `get_user_company_id()` function extracts company from JWT
- No cross-company data leakage possible

## Security

- RLS on all business tables
- Password hashing by Supabase Auth (bcrypt)
- CORS restricted to app domain
- Rate limiting on auth endpoints
- Audit log for sensitive operations
- No PII in client-side state
