-- Venddi - Migration 011
-- Trial & Subscription System
-- Date: 2026-10-19
-- Sprint: MVP Commercial

-- ============================================
-- COMPANY SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE company_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Plan
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('starter', 'professional', 'business')),
  
  -- Trial
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ NOT NULL,
  trial_days INTEGER NOT NULL DEFAULT 30,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'suspended', 'canceled')),
  
  -- Conversion
  converted_to_paid_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Payment (future - Stripe integration)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id)
);

CREATE INDEX idx_company_subscriptions_company ON company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_status ON company_subscriptions(status);
CREATE INDEX idx_company_subscriptions_trial_end ON company_subscriptions(trial_end_date);

-- ============================================
-- TRIAL NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE trial_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Notification
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
    'trial_started',
    'trial_ending_soon',
    'trial_expired',
    'trial_converted'
  )),
  
  -- Delivery
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  
  -- Content
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trial_notifications_company ON trial_notifications(company_id);
CREATE INDEX idx_trial_notifications_type ON trial_notifications(notification_type);
CREATE INDEX idx_trial_notifications_sent ON trial_notifications(sent_at);

-- ============================================
-- TRIGGER: Auto-calculate trial_end_date
-- ============================================
CREATE OR REPLACE FUNCTION set_trial_end_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.trial_end_date IS NULL THEN
    NEW.trial_end_date := NEW.trial_started_at + (NEW.trial_days || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_trial_end_date
  BEFORE INSERT ON company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_trial_end_date();

-- ============================================
-- TRIGGER: Update updated_at
-- ============================================
CREATE TRIGGER update_company_subscriptions_updated_at
  BEFORE UPDATE ON company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Check if trial is active
-- ============================================
CREATE OR REPLACE FUNCTION is_trial_active(p_company_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_trial_end_date TIMESTAMPTZ;
  v_status VARCHAR(20);
BEGIN
  SELECT trial_end_date, status
  INTO v_trial_end_date, v_status
  FROM company_subscriptions
  WHERE company_id = p_company_id;
  
  IF v_trial_end_date IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_status = 'trial' AND NOW() < v_trial_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get remaining trial days
-- ============================================
CREATE OR REPLACE FUNCTION get_remaining_trial_days(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_trial_end_date TIMESTAMPTZ;
  v_remaining_days INTEGER;
BEGIN
  SELECT trial_end_date
  INTO v_trial_end_date
  FROM company_subscriptions
  WHERE company_id = p_company_id;
  
  IF v_trial_end_date IS NULL THEN
    RETURN 0;
  END IF;
  
  v_remaining_days := CEIL(EXTRACT(EPOCH FROM (v_trial_end_date - NOW())) / 86400);
  
  RETURN GREATEST(0, v_remaining_days);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Update subscription status based on dates
-- ============================================
CREATE OR REPLACE FUNCTION update_subscription_statuses()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update expired trials
  UPDATE company_subscriptions
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'trial'
    AND trial_end_date < NOW()
    AND converted_to_paid_at IS NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their company's subscription
CREATE POLICY "Users can view their company subscription"
ON company_subscriptions FOR SELECT
USING (company_id = get_user_company_id());

-- Only owners can insert subscriptions
CREATE POLICY "Owners can insert subscriptions"
ON company_subscriptions FOR INSERT
WITH CHECK (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = company_subscriptions.company_id
    AND users.auth_id = auth.uid()
    AND users.role = 'owner'
  )
);

-- Only owners can update subscriptions
CREATE POLICY "Owners can update subscriptions"
ON company_subscriptions FOR UPDATE
USING (
  company_id = get_user_company_id()
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.company_id = company_subscriptions.company_id
    AND users.auth_id = auth.uid()
    AND users.role = 'owner'
  )
);

-- Users can view their company's trial notifications
CREATE POLICY "Users can view their company trial notifications"
ON trial_notifications FOR SELECT
USING (company_id = get_user_company_id());

-- System can insert trial notifications (via backend)
CREATE POLICY "System can insert trial notifications"
ON trial_notifications FOR INSERT
WITH CHECK (company_id = get_user_company_id());
