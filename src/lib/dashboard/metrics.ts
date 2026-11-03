// Regras de cálculo do dashboard (sem I/O). Os dados vêm do banco em api/dashboard.ts.

export interface SaleRow {
  total: number
  status: 'completed' | 'cancelled' | 'refunded'
  saleDate: string
}

export interface ProductStockRow {
  stockQuantity: number
  minStock: number
}

export interface CashRegisterRow {
  id: string
  initialAmount: number
}

export interface CashMovementRow {
  cashRegisterId: string
  type: 'sale' | 'deposit' | 'withdrawal' | 'refund'
  amount: number
}

// Entradas somam ao caixa; saídas subtraem. balance_after não é confiável: depósitos e
// sangrias gravam 0 nele (src/lib/api/cashRegister.ts), então o saldo é recalculado.
const SIGN_BY_TYPE: Record<CashMovementRow['type'], 1 | -1> = {
  sale: 1,
  deposit: 1,
  withdrawal: -1,
  refund: -1,
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

/** Soma o total das vendas concluídas que caem no intervalo [start, end). */
export function sumCompletedBetween(sales: SaleRow[], start: Date, end: Date): { total: number; count: number } {
  let total = 0
  let count = 0
  for (const sale of sales) {
    if (sale.status !== 'completed') continue
    const at = new Date(sale.saleDate).getTime()
    if (at < start.getTime() || at >= end.getTime()) continue
    total += sale.total
    count++
  }
  return { total: Math.round(total * 100) / 100, count }
}

/** Produtos com saldo no mínimo ou abaixo. */
export function countLowStock(products: ProductStockRow[]): number {
  return products.filter((p) => p.stockQuantity <= p.minStock).length
}

/**
 * Saldo em caixa: para cada caixa aberto, valor inicial mais as movimentações com sinal
 * (entradas somam, saídas subtraem). Soma os caixas abertos.
 */
export function openCashBalance(registers: CashRegisterRow[], movements: CashMovementRow[]): number {
  let total = 0
  for (const register of registers) {
    let balance = register.initialAmount
    for (const movement of movements) {
      if (movement.cashRegisterId !== register.id) continue
      balance += SIGN_BY_TYPE[movement.type] * movement.amount
    }
    total += balance
  }
  return Math.round(total * 100) / 100
}
