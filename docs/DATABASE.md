# BLUM ERP — Database Schema

## Tables Overview

### Foundation (Sprint 01)

| Table | Purpose | RLS |
|-------|---------|-----|
| `companies` | Tenant companies | ✅ |
| `users` | System users with roles | ✅ |
| `audit_logs` | Operation audit trail | ✅ |

### Products & Stock (Sprint 02-03)

| Table | Purpose | RLS |
|-------|---------|-----|
| `categories` | Product categories | ✅ |
| `products` | Product catalog | ✅ |
| `stock_movements` | Stock in/out/adjustments | ✅ |

### Sales & People (Sprint 02-04)

| Table | Purpose | RLS |
|-------|---------|-----|
| `customers` | Customer records | ✅ |
| `suppliers` | Supplier records | ✅ |
| `sales` | Sales transactions | ✅ |
| `sale_items` | Items in each sale | ✅ |
| `payments` | Payment records | ✅ |

### Cash & Financial (Sprint 05-06)

| Table | Purpose | RLS |
|-------|---------|-----|
| `cash_registers` | Cash register sessions | ✅ |
| `cash_movements` | Cash in/out movements | ✅ |
| `financial_accounts` | Payable/receivable accounts | ✅ |
| `financial_categories` | Financial categories | ✅ |

## Key Design Decisions

### Multi-Tenancy
- All tables have `company_id` foreign key
- RLS policies use `get_user_company_id()` function
- No shared data between companies

### Idempotency
- `sales.idempotency_key` prevents duplicate sales
- Financial operations check for existing keys

### Stock Tracking
- `products.stock_quantity` is the source of truth
- `stock_movements` records every change
- `balance_after` field for reconciliation

### Financial Integrity
- `financial_accounts.paid_amount` tracks partial payments
- `cash_registers` tracks opening/closing balances
- `cash_movements.balance_after` for audit trail

### Audit
- `audit_logs` captures entity_type, entity_id, old/new values
- Triggered by application layer, not database triggers
- Includes IP address and user agent

## Indexes

Key indexes for performance:
- `products(company_id, sku)` — Unique SKU per company
- `products(barcode)` — Barcode lookup
- `sales(company_id, sale_date)` — Date-range queries
- `financial_accounts(due_date)` — Overdue accounts
- `stock_movements(product_id, created_at)` — Stock history

## Migrations

All migrations are in `supabase/migrations/` and are versioned:
- `001_foundation.sql` — Companies, users, audit
- `002_products_stock.sql` — Products, categories, stock
- `003_sales_customers.sql` — Sales, customers, suppliers
- `004_cashier_financial.sql` — Cash register, financial
- `005_rls_policies.sql` — Row Level Security policies
