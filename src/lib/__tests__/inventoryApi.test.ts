import { describe, it, expect, vi } from 'vitest'

// Cliente falso: simula a API paginada (cada resposta devolve no máximo `range` linhas).
const TOTAL_ROWS = 2005

vi.mock('@/lib/supabase', () => {
  const rows = Array.from({ length: 2005 }, (_, i) => ({
    id: `item-${String(i).padStart(5, '0')}`,
    product_id: `p-${i}`,
    system_quantity: 1,
    counted_quantity: null,
    applied_difference: null,
    products: { name: `Produto ${i}`, sku: `S-${i}`, barcode: null, stock_quantity: 1 },
  }))
  const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ range }),
        }),
      }),
    }),
  }
  return { supabase: client, isSupabaseConfigured: true }
})

import { getInventoryCountItems } from '@/lib/api/inventory'

describe('API do inventário - paginação', () => {
  it('carrega todos os itens mesmo acima do limite de uma página', async () => {
    const items = await getInventoryCountItems('count-1')
    expect(items).toHaveLength(TOTAL_ROWS)
    expect(new Set(items.map((i) => i.id)).size).toBe(TOTAL_ROWS)
  })
})
