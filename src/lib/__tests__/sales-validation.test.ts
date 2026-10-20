import { describe, it, expect } from 'vitest'
import {
  validateSalePayments,
  calculateChange,
  calculateSaleTotals,
} from '@/lib/schemas/sales'
import type { SaleItem, Payment } from '@/lib/schemas/sales'

describe('Validações de Venda', () => {
  describe('validateSalePayments', () => {
    it('deve validar pagamentos que correspondem ao total', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 100, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(true)
    })

    it('deve validar pagamentos divididos', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 50, installments: 1, changeAmount: 0 },
          { method: 'credit_card' as const, amount: 50, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(true)
    })

    it('deve rejeitar pagamentos insuficientes', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 50, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(false)
    })

    it('deve rejeitar pagamentos excessivos', () => {
      const sale = {
        total: 100,
        payments: [
          { method: 'cash' as const, amount: 150, installments: 1, changeAmount: 0 },
        ],
      }
      expect(validateSalePayments(sale)).toBe(false)
    })

    it('deve permitir pequenas diferenças de ponto flutuante', () => {
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
    it('deve calcular troco corretamente', () => {
      expect(calculateChange(150, 100)).toBe(50)
      expect(calculateChange(100.50, 99.99)).toBeCloseTo(0.51, 2)
    })

    it('deve retornar 0 quando valor exato', () => {
      expect(calculateChange(100, 100)).toBe(0)
    })

    it('deve retornar 0 quando valor insuficiente', () => {
      expect(calculateChange(50, 100)).toBe(0)
    })

    it('deve lidar com valores decimais', () => {
      expect(calculateChange(100.00, 99.90)).toBeCloseTo(0.10, 2)
    })
  })

  describe('calculateSaleTotals', () => {
    it('deve calcular subtotal e total sem descontos', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Produto 1',
          quantity: 2,
          unitPrice: 50,
          discount: 0,
          subtotal: 100,
        },
        {
          productId: '2',
          productName: 'Produto 2',
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

    it('deve aplicar desconto geral', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Produto 1',
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

    it('deve adicionar despesas adicionais', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Produto 1',
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

    it('deve aplicar desconto e despesas juntos', () => {
      const items: SaleItem[] = [
        {
          productId: '1',
          productName: 'Produto 1',
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

    it('deve lidar com carrinho vazio', () => {
      const items: SaleItem[] = []
      const result = calculateSaleTotals(items)
      expect(result.subtotal).toBe(0)
      expect(result.total).toBe(0)
    })
  })
})

describe('Cenários de Venda Real', () => {
  it('deve calcular venda de atacado corretamente', () => {
    // 10 unidades a R$ 45,00 (atacado 6+)
    const items: SaleItem[] = [
      {
        productId: '1',
        productName: 'Camiseta',
        quantity: 10,
        unitPrice: 45,
        discount: 0,
        subtotal: 450,
      },
    ]

    const result = calculateSaleTotals(items)
    expect(result.subtotal).toBe(450)
    expect(result.total).toBe(450)
  })

  it('deve calcular venda com desconto e pagamento dividido', () => {
    const items: SaleItem[] = [
      {
        productId: '1',
        productName: 'Produto 1',
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        subtotal: 200,
      },
    ]

    const result = calculateSaleTotals(items, 20) // R$ 20 de desconto
    expect(result.subtotal).toBe(200)
    expect(result.total).toBe(180)

    // Pagamento dividido
    const sale = {
      total: 180,
      payments: [
        { method: 'cash' as const, amount: 100, installments: 1, changeAmount: 0 },
        { method: 'credit_card' as const, amount: 80, installments: 1, changeAmount: 0 },
      ],
    }

    expect(validateSalePayments(sale)).toBe(true)
  })

  it('deve calcular troco em venda em dinheiro', () => {
    const total = 450
    const received = 500
    const change = calculateChange(received, total)
    expect(change).toBe(50)
  })
})
