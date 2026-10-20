import { describe, it, expect } from 'vitest'
import {
  calcGrossProfit,
  calcGrossMarginPercent,
  calcMarkupPercent,
  calcPriceForMargin,
} from '@/lib/schemas/wholesale'

describe('Cálculos de Margem e Markup', () => {
  describe('calcGrossProfit', () => {
    it('deve calcular lucro bruto corretamente', () => {
      expect(calcGrossProfit(100, 60)).toBe(40)
      expect(calcGrossProfit(50, 30)).toBe(20)
      expect(calcGrossProfit(100, 100)).toBe(0)
    })

    it('deve retornar null quando custo é null', () => {
      expect(calcGrossProfit(100, null)).toBeNull()
    })

    it('deve calcular lucro negativo quando preço < custo', () => {
      expect(calcGrossProfit(50, 60)).toBe(-10)
    })
  })

  describe('calcGrossMarginPercent', () => {
    it('deve calcular margem bruta corretamente', () => {
      // Exemplo: Custo 60, Venda 100, Margem 40%
      expect(calcGrossMarginPercent(100, 60)).toBe(40)
      expect(calcGrossMarginPercent(50, 25)).toBe(50)
    })

    it('deve retornar null quando custo é null', () => {
      expect(calcGrossMarginPercent(100, null)).toBeNull()
    })

    it('deve retornar null quando preço de venda é 0', () => {
      expect(calcGrossMarginPercent(0, 60)).toBeNull()
    })

    it('deve calcular margem negativa quando preço < custo', () => {
      expect(calcGrossMarginPercent(50, 60)).toBe(-20)
    })
  })

  describe('calcMarkupPercent', () => {
    it('deve calcular markup corretamente', () => {
      // Exemplo: Custo 60, Venda 100, Markup 66.67%
      const result = calcMarkupPercent(100, 60)
      expect(result).toBeCloseTo(66.67, 2)
    })

    it('deve retornar null quando custo é null', () => {
      expect(calcMarkupPercent(100, null)).toBeNull()
    })

    it('deve retornar null quando custo é 0', () => {
      expect(calcMarkupPercent(100, 0)).toBeNull()
    })

    it('deve calcular markup de 100% quando preço é dobro do custo', () => {
      expect(calcMarkupPercent(100, 50)).toBe(100)
    })
  })

  describe('calcPriceForMargin', () => {
    it('deve calcular preço para margem desejada', () => {
      // Para margem de 40% com custo 60: preço = 60 / (1 - 0.40) = 100
      expect(calcPriceForMargin(60, 40)).toBe(100)
    })

    it('deve retornar null quando custo é null', () => {
      expect(calcPriceForMargin(null as any, 40)).toBeNull()
    })

    it('deve retornar null quando custo é 0', () => {
      expect(calcPriceForMargin(0, 40)).toBeNull()
    })

    it('deve lançar erro quando margem >= 100%', () => {
      expect(() => calcPriceForMargin(60, 100)).toThrow()
      expect(() => calcPriceForMargin(60, 150)).toThrow()
    })

    it('deve lançar erro quando margem é negativa', () => {
      expect(() => calcPriceForMargin(60, -10)).toThrow()
    })

    it('deve calcular preço para margem de 0% (vender pelo custo)', () => {
      expect(calcPriceForMargin(60, 0)).toBe(60)
    })
  })
})

describe('Cálculos com Valores Decimais', () => {
  it('deve lidar com valores monetários brasileiros', () => {
    const sellPrice = 99.90
    const costPrice = 49.95
    
    const profit = calcGrossProfit(sellPrice, costPrice)
    expect(profit).toBeCloseTo(49.95, 2)
    
    const margin = calcGrossMarginPercent(sellPrice, costPrice)
    expect(margin).toBeCloseTo(50.0, 1)
  })

  it('deve manter precisão em cálculos encadeados', () => {
    const cost = 100
    const desiredMargin = 30
    const price = calcPriceForMargin(cost, desiredMargin)
    
    expect(price).toBeCloseTo(142.86, 2)
    
    const actualMargin = calcGrossMarginPercent(price!, cost)
    expect(actualMargin).toBeCloseTo(30, 1)
  })
})
