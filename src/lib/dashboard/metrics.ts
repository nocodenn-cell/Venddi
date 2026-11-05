// Regras de apresentação do dashboard (sem I/O). Os totais e saldos são calculados no
// banco (migration 023); aqui fica só o que o navegador precisa para exibir.

export interface SaleRow {
  total: number
  status: 'completed' | 'cancelled' | 'refunded'
  saleDate: string
}

/** Início do dia local (00:00) para uma data. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Variação percentual. Null quando não há base de comparação (anterior = 0). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}
