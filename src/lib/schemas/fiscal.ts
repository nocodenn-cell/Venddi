import { z } from 'zod'

// ============================================
// Fiscal Configuration Schemas
// ============================================

export const fiscalEnvironmentSchema = z.enum(['homologacao', 'producao'])
export type FiscalEnvironment = z.infer<typeof fiscalEnvironmentSchema>

export const taxRegimeSchema = z.enum([
  'simples_nacional',
  'lucro_presumido',
  'lucro_real'
])
export type TaxRegime = z.infer<typeof taxRegimeSchema>

export const fiscalProviderSchema = z.enum(['focus_nfe'])
export type FiscalProvider = z.infer<typeof fiscalProviderSchema>

export const fiscalConfigurationSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  
  // Provider configuration
  provider: fiscalProviderSchema,
  environment: fiscalEnvironmentSchema,
  apiToken: z.string().min(1), // Encrypted in database
  
  // Company fiscal data
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  companyName: z.string(),
  tradeName: z.string().optional(),
  
  // Address
  address: z.object({
    street: z.string(),
    number: z.string(),
    complement: z.string().optional(),
    neighborhood: z.string(),
    city: z.string(),
    state: z.string().length(2),
    zipCode: z.string(),
    ibgeCode: z.string(),
  }),
  
  // Tax configuration
  taxRegime: taxRegimeSchema,
  csc: z.string().optional(), // Código de Segurança do Contribuinte (NFC-e)
  cscId: z.string().optional(),
  
  // NFC-e configuration
  nfceSeries: z.string().default('1'),
  nfceNumberStart: z.number().int().positive().default(1),
  
  // Status
  isActive: z.boolean().default(true),
  isConfigured: z.boolean().default(false),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type FiscalConfiguration = z.infer<typeof fiscalConfigurationSchema>

// ============================================
// Product Fiscal Data Schemas
// ============================================

export const productFiscalDataSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  companyId: z.string().uuid(),
  
  // NCM (Nomenclatura Comum do Mercosul)
  ncm: z.string().regex(/^\d{8}$/, 'NCM deve ter 8 dígitos'),
  
  // CFOP (Código Fiscal de Operações e Prestações)
  cfop: z.string().regex(/^\d{4}$/, 'CFOP deve ter 4 dígitos'),
  
  // ICMS
  icmsOrigin: z.string().regex(/^[0-8]$/), // 0-8
  icmsCst: z.string().regex(/^\d{2,3}$/), // CST or CSOSN
  icmsBaseCalculation: z.number().min(0).default(0),
  icmsRate: z.number().min(0).max(100).default(0),
  icmsValue: z.number().min(0).default(0),
  
  // PIS
  pisCst: z.string().regex(/^\d{2}$/),
  pisBaseCalculation: z.number().min(0).default(0),
  pisRate: z.number().min(0).max(100).default(0),
  pisValue: z.number().min(0).default(0),
  
  // COFINS
  cofinsCst: z.string().regex(/^\d{2}$/),
  cofinsBaseCalculation: z.number().min(0).default(0),
  cofinsRate: z.number().min(0).max(100).default(0),
  cofinsValue: z.number().min(0).default(0),
  
  // Additional info
  unit: z.string().default('UN'),
  barcode: z.string().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ProductFiscalData = z.infer<typeof productFiscalDataSchema>

// ============================================
// Fiscal Document Schemas
// ============================================

export const fiscalDocumentStatusSchema = z.enum([
  'pending',
  'processing',
  'authorized',
  'rejected',
  'cancelled',
  'denied',
  'contingency'
])
export type FiscalDocumentStatus = z.infer<typeof fiscalDocumentStatusSchema>

export const fiscalDocumentSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  saleId: z.string().uuid(),
  
  // Document identification
  documentType: z.literal('nfce'),
  reference: z.string().uuid(), // Unique reference (idempotency key)
  
  // Document numbers
  number: z.string().optional(),
  series: z.string().optional(),
  accessKey: z.string().optional(), // Chave de acesso
  
  // Status
  status: fiscalDocumentStatusSchema,
  sefazStatus: z.string().optional(),
  sefazMessage: z.string().optional(),
  
  // Protocol
  protocolNumber: z.string().optional(),
  authorizationDate: z.string().datetime().optional(),
  
  // URLs (Focus NFe paths)
  xmlPath: z.string().optional(),
  danfePath: z.string().optional(),
  qrcodeUrl: z.string().optional(),
  consultationUrl: z.string().optional(),
  
  // Cancellation
  cancellationDate: z.string().datetime().optional(),
  cancellationJustification: z.string().optional(),
  cancellationProtocol: z.string().optional(),
  
  // Contingency
  isContingency: z.boolean().default(false),
  contingencyEffectiveDate: z.string().datetime().optional(),
  
  // Error handling
  errorMessage: z.string().optional(),
  errorDetails: z.any().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type FiscalDocument = z.infer<typeof fiscalDocumentSchema>

// ============================================
// Fiscal Event Schemas
// ============================================

export const fiscalEventTypeSchema = z.enum([
  'emission_started',
  'emission_completed',
  'emission_failed',
  'cancellation_started',
  'cancellation_completed',
  'cancellation_failed',
  'contingency_started',
  'contingency_effective',
  'webhook_received'
])
export type FiscalEventType = z.infer<typeof fiscalEventTypeSchema>

export const fiscalEventSchema = z.object({
  id: z.string().uuid(),
  fiscalDocumentId: z.string().uuid(),
  companyId: z.string().uuid(),
  
  eventType: fiscalEventTypeSchema,
  status: fiscalDocumentStatusSchema,
  
  // Event data
  sefazStatus: z.string().optional(),
  sefazMessage: z.string().optional(),
  protocolNumber: z.string().optional(),
  
  // Error details
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  errorDetails: z.any().optional(),
  
  // Webhook data
  webhookPayload: z.any().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
})

export type FiscalEvent = z.infer<typeof fiscalEventSchema>

// ============================================
// NFC-e Request/Response Schemas
// ============================================

export const nfceItemSchema = z.object({
  numero_item: z.string(),
  codigo_ncm: z.string(),
  codigo_produto: z.string(),
  descricao: z.string(),
  quantidade_comercial: z.number(),
  quantidade_tributavel: z.number(),
  cfop: z.string(),
  valor_unitario_comercial: z.number(),
  valor_unitario_tributavel: z.number(),
  valor_bruto: z.number(),
  valor_desconto: z.number().optional(),
  unidade_comercial: z.string(),
  unidade_tributavel: z.string(),
  icms_origem: z.string(),
  icms_situacao_tributaria: z.string(),
  pis_situacao_tributaria: z.string().optional(),
  cofins_situacao_tributaria: z.string().optional(),
})

export const nfcePaymentSchema = z.object({
  forma_pagamento: z.string(),
  valor_pagamento: z.number(),
  tipo_integracao: z.string().optional(),
  nome_credenciadora: z.string().optional(),
  bandeira_operadora: z.string().optional(),
  numero_autorizacao: z.string().optional(),
})

export const nfceRequestSchema = z.object({
  cnpj_emitente: z.string(),
  data_emissao: z.string(),
  presenca_comprador: z.string(),
  modalidade_frete: z.string(),
  local_destino: z.string(),
  natureza_operacao: z.string(),
  items: z.array(nfceItemSchema),
  formas_pagamento: z.array(nfcePaymentSchema),
  
  // Optional fields
  numero: z.string().optional(),
  serie: z.string().optional(),
  codigo_unico: z.string().optional(),
  nome_destinatario: z.string().optional(),
  cpf_destinatario: z.string().optional(),
  cnpj_destinatario: z.string().optional(),
  indicador_inscricao_estadual_destinatario: z.string().optional(),
  informacoes_adicionais_contribuinte: z.string().optional(),
})

export const nfceResponseSchema = z.object({
  cnpj_emitente: z.string(),
  ref: z.string(),
  status: z.string(),
  status_sefaz: z.string().optional(),
  mensagem_sefaz: z.string().optional(),
  chave_nfe: z.string().optional(),
  numero: z.string().optional(),
  serie: z.string().optional(),
  caminho_xml_nota_fiscal: z.string().optional(),
  caminho_danfe: z.string().optional(),
  qrcode_url: z.string().optional(),
  url_consulta_nf: z.string().optional(),
  contingencia_offline: z.boolean().optional(),
  contingencia_offline_efetivada: z.boolean().optional(),
})

// ============================================
// Validation Helpers
// ============================================

export function validateCNPJ(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '')
  if (cleanCnpj.length !== 14) return false
  if (/^(\d)\1+$/.test(cleanCnpj)) return false
  
  let length = cleanCnpj.length - 2
  let numbers = cleanCnpj.substring(0, length)
  const digits = cleanCnpj.substring(length)
  let sum = 0
  let pos = length - 7
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - sum % 11
  if (result !== parseInt(digits.charAt(0))) return false
  
  length = length + 1
  numbers = cleanCnpj.substring(0, length)
  sum = 0
  pos = length - 7
  
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - sum % 11
  if (result !== parseInt(digits.charAt(1))) return false
  
  return true
}

export function formatCNPJ(cnpj: string): string {
  const cleanCnpj = cnpj.replace(/\D/g, '')
  return cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
