-- Venddi - Migration 004
-- Cash Register, Financial
-- Date: 2026-10-19
-- Sprint: 05-06

-- ============================================
-- CASH REGISTERS TABLE
-- ============================================
CREATE TABLE cash_registers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  -- Values
  initial_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  final_amount DECIMAL(10,2),
  total_sales DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_withdrawals DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_deposits DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  
  -- Notes
  opening_notes TEXT,
  closing_notes TEXT
);

CREATE INDEX idx_cash_registers_company ON cash_registers(company_id);
CREATE INDEX idx_cash_registers_user ON cash_registers(user_id);
CREATE INDEX idx_cash_registers_status ON cash_registers(status);
CREATE INDEX idx_cash_registers_opened ON cash_registers(opened_at);

-- ============================================
-- CASH MOVEMENTS TABLE
-- ============================================
CREATE TABLE cash_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Movement
  type VARCHAR(20) NOT NULL CHECK (type IN ('sale', 'withdrawal', 'deposit', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,
  
  -- Balance after movement
  balance_after DECIMAL(10,2) NOT NULL,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_company ON cash_movements(company_id);
CREATE INDEX idx_cash_movements_type ON cash_movements(type);
CREATE INDEX idx_cash_movements_created ON cash_movements(created_at);

-- ============================================
-- FINANCIAL ACCOUNTS TABLE
-- ============================================
CREATE TABLE financial_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Account
  type VARCHAR(20) NOT NULL CHECK (type IN ('payable', 'receivable')),
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  
  -- Values
  amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Dates
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,
  
  -- Counterparty
  person_id UUID, -- customer_id or supplier_id
  person_type VARCHAR(20), -- 'customer' or 'supplier'
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_financial_accounts_company ON financial_accounts(company_id);
CREATE INDEX idx_financial_accounts_type ON financial_accounts(type);
CREATE INDEX idx_financial_accounts_status ON financial_accounts(status);
CREATE INDEX idx_financial_accounts_due_date ON financial_accounts(due_date);
CREATE INDEX idx_financial_accounts_person ON financial_accounts(person_type, person_id);

-- ============================================
-- FINANCIAL CATEGORIES TABLE
-- ============================================
CREATE TABLE financial_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  color VARCHAR(7), -- Hex color
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, name, type)
);

CREATE INDEX idx_financial_categories_company ON financial_categories(company_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_financial_accounts_updated_at
  BEFORE UPDATE ON financial_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Calculate cash register balance
-- ============================================
CREATE OR REPLACE FUNCTION calculate_cash_balance(p_cash_register_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_initial DECIMAL(10,2);
  v_deposits DECIMAL(10,2);
  v_withdrawals DECIMAL(10,2);
  v_sales DECIMAL(10,2);
BEGIN
  SELECT initial_amount INTO v_initial
  FROM cash_registers
  WHERE id = p_cash_register_id;
  
  SELECT COALESCE(SUM(amount), 0) INTO v_deposits
  FROM cash_movements
  WHERE cash_register_id = p_cash_register_id AND type = 'deposit';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_withdrawals
  FROM cash_movements
  WHERE cash_register_id = p_cash_register_id AND type = 'withdrawal';
  
  SELECT COALESCE(SUM(amount), 0) INTO v_sales
  FROM cash_movements
  WHERE cash_register_id = p_cash_register_id AND type = 'sale';
  
  RETURN v_initial + v_deposits + v_sales - v_withdrawals;
END;
$$ LANGUAGE plpgsql;
