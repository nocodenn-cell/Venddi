import { z } from 'zod'

// ============================================
// Sale Schemas
// ============================================

export const saleStatusSchema = z.enum(['draft', 'completed', 'cancelled', 'refunded'])
export type SaleStatus = z.infer<typeof saleStatusSchema>

export const paymentMethodSchema = z.enum(['cash', 'credit_card', 'debit_card', 'pix', 'check'])
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).default(0),
  subtotal: z.number().min(0),
})

export type SaleItem = z.infer<typeof saleItemSchema>

export const paymentSchema = z.object({
  method: paymentMethodSchema,
  amount: z.number().min(0),
  installments: z.number().int().min(1).default(1),
  receivedAmount: z.number().min(0).optional(), // For cash payments
  changeAmount: z.number().min(0).default(0), // Change for cash payments
})

export type Payment = z.infer<typeof paymentSchema>

export const saleSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  saleNumber: z.number().int().positive(),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  operatorId: z.string().uuid(),
  operatorName: z.string(),
  cashRegisterId: z.string().uuid().optional(),
  
  items: z.array(saleItemSchema),
  payments: z.array(paymentSchema),
  
  subtotal: z.number().min(0),
  discount: z.number().min(0).default(0),
  additionalExpenses: z.number().min(0).default(0),
  total: z.number().min(0),
  
  status: saleStatusSchema.default('draft'),
  notes: z.string().optional(),
  
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  cancelledAt: z.string().datetime().optional(),
  cancellationReason: z.string().optional(),
})

export type Sale = z.infer<typeof saleSchema>

// ============================================
// Cash Register Schemas
// ============================================

export const cashRegisterStatusSchema = z.enum(['open', 'closed'])
export type CashRegisterStatus = z.infer<typeof cashRegisterStatusSchema>

export const cashRegisterSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  operatorId: z.string().uuid(),
  operatorName: z.string(),
  
  status: cashRegisterStatusSchema,
  openingDate: z.string().datetime(),
  closingDate: z.string().datetime().optional(),
  
  initialAmount: z.number().min(0),
  finalAmount: z.number().min(0).optional(),
  
  totalSales: z.number().min(0).default(0),
  totalWithdrawals: z.number().min(0).default(0),
  totalDeposits: z.number().min(0).default(0),
  
  openingNotes: z.string().optional(),
  closingNotes: z.string().optional(),
  reopeningReason: z.string().optional(),
})

export type CashRegister = z.infer<typeof cashRegisterSchema>

export const cashMovementTypeSchema = z.enum(['sale', 'withdrawal', 'deposit', 'refund'])
export type CashMovementType = z.infer<typeof cashMovementTypeSchema>

export const cashMovementSchema = z.object({
  id: z.string().uuid(),
  cashRegisterId: z.string().uuid(),
  companyId: z.string().uuid(),
  operatorId: z.string().uuid(),
  
  type: cashMovementTypeSchema,
  amount: z.number().min(0),
  description: z.string(),
  category: z.string().optional(),
  
  referenceType: z.string().optional(), // 'sale', 'withdrawal', etc.
  referenceId: z.string().uuid().optional(),
  
  balanceAfter: z.number(),
  
  createdAt: z.string().datetime(),
})

export type CashMovement = z.infer<typeof cashMovementSchema>

// ============================================
// Financial Schemas
// ============================================

export const financialAccountTypeSchema = z.enum(['payable', 'receivable'])
export type FinancialAccountType = z.infer<typeof financialAccountTypeSchema>

export const financialAccountStatusSchema = z.enum(['pending', 'paid', 'overdue', 'cancelled'])
export type FinancialAccountStatus = z.infer<typeof financialAccountStatusSchema>

export const financialAccountSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  
  type: financialAccountTypeSchema,
  description: z.string(),
  category: z.string(),
  
  amount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  
  dueDate: z.string(),
  paidAt: z.string().datetime().optional(),
  
  status: financialAccountStatusSchema.default('pending'),
  
  referenceType: z.string().optional(), // 'sale', 'purchase', etc.
  referenceId: z.string().uuid().optional(),
  
  personId: z.string().uuid().optional(), // customer or supplier
  personType: z.enum(['customer', 'supplier']).optional(),
  
  notes: z.string().optional(),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type FinancialAccount = z.infer<typeof financialAccountSchema>

export const financialCategorySchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  
  name: z.string(),
  type: z.enum(['income', 'expense']),
  color: z.string().optional(),
  isActive: z.boolean().default(true),
  
  createdAt: z.string().datetime(),
})

export type FinancialCategory = z.infer<typeof financialCategorySchema>

// ============================================
// Validation Helpers
// ============================================

export function validateSalePayments(sale: { total: number; payments: Payment[] }): boolean {
  const totalPayments = sale.payments.reduce((sum, p) => sum + p.amount, 0)
  return Math.abs(totalPayments - sale.total) < 0.01 // Allow small floating point differences
}

// Arredonda para centavos, evitando erros de ponto flutuante (ex.: 100.5 - 99.99)
export function roundToCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateChange(receivedAmount: number, totalAmount: number): number {
  return Math.max(0, roundToCents(receivedAmount - totalAmount))
}

export function calculateSaleTotals(
  items: SaleItem[],
  discount: number = 0,
  additionalExpenses: number = 0
): { subtotal: number; total: number } {
  const subtotal = roundToCents(items.reduce((sum, item) => sum + item.subtotal, 0))
  const total = roundToCents(subtotal - discount + additionalExpenses)
  return { subtotal, total }
}
