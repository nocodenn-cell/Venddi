import { describe, it, expect } from 'vitest'
import { applyCashTender, findExactProduct } from '@/lib/pdvHelpers'

describe('applyCashTender (troco em dinheiro)', () => {
  it('sem troco quando o valor entregue é exato', () => {
    expect(applyCashTender(50, 50)).toEqual({ applied: 50, change: 0 })
  })

  it('calcula troco quando o cliente entrega mais que o devido', () => {
    expect(applyCashTender(47.3, 50)).toEqual({ applied: 47.3, change: 2.7 })
  })

  it('aplica só o que falta quando entrega mais de uma nota (troco não entra no caixa)', () => {
    const { applied, change } = applyCashTender(10, 100)
    expect(applied).toBe(10)
    expect(change).toBe(90)
  })

  it('entrega insuficiente: aplica o valor recebido e não gera troco', () => {
    expect(applyCashTender(30, 12.5)).toEqual({ applied: 12.5, change: 0 })
  })

  it('arredonda em centavos sem erro de ponto flutuante', () => {
    // 0.1 + 0.2 tradicionalmente gera 0.30000000000000004
    expect(applyCashTender(0.3, 0.6)).toEqual({ applied: 0.3, change: 0.3 })
  })

  it('valores negativos viram zero', () => {
    expect(applyCashTender(-5, 10)).toEqual({ applied: 0, change: 10 })
    expect(applyCashTender(10, -3)).toEqual({ applied: 0, change: 0 })
  })
})

describe('findExactProduct (leitor de código de barras)', () => {
  const products = [
    { id: '1', sku: 'CAM-001', barcode: '7891234567890' },
    { id: '2', sku: 'BON-004', barcode: null },
    { id: '3', sku: 'MEI-005', barcode: '7890000000011' },
  ]

  it('encontra pelo código de barras exato', () => {
    expect(findExactProduct(products, '7891234567890')?.id).toBe('1')
  })

  it('encontra pelo SKU exato, sem diferenciar maiúsculas', () => {
    expect(findExactProduct(products, 'bon-004')?.id).toBe('2')
  })

  it('não aceita correspondência parcial (leitura incompleta não adiciona produto errado)', () => {
    expect(findExactProduct(products, '78912345')).toBeUndefined()
  })

  it('ignora espaços da leitura', () => {
    expect(findExactProduct(products, '  7890000000011  ')?.id).toBe('3')
  })

  it('código vazio não encontra nada', () => {
    expect(findExactProduct(products, '   ')).toBeUndefined()
  })
})
