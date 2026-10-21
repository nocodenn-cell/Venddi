-- Venddi - RLS Integration Tests
-- Sprint 04 - Audit and Homologation
-- Date: 2026-10-19

-- ============================================
-- SETUP: Create test companies and users
-- ============================================

-- Create Company A
INSERT INTO companies (id, name, cnpj, plan, status)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Company A Test',
  '11.111.111/0001-11',
  'starter',
  'active'
);

-- Create Company B
INSERT INTO companies (id, name, cnpj, plan, status)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Company B Test',
  '22.222.222/0001-22',
  'starter',
  'active'
);

-- Create users for Company A
INSERT INTO company_subscriptions (company_id, plan, status, trial_days) VALUES ('11111111-1111-1111-1111-111111111111','starter','active',15), ('22222222-2222-2222-2222-222222222222','starter','active',15);
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'owner@companya.com', 'Owner A', 'owner', true),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'a2000000-0000-4000-8000-000000000002', 'cashier@companya.com', 'Cashier A', 'cashier', true);

-- Create users for Company B
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active)
VALUES 
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'owner@companyb.com', 'Owner B', 'owner', true),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'b2000000-0000-4000-8000-000000000002', 'cashier@companyb.com', 'Cashier B', 'cashier', true);

-- Create products for Company A
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active)
VALUES 
  ('d1000000-0000-4000-8000-000000000011', '11111111-1111-1111-1111-111111111111', 'SKU-A1', 'Product A1', 10.00, 20.00, 100, 10, true),
  ('d1000000-0000-4000-8000-000000000022', '11111111-1111-1111-1111-111111111111', 'SKU-A2', 'Product A2', 15.00, 30.00, 50, 5, true);

-- Create products for Company B
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active)
VALUES 
  ('d2000000-0000-4000-8000-000000000011', '22222222-2222-2222-2222-222222222222', 'SKU-B1', 'Product B1', 12.00, 25.00, 75, 8, true);

-- ============================================
-- TEST 1: Company A can only view its own products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

SELECT COUNT(*) as test1_count FROM products;
-- Expected: 2 (only Company A products)

SELECT COUNT(*) as test1_cross_company FROM products WHERE company_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0 (cannot see Company B products)

RESET ROLE;

-- ============================================
-- TEST 2: Company B can only view its own products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'b1000000-0000-4000-8000-000000000001';

SELECT COUNT(*) as test2_count FROM products;
-- Expected: 1 (only Company B products)

SELECT COUNT(*) as test2_cross_company FROM products WHERE company_id = '11111111-1111-1111-1111-111111111111';
-- Expected: 0 (cannot see Company A products)

RESET ROLE;

-- ============================================
-- TEST 3: Company A cannot insert products for Company B
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

INSERT INTO products (company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock)
VALUES ('22222222-2222-2222-2222-222222222222', 'SKU-FAKE', 'Fake Product', 5.00, 10.00, 10, 2);
-- Expected: ERROR (RLS violation)

RESET ROLE;

-- ============================================
-- TEST 4: Company A cannot update Company B products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

UPDATE products 
SET name = 'HACKED' 
WHERE id = 'd2000000-0000-4000-8000-000000000011';
-- Expected: 0 rows affected

SELECT name FROM products WHERE id = 'd2000000-0000-4000-8000-000000000011';
-- Expected: 'Product B1' (not changed)

RESET ROLE;

-- ============================================
-- TEST 5: Company A cannot delete Company B products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

DELETE FROM products WHERE id = 'd2000000-0000-4000-8000-000000000011';
-- Expected: 0 rows affected

SELECT COUNT(*) FROM products WHERE id = 'd2000000-0000-4000-8000-000000000011';
-- Expected: 1 (still exists)

RESET ROLE;

-- ============================================
-- TEST 6: Cashier cannot perform admin actions
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a2000000-0000-4000-8000-000000000002';

-- Cashier should not be able to insert users
INSERT INTO users (company_id, auth_id, email, full_name, role)
VALUES ('11111111-1111-1111-1111-111111111111', 'f0000000-0000-4000-8000-00000000000f', 'fake@companya.com', 'Fake User', 'cashier');
-- Expected: ERROR (RLS violation - only owner/admin can insert)

RESET ROLE;

-- ============================================
-- TEST 7: User cannot elevate their own role
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a2000000-0000-4000-8000-000000000002';

UPDATE users 
SET role = 'owner' 
WHERE id = 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 0 rows affected (RLS prevents self-elevation)

SELECT role FROM users WHERE id = 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 'cashier' (not changed)

RESET ROLE;

-- ============================================
-- TEST 8: User cannot change their company_id
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a2000000-0000-4000-8000-000000000002';

UPDATE users 
SET company_id = '22222222-2222-2222-2222-222222222222' 
WHERE id = 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: 0 rows affected (RLS prevents company change)

SELECT company_id FROM users WHERE id = 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: '11111111-1111-1111-1111-111111111111' (not changed)

RESET ROLE;

-- ============================================
-- TEST 9: RPC functions validate company ownership
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'a1000000-0000-4000-8000-000000000001';

-- Try to create sale with operator from different company
SELECT create_atomic_sale(
  '11111111-1111-1111-1111-111111111111', -- Company A
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Operator from Company B (should fail)
  NULL,                                   -- p_cash_register_id
  '[]'::jsonb,                            -- p_items
  '[]'::jsonb,                            -- p_payments
  NULL                                    -- p_customer_id
);
-- Expected: Error "Operator does not belong to company"

RESET ROLE;

-- ============================================
-- TEST 10: Unauthenticated user cannot access data
-- ============================================
SET LOCAL ROLE anon;

SELECT COUNT(*) FROM products;
-- Expected: 0

SELECT COUNT(*) FROM sales;
-- Expected: 0

SELECT COUNT(*) FROM companies;
-- Expected: 0

RESET ROLE;

-- ============================================
-- CLEANUP
-- ============================================
DELETE FROM products WHERE id IN (
  'd1000000-0000-4000-8000-000000000011',
  'd1000000-0000-4000-8000-000000000022',
  'd2000000-0000-4000-8000-000000000011'
);

DELETE FROM users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

DELETE FROM companies WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- ============================================
-- RESULTS SUMMARY
-- ============================================
-- All tests should pass if RLS policies are correctly configured
-- If any test fails, review the RLS policies in migrations 005 and 008
