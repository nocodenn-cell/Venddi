import { describe, it, expect } from 'vitest'
import {
  validateSalePayments,
  calculateChange,
  calculateSaleTotals,
} from '@/lib/schemas/sales'
import type { SaleItem, Payment } from '@/lib/schemas/sales'

describe('Sale Validation', () => {
  describe('validateSalePayments', () => {
    it('should validate matching payments', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 100, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(true)
    })

    it('should validate multiple payments', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 50, installments: 1, changeAmount: 0 },
          { method: 'credit_card' as const, amount: 50, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(true)
    })

    it('should reject insufficient payments', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 50, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(false)
    })

    it('should reject excessive payments', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 150, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(false)
    })

    it('should allow small floating point differences', () => {
      const sale = {
        total: 100.01,
        payments: [
          { method: 'cash' as const, amount: 100.009, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(true)
    })
  })

  describe('calculateChange', () => {
    it('should calculate correct change', () => {
      expect(calculateChange(150, 100)).toBe(50)
    })

    it('should return 0 when exact amount', () => {
      expect(calculateChange(100, 100)).toBe(0)
    })

    it('should return 0 when insufficient amount', () => {
      expect(calculateChange(50, 100)).toBe(0)
    })

    it('should handle decimal values', () => {
      expect(calculateChange(100.50, 99.99)).toBe(0.51)
    })
  })

  describe('calculateSaleTotals', () => {
    it('should calculate subtotal and total', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Product 1',
          quantity: 2,
          unitPrice: 50,
          discount: 0,
          subtotal: 100,
        },
        {
          productId: '2',
          productName: 'Product 2',
          quantity: 1,
          unitPrice: 30,
          discount: 0,
          subtotal: 30,
        },
      ]

      const result = calculateSaleTotals(items)
      expect(result.subtotal).toBe(130)
      expect(result.total).toBe(130)
    })

    it('should apply discount', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          subtotal: 100,
        },
      ]

      const result = calculateSaleTotals(items, 10)
      expect(result.subtotal).toBe(100)
      expect(result.total).toBe(90)
    })

    it('should add additional expenses', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          subtotal: 100,
        },
      ]

      const result = calculateSaleTotals(items, 0, 5)
      expect(result.subtotal).toBe(100)
      expect(result.total).toBe(105)
    })

    it('should apply discount and expenses together', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Product 1',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          subtotal: 100,
        },
      ]

      const result = calculateSaleTotals(items, 10, 5)
      expect(result.subtotal).toBe(100)
      expect(result.total).toBe(95)
    })
  })
})
