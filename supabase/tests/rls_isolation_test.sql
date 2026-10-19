-- Venddi — RLS Isolation Tests
-- Sprint 01.1
-- 
-- These tests verify multi-tenant isolation
-- Run with: supabase db reset && psql -f supabase/tests/rls_isolation_test.sql

-- ============================================
-- SETUP: Create test data
-- ============================================

-- Create two test companies
INSERT INTO companies (id, name, cnpj, plan, status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Company A', '11.111.111/1111-11', 'starter', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Company B', '22.222.222/2222-22', 'starter', 'active');

-- Create users for each company
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'auth-user-a', 'user-a@test.com', 'User A', 'owner', true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'auth-user-b', 'user-b@test.com', 'User B', 'owner', true);

-- Create products for each company
INSERT INTO products (id, company_id, sku, name, cost_price, sell_price, stock_quantity, min_stock, is_active)
VALUES
  ('prod-aaaa-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'SKU-A1', 'Product A1', 10.00, 20.00, 100, 10, true),
  ('prod-aaaa-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'SKU-A2', 'Product A2', 15.00, 30.00, 50, 5, true),
  ('prod-bbbb-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'SKU-B1', 'Product B1', 12.00, 25.00, 75, 8, true);

-- ============================================
-- TEST 1: Company A cannot view Company B products
-- ============================================
-- Simulate User A session
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'auth-user-a';

-- This should return only Company A products (2 rows)
SELECT COUNT(*) as test1_count FROM products;
-- Expected: 2

-- Verify no Company B products visible
SELECT COUNT(*) as test1_cross_company FROM products WHERE company_id = '22222222-2222-2222-2222-222222222222';
-- Expected: 0

RESET ROLE;

-- ============================================
-- TEST 2: Company A cannot update Company B products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'auth-user-a';

-- Try to update Company B product (should fail silently - 0 rows affected)
UPDATE products 
SET name = 'HACKED' 
WHERE id = 'prod-bbbb-1111-1111-1111-111111111111';

-- Verify product was not changed
SELECT name FROM products WHERE id = 'prod-bbbb-1111-1111-1111-111111111111';
-- Expected: 'Product B1' (not 'HACKED')

RESET ROLE;

-- ============================================
-- TEST 3: Company A cannot delete Company B products
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'auth-user-a';

-- Try to delete Company B product (should fail silently)
DELETE FROM products WHERE id = 'prod-bbbb-1111-1111-1111-111111111111';

-- Verify product still exists
SELECT COUNT(*) as test3_exists FROM products WHERE id = 'prod-bbbb-1111-1111-1111-111111111111';
-- Expected: 1

RESET ROLE;

-- ============================================
-- TEST 4: Unauthenticated user cannot access data
-- ============================================
SET LOCAL ROLE anon;

-- Should return 0 rows
SELECT COUNT(*) as test4_count FROM products;
-- Expected: 0

SELECT COUNT(*) as test4_companies FROM companies;
-- Expected: 0

RESET ROLE;

-- ============================================
-- TEST 5: User cannot elevate their own role
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'auth-user-b';

-- User B is 'owner', try to update another user's role
-- First, create a cashier user
INSERT INTO users (id, company_id, auth_id, email, full_name, role, is_active)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'auth-user-c', 'user-c@test.com', 'User C', 'cashier', true);

-- Try to promote cashier to admin (should be blocked by policy)
UPDATE users SET role = 'admin' WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Verify role was not changed
SELECT role FROM users WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
-- Expected: 'cashier' (not 'admin')

RESET ROLE;

-- ============================================
-- TEST 6: User cannot change their company_id
-- ============================================
SET LOCAL ROLE authenticated;
SET request.jwt.claim.sub = 'auth-user-a';

-- Try to move User A to Company B (should be blocked)
UPDATE users SET company_id = '22222222-2222-2222-2222-222222222222' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Verify company_id was not changed
SELECT company_id FROM users WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Expected: '11111111-1111-1111-1111-111111111111' (not Company B)

RESET ROLE;

-- ============================================
-- TEST 7: Verify audit log captures sensitive operations
-- ============================================
-- This test would require application-level audit logging
-- Database-level triggers are not used for audit (application handles it)

-- ============================================
-- CLEANUP
-- ============================================
DELETE FROM products WHERE id IN (
  'prod-aaaa-1111-1111-1111-111111111111',
  'prod-aaaa-2222-2222-2222-222222222222',
  'prod-bbbb-1111-1111-1111-111111111111'
);

DELETE FROM users WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

DELETE FROM companies WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- ============================================
-- RESULTS
-- ============================================
-- All tests should pass if RLS policies are correctly configured
-- If any test fails, review the RLS policies in migration 005
