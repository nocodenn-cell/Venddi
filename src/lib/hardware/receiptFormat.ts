/**
 * Formatação de cupom não fiscal para impressão de cupom via navegador (window.print).
 *
 * Funções puras (sem DOM), para poderem ser testadas unitariamente:
 * - buildReceiptLines: gera as linhas de texto do cupom com largura fixa de colunas
 * - buildReceiptHtml: gera o documento HTML com CSS de impressora térmica (80mm ou 58mm)
 *
 * Não é documento fiscal (NFC-e/SAT). É apenas comprovante de venda.
 */

export type ReceiptPaperWidth = 58 | 80

/** Colunas de texto em fonte monoespaçada padrão de impressoras térmicas (Font A). */
export const RECEIPT_COLUMNS: Record<ReceiptPaperWidth, number> = {
  80: 48,
  58: 32,
}

export interface ReceiptItem {
  name: string
  quantity: number
  unitPrice: number
}

export interface ReceiptPayment {
  method: string
  amount: number
}

export interface ReceiptData {
  storeName: string
  /** Título do cupom. Padrão: "Comprovante não fiscal". */
  title?: string
  saleNumber: number | string
  date: string
  items: ReceiptItem[]
  subtotal: number
  discount: number
  total: number
  payments: ReceiptPayment[]
  change?: number
  footer?: string
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão Crédito',
  debit_card: 'Cartão Débito',
  pix: 'PIX',
}

/**
 * Formata valor monetário no padrão brasileiro: R$ 1.234,56.
 * Valores negativos viram "-R$ 10,00".
 * Implementado manualmente para não depender de ICU/locale do navegador.
 */
export function formatBRL(value: number): string {
  const cents = Math.round(Math.abs(value) * 100)
  const intPart = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decPart = (cents % 100).toString().padStart(2, '0')
  const sign = value < 0 && cents !== 0 ? '-' : ''
  return `${sign}R$ ${intPart},${decPart}`
}

/** Quebra texto em linhas de no máximo `width` caracteres, por palavra. Palavras maiores são cortadas. */
export function wrapText(text: string, width: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const rawWord of words) {
    let word = rawWord
    while (word.length > width) {
      if (current) {
        lines.push(current)
        current = ''
      }
      lines.push(word.slice(0, width))
      word = word.slice(width)
    }

    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/** Alinha texto à esquerda e à direita na largura informada. Corta a esquerda se não couber. */
export function padLeftRight(left: string, right: string, width: number): string {
  const maxLeft = Math.max(0, width - right.length - 1)
  const l = left.slice(0, maxLeft)
  const spaces = Math.max(1, width - l.length - right.length)
  return `${l}${' '.repeat(spaces)}${right}`
}

/** Centraliza texto na largura informada. */
export function centerText(text: string, width: number): string {
  const t = text.slice(0, width)
  const left = Math.floor((width - t.length) / 2)
  return ' '.repeat(Math.max(0, left)) + t
}

/**
 * Gera as linhas de texto do cupom para a largura de colunas dada.
 * Cada linha tem no máximo `columns` caracteres.
 */
export function buildReceiptLines(data: ReceiptData, columns: number): string[] {
  const divider = '-'.repeat(columns)
  const lines: string[] = []

  lines.push(...wrapText(data.storeName, columns).map(l => centerText(l, columns)))
  lines.push(centerText(data.title ?? 'Comprovante não fiscal', columns))
  lines.push(divider)
  lines.push(...wrapText(`Venda #${data.saleNumber}`, columns))
  lines.push(...wrapText(`Data: ${data.date}`, columns))
  lines.push(divider)

  for (const item of data.items) {
    const lineTotal = item.quantity * item.unitPrice
    lines.push(...wrapText(item.name, columns))
    lines.push(padLeftRight(
      `${item.quantity} x ${formatBRL(item.unitPrice)}`,
      formatBRL(lineTotal),
      columns,
    ))
  }

  lines.push(divider)
  lines.push(padLeftRight('Subtotal', formatBRL(data.subtotal), columns))
  if (data.discount > 0) {
    lines.push(padLeftRight('Desconto', formatBRL(-data.discount), columns))
  }
  lines.push(padLeftRight('TOTAL', formatBRL(data.total), columns))
  lines.push(divider)

  for (const payment of data.payments) {
    const label = PAYMENT_LABELS[payment.method] ?? payment.method
    lines.push(padLeftRight(label, formatBRL(payment.amount), columns))
  }

  if (data.change && data.change > 0) {
    lines.push(padLeftRight('Troco', formatBRL(data.change), columns))
  }

  lines.push(divider)
  lines.push(centerText(data.footer ?? 'Obrigado pela preferência!', columns))
  lines.push(centerText('Não é documento fiscal', columns))

  return lines
}

/** Escapa texto para uso seguro dentro de HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Gera o documento HTML do cupom com CSS de impressora térmica.
 * @page usa a largura do rolo (80mm ou 58mm), margem zero e altura automática.
 */
export function buildReceiptHtml(data: ReceiptData, paperWidth: ReceiptPaperWidth = 80): string {
  const columns = RECEIPT_COLUMNS[paperWidth]
  const lines = buildReceiptLines(data, columns)
    .map(line => `<div class="line">${escapeHtml(line) || '&nbsp;'}</div>`)
    .join('\n')

  // Área imprimível típica: 80mm -> 72mm, 58mm -> 48mm (margens do próprio rolo).
  const printableMm = paperWidth === 80 ? 72 : 48

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Cupom ${escapeHtml(String(data.saleNumber))}</title>
<style>
  @page { size: ${paperWidth}mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    width: ${printableMm}mm;
    margin: 0 auto;
    padding: 2mm 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 9px;
    line-height: 1.3;
  }
  .line { white-space: pre; overflow: hidden; }
  @media screen {
    body { box-shadow: 0 0 4px rgba(0,0,0,.2); padding: 4mm 2mm; }
  }
</style>
</head>
<body>
${lines}
</body>
</html>`
}
