import { describe, it, expect } from 'vitest'
import {
  countDifference,
  classifyDifference,
  parseCountedInput,
  summarizeCount,
  matchesSearch,
} from '@/lib/inventory/countMath'

describe('Inventário físico - diferença', () => {
  it('sem divergência quando contado = sistema', () => {
    expect(countDifference(5, 5)).toBe(0)
    expect(classifyDifference(0)).toBe('match')
  })

  it('falta quando contado < sistema', () => {
    expect(countDifference(8, 10)).toBe(-2)
    expect(classifyDifference(-2)).toBe('shortage')
  })

  it('sobra quando contado > sistema', () => {
    expect(countDifference(12, 9)).toBe(3)
    expect(classifyDifference(3)).toBe('surplus')
  })

  it('contagem zero registra falta total', () => {
    expect(countDifference(0, 5)).toBe(-5)
  })

  it('produto sem movimento e contado zero não diverge', () => {
    expect(countDifference(0, 0)).toBe(0)
  })
})

describe('Inventário físico - entrada da contagem', () => {
  it('aceita zero (produto ausente)', () => {
    expect(parseCountedInput('0')).toEqual({ ok: true, value: 0 })
  })

  it('aceita inteiro com espaços', () => {
    expect(parseCountedInput(' 42 ')).toEqual({ ok: true, value: 42 })
  })

  it('recusa campo vazio', () => {
    const r = parseCountedInput('   ')
    expect(r.ok).toBe(false)
  })

  it('recusa negativo e fracionado', () => {
    expect(parseCountedInput('-1').ok).toBe(false)
    expect(parseCountedInput('1.5').ok).toBe(false)
    expect(parseCountedInput('abc').ok).toBe(false)
  })
})

describe('Inventário físico - resumo do andamento', () => {
  it('separa contados, pendentes, falta e sobra', () => {
    const summary = summarizeCount([
      { countedQuantity: 5, systemQuantity: 5 }, // sem divergência
      { countedQuantity: 8, systemQuantity: 10 }, // falta
      { countedQuantity: 12, systemQuantity: 9 }, // sobra
      { countedQuantity: null, systemQuantity: null }, // pendente
    ])
    expect(summary).toEqual({
      total: 4,
      counted: 3,
      pending: 1,
      divergent: 2,
      shortage: 1,
      surplus: 1,
    })
  })

  it('item com contagem mas sem snapshot do sistema conta como pendente', () => {
    const summary = summarizeCount([{ countedQuantity: 3, systemQuantity: null }])
    expect(summary.pending).toBe(1)
    expect(summary.counted).toBe(0)
  })

  it('lista vazia não quebra', () => {
    expect(summarizeCount([])).toEqual({ total: 0, counted: 0, pending: 0, divergent: 0, shortage: 0, surplus: 0 })
  })
})

describe('Inventário físico - busca', () => {
  it('busca por nome ignorando acento e caixa', () => {
    expect(matchesSearch('tenis', ['Tênis Esportivo', 'TEN-003', null])).toBe(true)
  })

  it('busca por SKU e código de barras', () => {
    expect(matchesSearch('ten-003', ['Tênis', 'TEN-003', null])).toBe(true)
    expect(matchesSearch('7891234567892', ['Tênis', 'TEN-003', '7891234567892'])).toBe(true)
  })

  it('termo vazio mostra tudo; termo sem correspondência oculta', () => {
    expect(matchesSearch('', ['Qualquer'])).toBe(true)
    expect(matchesSearch('zzz', ['Camiseta', 'CAM-001', null])).toBe(false)
  })
})
