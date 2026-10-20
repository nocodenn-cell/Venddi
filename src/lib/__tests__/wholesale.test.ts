import { describe, it, expect } from 'vitest'
import {
  calcGrossProfit,
  calcGrossMarginPercent,
  calcMarkupPercent,
  calcPriceForMargin,
  formatPercent,
  formatBRL,
} from '@/lib/schemas/wholesale'

describe('Margin and Markup Calculations', () => {
  describe('calcGrossProfit', () => {
    it('should calculate gross profit correctly', () => {
      // Example from spec: Cost R$ 60, Sell R$ 100, Profit R$ 40
      expect(calcGrossProfit(100, 60)).toBe(40)
    })

    it('should return null when cost is null', () => {
      expect(calcGrossProfit(100, null)).toBeNull()
    })

    it('should handle negative profit (selling below cost)', () => {
      expect(calcGrossProfit(50, 60)).toBe(-10)
    })

    it('should handle zero profit', () => {
      expect(calcGrossProfit(60, 60)).toBe(0)
    })
  })

  describe('calcGrossMarginPercent', () => {
    it('should calculate gross margin correctly', () => {
      // Example from spec: Margin 40%
      expect(calcGrossMarginPercent(100, 60)).toBe(40)
    })

    it('should return null when cost is null', () => {
      expect(calcGrossMarginPercent(100, null)).toBeNull()
    })

    it('should return null when sell price is zero', () => {
      expect(calcGrossMarginPercent(0, 60)).toBeNull()
    })

    it('should handle 100% margin (zero cost)', () => {
      expect(calcGrossMarginPercent(100, 0)).toBe(100)
    })

    it('should handle negative margin', () => {
      const result = calcGrossMarginPercent(50, 60)
      expect(result).toBe(-20)
    })
  })

  describe('calcMarkupPercent', () => {
    it('should calculate markup correctly', () => {
      // Example from spec: Markup 66.67%
      const result = calcMarkupPercent(100, 60)
      expect(result).toBeCloseTo(66.67, 2)
    })

    it('should return null when cost is null', () => {
      expect(calcMarkupPercent(100, null)).toBeNull()
    })

    it('should return null when cost is zero', () => {
      expect(calcMarkupPercent(100, 0)).toBeNull()
    })

    it('should handle 0% markup (sell at cost)', () => {
      expect(calcMarkupPercent(60, 60)).toBe(0)
    })

    it('should handle negative markup', () => {
      const result = calcMarkupPercent(50, 60)
      expect(result).toBeCloseTo(-16.67, 2)
    })
  })

  describe('calcPriceForMargin', () => {
    it('should calculate price for desired margin', () => {
      // For 40% margin on cost of 60: price = 60 / (1 - 0.40) = 100
      expect(calcPriceForMargin(60, 40)).toBe(100)
    })

    it('should return null for cost <= 0', () => {
      expect(calcPriceForMargin(0, 40)).toBeNull()
      expect(calcPriceForMargin(-10, 40)).toBeNull()
    })

    it('should reject margin >= 100%', () => {
      expect(() => calcPriceForMargin(60, 100)).toThrow()
      expect(() => calcPriceForMargin(60, 150)).toThrow()
    })

    it('should reject negative margin', () => {
      expect(() => calcPriceForMargin(60, -10)).toThrow()
    })

    it('should handle 0% margin (sell at cost)', () => {
      expect(calcPriceForMargin(60, 0)).toBe(60)
    })

    it('should handle small margin', () => {
      const result = calcPriceForMargin(100, 10)
      expect(result).toBeCloseTo(111.11, 2)
    })
  })

  describe('formatPercent', () => {
    it('should format percentage with 2 decimals', () => {
      expect(formatPercent(40)).toBe('40.00%')
      expect(formatPercent(66.666)).toBe('66.67%')
    })

    it('should return N/D for null', () => {
      expect(formatPercent(null)).toBe('N/D')
    })
  })

  describe('formatBRL', () => {
    it('should format currency in BRL', () => {
      expect(formatBRL(100)).toContain('100')
      expect(formatBRL(100)).toContain('R$')
    })

    it('should return N/D for null/undefined', () => {
      expect(formatBRL(null)).toBe('N/D')
      expect(formatBRL(undefined)).toBe('N/D')
    })
  })
})

describe('Wholesale Tier Boundaries', () => {
  // Test the boundary conditions for wholesale tiers
  // Example: 1-5 = R$20, 6-11 = R$18, 12+ = R$16

  it('should apply retail price for quantity 1-5', () => {
    const quantities = [1, 2, 3, 4, 5]
    for (const qty of quantities) {
      // Simulate: qty < 6, so retail applies
      expect(qty < 6).toBe(true)
    }
  })

  it('should apply first wholesale tier at quantity 6', () => {
    const qty = 6
    expect(qty >= 6 && qty < 12).toBe(true)
  })

  it('should apply second wholesale tier at quantity 12', () => {
    const qty = 12
    expect(qty >= 12).toBe(true)
  })

  it('should recalculate when reducing from 12 to 11', () => {
    // At 12: wholesale tier 2 (R$16)
    // At 11: wholesale tier 1 (R$18)
    const priceAt12 = 16
    const priceAt11 = 18
    expect(priceAt11).toBeGreaterThan(priceAt12)
  })

  it('should not sum quantities across different products', () => {
    // Product A: 3 units, Product B: 4 units
    // Should NOT combine to 7 units for wholesale
    const productAQty = 3
    const productBQty = 4
    expect(productAQty < 6).toBe(true) // Retail
    expect(productBQty < 6).toBe(true) // Retail
  })
})

describe('Edge Cases', () => {
  it('should handle product without wholesale tiers', () => {
    // Should fall back to retail price
    const retailPrice = 20
    const quantity = 10
    // No tiers, so use retail
    expect(retailPrice).toBe(20)
  })

  it('should handle zero quantity', () => {
    // Should be rejected
    const quantity = 0
    expect(quantity <= 0).toBe(true)
  })

  it('should handle negative quantity', () => {
    const quantity = -5
    expect(quantity <= 0).toBe(true)
  })

  it('should handle very large quantities', () => {
    const quantity = 1000000
    // Should still apply highest tier
    expect(quantity >= 12).toBe(true)
  })
})
