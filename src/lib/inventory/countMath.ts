// Regras puras do inventário físico (sem I/O). A autoridade final dos cálculos
// é o banco (migration 019); estas funções alimentam a tela e são testadas em unidade.

export type DifferenceKind = 'match' | 'shortage' | 'surplus'

export interface CountableItem {
  countedQuantity: number | null
  systemQuantity: number | null
}

export interface CountSummary {
  total: number
  counted: number
  pending: number
  divergent: number
  shortage: number
  surplus: number
}

/** Diferença contado - sistema. Negativa = falta, positiva = sobra. */
export function countDifference(countedQuantity: number, systemQuantity: number): number {
  return countedQuantity - systemQuantity
}

export function classifyDifference(difference: number): DifferenceKind {
  if (difference < 0) return 'shortage'
  if (difference > 0) return 'surplus'
  return 'match'
}

/**
 * Valida o texto digitado na contagem. Zero é válido (produto ausente).
 * Retorna o inteiro ou uma mensagem em pt-BR.
 */
export function parseCountedInput(raw: string): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: false, error: 'Informe a quantidade contada (use 0 se não houver)' }
  const value = Number(trimmed)
  if (!Number.isInteger(value)) return { ok: false, error: 'Use apenas números inteiros' }
  if (value < 0) return { ok: false, error: 'A quantidade contada não pode ser negativa' }
  return { ok: true, value }
}

/** Resume o andamento: itens contados, pendentes e divergentes (falta/sobra). */
export function summarizeCount(items: CountableItem[]): CountSummary {
  const summary: CountSummary = { total: items.length, counted: 0, pending: 0, divergent: 0, shortage: 0, surplus: 0 }
  for (const item of items) {
    if (item.countedQuantity === null || item.systemQuantity === null) {
      summary.pending++
      continue
    }
    summary.counted++
    const kind = classifyDifference(countDifference(item.countedQuantity, item.systemQuantity))
    if (kind === 'shortage') {
      summary.divergent++
      summary.shortage++
    } else if (kind === 'surplus') {
      summary.divergent++
      summary.surplus++
    }
  }
  return summary
}

/** Busca por nome, SKU ou código de barras (ignora maiúsculas e acentos). */
export function matchesSearch(
  term: string,
  fields: Array<string | null | undefined>
): boolean {
  const normalized = normalizeText(term)
  if (normalized === '') return true
  return fields.some((field) => field != null && normalizeText(field).includes(normalized))
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}
