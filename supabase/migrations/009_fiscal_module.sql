-- Venddi - Migration 009
-- Fiscal Module - Focus NFe Integration
-- Date: 2026-10-19
-- Sprint: 05

-- ============================================
-- FISCAL CONFIGURATIONS TABLE
-- ============================================
CREATE TABLE fiscal_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Provider configuration
  provider VARCHAR(50) NOT NULL DEFAULT 'focus_nfe' CHECK (provider IN ('focus_nfe')),
  environment VARCHAR(20) NOT NULL CHECK (environment IN ('homologacao', 'producao')),
  api_token TEXT NOT NULL, -- Encrypted at application level
  
  -- Company fiscal data
  cnpj VARCHAR(18) NOT NULL,
  state_registration VARCHAR(20),
  municipal_registration VARCHAR(20),
  company_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  
  -- Address
  address JSONB NOT NULL DEFAULT '{}',
  
  -- Tax configuration
  tax_regime VARCHAR(50) NOT NULL CHECK (tax_regime IN ('simples_nacional', 'lucro_presumido', 'lucro_real')),
  csc TEXT, -- Código de Segurança do Contribuinte (encrypted)
  csc_id VARCHAR(10),
  
  -- NFC-e configuration
  nfce_series VARCHAR(10) NOT NULL DEFAULT '1',
  nfce_number_start INTEGER NOT NULL DEFAULT 1,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_configured BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(company_id, provider)
);

CREATE INDEX idx_fiscal_configurations_company ON fiscal_configurations(company_id);
CREATE INDEX idx_fiscal_configurations_cnpj ON fiscal_configurations(cnpj);
CREATE INDEX idx_fiscal_configurations_active ON fiscal_configurations(is_active);

-- ============================================
-- PRODUCT FISCAL DATA TABLE
-- ============================================
CREATE TABLE product_fiscal_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- NCM (Nomenclatura Comum do Mercosul)
  ncm VARCHAR(8) NOT NULL,
  
  -- CFOP (Código Fiscal de Operações e Prestações)
  cfop VARCHAR(4) NOT NULL,
  
  -- ICMS
  icms_origin VARCHAR(1) NOT NULL DEFAULT '0',
  icms_cst VARCHAR(3) NOT NULL,
  icms_base_calculation DECIMAL(10,2) NOT NULL DEFAULT 0,
  icms_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  icms_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- PIS
  pis_cst VARCHAR(2) NOT NULL DEFAULT '99',
  pis_base_calculation DECIMAL(10,2) NOT NULL DEFAULT 0,
  pis_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  pis_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- COFINS
  cofins_cst VARCHAR(2) NOT NULL DEFAULT '99',
  cofins_base_calculation DECIMAL(10,2) NOT NULL DEFAULT 0,
  cofins_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  cofins_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Additional info
  unit VARCHAR(10) NOT NULL DEFAULT 'UN',
  barcode VARCHAR(20),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(product_id)
);

CREATE INDEX idx_product_fiscal_data_product ON product_fiscal_data(product_id);
CREATE INDEX idx_product_fiscal_data_company ON product_fiscal_data(company_id);
CREATE INDEX idx_product_fiscal_data_ncm ON product_fiscal_data(ncm);
CREATE INDEX idx_product_fiscal_data_cfop ON product_fiscal_data(cfop);

-- ============================================
-- FISCAL DOCUMENTS TABLE
-- ============================================
CREATE TABLE fiscal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  
  -- Document identification
  document_type VARCHAR(10) NOT NULL DEFAULT 'nfce' CHECK (document_type IN ('nfce')),
  reference UUID NOT NULL UNIQUE, -- Unique reference (idempotency key)
  
  -- Document numbers
  number VARCHAR(20),
  series VARCHAR(10),
  access_key VARCHAR(50), -- Chave de acesso
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'pending', 'processing', 'authorized', 'rejected', 
    'cancelled', 'denied', 'contingency'
  )),
  sefaz_status VARCHAR(10),
  sefaz_message TEXT,
  
  -- Protocol
  protocol_number VARCHAR(50),
  authorization_date TIMESTAMPTZ,
  
  -- URLs (Focus NFe paths)
  xml_path TEXT,
  danfe_path TEXT,
  qrcode_url TEXT,
  consultation_url TEXT,
  
  -- Cancellation
  cancellation_date TIMESTAMPTZ,
  cancellation_justification TEXT,
  cancellation_protocol VARCHAR(50),
  
  -- Contingency
  is_contingency BOOLEAN NOT NULL DEFAULT FALSE,
  contingency_effective_date TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  error_details JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fiscal_documents_company ON fiscal_documents(company_id);
CREATE INDEX idx_fiscal_documents_sale ON fiscal_documents(sale_id);
CREATE INDEX idx_fiscal_documents_reference ON fiscal_documents(reference);
CREATE INDEX idx_fiscal_documents_status ON fiscal_documents(status);
CREATE INDEX idx_fiscal_documents_access_key ON fiscal_documents(access_key);
CREATE INDEX idx_fiscal_documents_created ON fiscal_documents(created_at);

-- ============================================
-- FISCAL EVENTS TABLE (Audit Log)
-- ============================================
CREATE TABLE fiscal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_document_id UUID NOT NULL REFERENCES fiscal_documents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'emission_started', 'emission_completed', 'emission_failed',
    'cancellation_started', 'cancellation_completed', 'cancellation_failed',
    'contingency_started', 'contingency_effective',
    'webhook_received'
  )),
  status VARCHAR(20) NOT NULL,
  
  -- Event data
  sefaz_status VARCHAR(10),
  sefaz_message TEXT,
  protocol_number VARCHAR(50),
  
  -- Error details
  error_code VARCHAR(50),
  error_message TEXT,
  error_details JSONB,
  
  -- Webhook data
  webhook_payload JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fiscal_events_document ON fiscal_events(fiscal_document_id);
CREATE INDEX idx_fiscal_events_company ON fiscal_events(company_id);
CREATE INDEX idx_fiscal_events_type ON fiscal_events(event_type);
CREATE INDEX idx_fiscal_events_created ON fiscal_events(created_at);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_fiscal_configurations_updated_at
  BEFORE UPDATE ON fiscal_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_fiscal_data_updated_at
  BEFORE UPDATE ON product_fiscal_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fiscal_documents_updated_at
  BEFORE UPDATE ON fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
