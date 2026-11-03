// Estoque baixo: saldo no mínimo ou abaixo. Regra única, usada pela listagem de produtos
// e pelo painel.
export interface StockRow {
  id: string
  stockQuantity: number
  minStock: number
}

export function lowStockProductIds(rows: StockRow[]): string[] {
  return rows.filter((row) => row.stockQuantity <= row.minStock).map((row) => row.id)
}
