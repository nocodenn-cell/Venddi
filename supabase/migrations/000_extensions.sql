-- Venddi - Migration 000
-- Enable required extensions
-- Date: 2026-10-19
-- Sprint: Foundation Fix

-- ============================================
-- EXTENSIONS
-- ============================================
-- Note: uuid-ossp is legacy. Modern PostgreSQL uses gen_random_uuid() natively.
-- We enable both for compatibility, but new code should use gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Verify extensions are available
DO $$
BEGIN
  -- Test uuid_generate_v4
  PERFORM uuid_generate_v4();
  
  -- Test gen_random_uuid
  PERFORM gen_random_uuid();
  
  RAISE NOTICE 'Both UUID functions are available';
END $$;
