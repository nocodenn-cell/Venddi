import { roundToCents } from '@/lib/schemas/sales'

/**
 * Divide um pagamento em dinheiro entre o que é aplicado à venda e o troco.
 *
 * - `remaining`: quanto ainda falta pagar da venda (R$).
 * - `tendered`: quanto o cliente entregou em dinheiro (R$).
 *
 * O valor aplicado nunca passa do que falta (o que sobra vira troco), e o caixa só
 * recebe o valor aplicado — o troco sai da gaveta, não entra.
 */
export function applyCashTender(
  remaining: number,
  tendered: number
): { applied: number; change: number } {
  const due = roundToCents(Math.max(0, remaining))
  const received = roundToCents(Math.max(0, tendered))
  const applied = roundToCents(Math.min(due, received))
  const change = roundToCents(Math.max(0, received - due))
  return { applied, change }
}

/**
 * Encontra um produto cujo código de barras ou SKU seja exatamente o código lido.
 * Usado pelo leitor de código de barras: a leitura termina com Enter e precisa
 * adicionar o item sem passar pela busca aproximada.
 */
export function findExactProduct<T extends { sku: string; barcode: string | null }>(
  products: T[],
  code: string
): T | undefined {
  const normalized = code.trim().toLowerCase()
  if (!normalized) return undefined
  return products.find(
    (p) =>
      (p.barcode ?? '').trim().toLowerCase() === normalized ||
      p.sku.trim().toLowerCase() === normalized
  )
}
