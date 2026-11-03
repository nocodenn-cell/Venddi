import { describe, it, expect } from 'vitest'
import {
  startOfLocalDay,
  percentChange,
  sumCompletedBetween,
  countLowStock,
  openCashBalance,
} from '@/lib/dashboard/metrics'

describe('Dashboard - variação', () => {
  it('calcula variação percentual', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
  })

  it('sem base de comparação não inventa variação', () => {
    expect(percentChange(150, 0)).toBeNull()
  })
})

describe('Dashboard - vendas por período', () => {
  const start = new Date('2026-11-03T00:00:00')
  const end = new Date('2026-11-04T00:00:00')

  it('soma só vendas concluídas dentro do intervalo', () => {
    const sales = [
      { total: 40, status: 'completed' as const, saleDate: '2026-11-03T10:00:00' },
      { total: 90, status: 'cancelled' as const, saleDate: '2026-11-03T11:00:00' },
      { total: 10, status: 'completed' as const, saleDate: '2026-11-02T23:59:00' },
      { total: 25.5, status: 'completed' as const, saleDate: '2026-11-03T12:00:00' },
    ]
    expect(sumCompletedBetween(sales, start, end)).toEqual({ total: 65.5, count: 2 })
  })

  it('início do dia usa o dia local', () => {
    const d = startOfLocalDay(new Date(2026, 10, 3, 15, 42))
    expect(d.getHours()).toBe(0)
    expect(d.getDate()).toBe(3)
  })
})

describe('Dashboard - estoque baixo', () => {
  it('conta produtos no mínimo ou abaixo', () => {
    expect(
      countLowStock([
        { stockQuantity: 1, minStock: 2 },
        { stockQuantity: 2, minStock: 2 },
        { stockQuantity: 9, minStock: 2 },
      ])
    ).toBe(2)
  })
})

describe('Dashboard - saldo em caixa', () => {
  it('usa o último saldo do caixa e o inicial quando não há movimento', () => {
    const registers = [
      { id: 'c1', initialAmount: 100 },
      { id: 'c2', initialAmount: 50 },
    ]
    const movements = [
      { cashRegisterId: 'c1', balanceAfter: 140, createdAt: '2026-11-03T10:00:00' },
      { cashRegisterId: 'c1', balanceAfter: 120, createdAt: '2026-11-03T11:00:00' },
    ]
    expect(openCashBalance(registers, movements)).toBe(170)
  })

  it('sem caixa aberto o saldo é zero', () => {
    expect(openCashBalance([], [])).toBe(0)
  })
})
