# Venddi — Security

## Authentication

- **Provider:** Supabase Auth
- **Method:** Email/password (future: magic link, OAuth)
- **Password policy:** Min 6 chars, bcrypt hashed
- **Session:** JWT with 1h expiry, refresh tokens
- **MFA:** Planned for future sprints

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|------------|
| `owner` | Full access to everything |
| `admin` | All except company settings |
| `manager` | Products, stock, sales, cashier, financial, reports |
| `cashier` | Products (read), customers, sales, cashier |
| `salesperson` | Products (read), customers, sales |

### Permission Checks

1. **Frontend:** `checkPermission()` in auth store hides UI elements
2. **Backend:** Supabase RLS policies enforce data access
3. **Edge Functions:** Additional role checks for sensitive operations

## Data Protection

### Row Level Security (RLS)

Every business table has RLS enabled:
```sql
CREATE POLICY "Users can view company data"
ON products FOR SELECT
USING (company_id = get_user_company_id());
```

### Encryption

- **At rest:** Supabase encrypts all data at rest (AES-256)
- **In transit:** All connections use TLS 1.3
- **Passwords:** bcrypt with cost factor 12

### Sensitive Data

- No credit card data stored (payment processor handles)
- CPF/CNPJ stored but masked in UI
- PII not logged in audit trail

## Audit Trail

All sensitive operations logged:
- User login/logout
- Product CRUD
- Sales creation/cancellation
- Stock adjustments
- Cash register open/close
- User role changes
- Company settings changes

Log format:
```json
{
  "action": "sale.create",
  "entity_type": "sale",
  "entity_id": "uuid",
  "old_values": null,
  "new_values": { "total": 150.00 },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0..."
}
```

## Financial Security

### Idempotency

Sales use `idempotency_key` (UUID) to prevent duplicates:
```typescript
const sale = await createSale({
  idempotencyKey: crypto.randomUUID(),
  items: [...],
  payments: [...]
})
```

### Atomic Transactions

Sale creation is atomic:
1. Validate stock availability
2. Create sale record
3. Create sale items
4. Create payment records
5. Update stock quantities
6. Create stock movements
7. Create cash movement

If any step fails, entire transaction rolls back.

### Cash Register Security

- Only one open register per user at a time
- Opening requires initial amount confirmation
- Closing requires balance reconciliation
- All movements logged with `balance_after`

## Network Security

- CORS restricted to `https://blum.maturecode.com`
- Rate limiting: 100 req/min per IP
- DDoS protection via Supabase infrastructure
- No public API endpoints (all authenticated)

## Compliance

- **LGPD:** Brazilian data protection law compliance
  - Data minimization
  - Right to access/delete data
  - Consent management (future)
- **PCI DSS:** Not applicable (no card data stored)

## Incident Response

1. **Detection:** Supabase logs + application monitoring
2. **Containment:** Revoke compromised tokens
3. **Investigation:** Audit logs + database backups
4. **Recovery:** Restore from backup if needed
5. **Notification:** Inform affected users within 72h

## Backup & Recovery

- **Automated backups:** Daily by Supabase
- **Retention:** 30 days
- **Point-in-time recovery:** Available
- **Test restore:** Quarterly drill

## Security Checklist

- [x] RLS on all business tables
- [x] Password hashing (bcrypt)
- [x] HTTPS only
- [x] CORS restricted
- [x] Rate limiting
- [x] Audit logging
- [x] Idempotency keys
- [x] Atomic transactions
- [x] Role-based access control
- [x] No PII in logs
- [ ] MFA (planned Sprint 09)
- [ ] API key rotation (planned Sprint 08)
- [ ] Penetration testing (planned Sprint 09)
