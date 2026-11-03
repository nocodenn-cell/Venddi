import { describe, it, expect } from 'vitest'
import { lowStockProductIds } from '@/lib/stock/lowStock'

describe('Estoque baixo', () => {
  it('inclui saldo no mínimo e abaixo, exclui acima do mínimo', () => {
    expect(
      lowStockProductIds([
        { id: 'a', stockQuantity: 1, minStock: 2 },
        { id: 'b', stockQuantity: 2, minStock: 2 },
        { id: 'c', stockQuantity: 9, minStock: 2 },
      ])
    ).toEqual(['a', 'b'])
  })

  it('produto com mínimo zero e saldo zero entra (no mínimo)', () => {
    expect(lowStockProductIds([{ id: 'z', stockQuantity: 0, minStock: 0 }])).toEqual(['z'])
  })

  it('sem produtos retorna lista vazia', () => {
    expect(lowStockProductIds([])).toEqual([])
  })
})
