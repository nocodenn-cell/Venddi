import { z } from 'zod'

// ============================================
// Wholesale Tier Schemas
// ============================================

export const wholesaleTierSchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  productId: z.string().uuid(),
  minQuantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type WholesaleTier = z.infer<typeof wholesaleTierSchema>

export const createWholesaleTierSchema = z.object({
  productId: z.string().uuid(),
  minQuantity: z.number().int().positive('Quantidade mínima deve ser positiva'),
  unitPrice: z.number().positive('Preço deve ser positivo'),
})

export type CreateWholesaleTierInput = z.infer<typeof createWholesaleTierSchema>

// ============================================
// Margin Policy Schemas
// ============================================

export const marginPolicyModeSchema = z.enum(['disabled', 'warn', 'require_approval'])
export type MarginPolicyMode = z.infer<typeof marginPolicyModeSchema>

export const marginPolicySchema = z.object({
  id: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  mode: marginPolicyModeSchema,
  minMarginPercent: z.number().min(0).max(99.99).nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
})

export type MarginPolicy = z.infer<typeof marginPolicySchema>

// ============================================
// Price Resolution Schemas
// ============================================

export const priceOriginSchema = z.enum(['retail', 'wholesale', 'promotion'])
export type PriceOrigin = z.infer<typeof priceOriginSchema>

export const priceResolutionSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
  retailPrice: z.number(),
  costPrice: z.number().nullable(),
  origin: priceOriginSchema,
  wholesaleTierId: z.string().uuid().nullable(),
  wholesaleTierMinQty: z.number().int().nullable(),
  grossProfit: z.number().nullable(),
  grossMarginPercent: z.number().nullable(),
  markupPercent: z.number().nullable(),
  nextTierInfo: z.object({
    minQuantity: z.number().int(),
    unitPrice: z.number(),
    quantityToAdd: z.number().int(),
  }).nullable().optional(),
})

export type PriceResolution = z.infer<typeof priceResolutionSchema>

// ============================================
// Margin Calculation Helpers
// ============================================

/**
 * Calculate gross profit
 * Formula: sell_price - cost_price
 */
export function calcGrossProfit(sellPrice: number, costPrice: number | null): number | null {
  if (costPrice === null || costPrice === undefined) return null
  return sellPrice - costPrice
}

/**
 * Calculate gross margin percentage
 * Formula: ((sell_price - cost_price) / sell_price) * 100
 */
export function calcGrossMarginPercent(sellPrice: number, costPrice: number | null): number | null {
  if (costPrice === null || costPrice === undefined) return null
  if (sellPrice <= 0) return null
  return ((sellPrice - costPrice) / sellPrice) * 100
}

/**
 * Calculate markup percentage over cost
 * Formula: ((sell_price - cost_price) / cost_price) * 100
 */
export function calcMarkupPercent(sellPrice: number, costPrice: number | null): number | null {
  if (costPrice === null || costPrice === undefined) return null
  if (costPrice <= 0) return null
  return ((sellPrice - costPrice) / costPrice) * 100
}

/**
 * Suggest price for desired margin
 * Formula: cost_price / (1 - desired_margin / 100)
 */
export function calcPriceForMargin(costPrice: number, desiredMarginPercent: number): number | null {
  if (costPrice <= 0) return null
  if (desiredMarginPercent >= 100) return null
  if (desiredMarginPercent < 0) return null
  return costPrice / (1 - desiredMarginPercent / 100)
}

/**
 * Format margin/markup for display
 */
export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return 'N/D'
  return `${value.toFixed(2)}%`
}

/**
 * Format currency in BRL
 */
export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

// ============================================
// Sale Item with pricing details
// ============================================

export const saleItemWithPricingSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
  costPrice: z.number().nullable(),
  discount: z.number().min(0).default(0),
  subtotal: z.number(),
  priceOrigin: priceOriginSchema.optional(),
  wholesaleTierId: z.string().uuid().nullable().optional(),
  wholesaleTierMinQty: z.number().int().nullable().optional(),
  grossProfit: z.number().nullable().optional(),
  grossMarginPercent: z.number().nullable().optional(),
  generalDiscountShare: z.number().min(0).default(0),
  netRevenue: z.number().optional(),
  authorizationId: z.string().uuid().nullable().optional(),
})

export type SaleItemWithPricing = z.infer<typeof saleItemWithPricingSchema>

// ============================================
// Sale Authorization
// ============================================

export const saleAuthorizationSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  saleId: z.string().uuid().nullable(),
  authorizerId: z.string().uuid().nullable(),
  reason: z.string(),
  approvedValues: z.record(z.string(), z.any()).default({}),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
})

export type SaleAuthorization = z.infer<typeof saleAuthorizationSchema>

// ============================================
// Report Schemas
// ============================================

export const marginReportItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number(),
  unitCost: z.number().nullable(),
  unitPrice: z.number(),
  revenue: z.number(),
  cost: z.number().nullable(),
  grossProfit: z.number().nullable(),
  priceOrigin: priceOriginSchema,
})

export const marginReportSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  totalRevenue: z.number(),
  totalCost: z.number().nullable(),
  totalGrossProfit: z.number().nullable(),
  weightedMarginPercent: z.number().nullable(),
  retailRevenue: z.number(),
  wholesaleRevenue: z.number(),
  items: z.array(marginReportItemSchema),
  salesWithoutCost: z.number(),
  cancelledSales: z.number(),
})

export type MarginReport = z.infer<typeof marginReportSchema>
