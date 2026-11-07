import { describe, it, expect } from 'vitest'
import {
  formatBRL,
  wrapText,
  padLeftRight,
  centerText,
  buildReceiptLines,
  buildReceiptHtml,
  escapeHtml,
  RECEIPT_COLUMNS,
  ReceiptData,
} from './receiptFormat'

const sample: ReceiptData = {
  storeName: 'Loja Exemplo',
  saleNumber: 42,
  date: '07/11/2026 14:30',
  items: [
    { name: 'Café expresso', quantity: 2, unitPrice: 5.5 },
    { name: 'Pão de queijo grande com recheio especial da casa', quantity: 1, unitPrice: 1234.56 },
  ],
  subtotal: 1245.56,
  discount: 1.56,
  total: 1244,
  payments: [
    { method: 'cash', amount: 1000 },
    { method: 'pix', amount: 244 },
  ],
  change: 0,
}

describe('formatBRL', () => {
  it('formata valores no padrão brasileiro', () => {
    expect(formatBRL(10)).toBe('R$ 10,00')
    expect(formatBRL(5.5)).toBe('R$ 5,50')
    expect(formatBRL(1234.56)).toBe('R$ 1.234,56')
    expect(formatBRL(1000000)).toBe('R$ 1.000.000,00')
  })

  it('formata negativos com sinal antes do R$', () => {
    expect(formatBRL(-2.5)).toBe('-R$ 2,50')
  })

  it('arredonda centavos corretamente (evita erro de ponto flutuante)', () => {
    expect(formatBRL(0.1 + 0.2)).toBe('R$ 0,30')
    expect(formatBRL(19.99 * 3)).toBe('R$ 59,97')
  })
})

describe('wrapText', () => {
  it('mantém texto curto em uma linha', () => {
    expect(wrapText('Café', 10)).toEqual(['Café'])
  })

  it('quebra por palavra respeitando a largura', () => {
    expect(wrapText('um dois tres quatro', 9)).toEqual(['um dois', 'tres', 'quatro'])
  })

  it('corta palavra maior que a largura', () => {
    expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('retorna uma linha vazia para texto vazio', () => {
    expect(wrapText('   ', 10)).toEqual([''])
  })
})

describe('padLeftRight e centerText', () => {
  it('alinha à esquerda e à direita na largura exata', () => {
    const line = padLeftRight('TOTAL', 'R$ 1,00', 20)
    expect(line).toHaveLength(20)
    expect(line.startsWith('TOTAL')).toBe(true)
    expect(line.endsWith('R$ 1,00')).toBe(true)
  })

  it('corta o lado esquerdo quando não cabe, mantendo o direito', () => {
    const line = padLeftRight('Descrição muito longa', 'R$ 100,00', 16)
    expect(line.length).toBeLessThanOrEqual(16)
    expect(line.endsWith('R$ 100,00')).toBe(true)
  })

  it('centraliza texto', () => {
    expect(centerText('AB', 6)).toBe('  AB')
  })
})

describe('buildReceiptLines', () => {
  it.each([[80, RECEIPT_COLUMNS[80]], [58, RECEIPT_COLUMNS[58]]])(
    'nenhuma linha ultrapassa a largura de %i mm (%i colunas)',
    (_paper, columns) => {
      const lines = buildReceiptLines(sample, columns)
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(columns)
      }
    },
  )

  it('contém cabeçalho, itens, totais, pagamentos e rodapé', () => {
    const text = buildReceiptLines(sample, 48).join('\n')
    expect(text).toContain('Loja Exemplo')
    expect(text).toContain('Comprovante não fiscal')
    expect(text).toContain('Venda #42')
    expect(text).toContain('2 x R$ 5,50')
    expect(text).toContain('R$ 11,00')
    expect(text).toContain('Subtotal')
    expect(text).toContain('Desconto')
    expect(text).toContain('-R$ 1,56')
    expect(text).toContain('TOTAL')
    expect(text).toContain('R$ 1.244,00')
    expect(text).toContain('Dinheiro')
    expect(text).toContain('PIX')
    expect(text).toContain('Obrigado pela preferência!')
    expect(text).toContain('Não é documento fiscal')
  })

  it('omite linha de desconto quando é zero e de troco quando não há', () => {
    const lines = buildReceiptLines({ ...sample, discount: 0, change: undefined }, 48).join('\n')
    expect(lines).not.toContain('Desconto')
    expect(lines).not.toContain('Troco')
  })

  it('mostra troco quando maior que zero', () => {
    const text = buildReceiptLines({ ...sample, change: 3.5 }, 48).join('\n')
    expect(text).toContain('Troco')
    expect(text).toContain('R$ 3,50')
  })

  it('usa nome legível para método de pagamento desconhecido', () => {
    const text = buildReceiptLines({ ...sample, payments: [{ method: 'voucher', amount: 5 }] }, 48).join('\n')
    expect(text).toContain('voucher')
  })

  it('quebra nomes longos de item em mais de uma linha', () => {
    const lines = buildReceiptLines(sample, 32)
    expect(lines.some(l => l.startsWith('Pão de queijo'))).toBe(true)
    expect(lines.some(l => l.includes('recheio'))).toBe(true)
  })
})

describe('escapeHtml', () => {
  it('escapa caracteres especiais de HTML', () => {
    expect(escapeHtml('<b>"Tom & Jerry\'s"</b>')).toBe('&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;')
  })
})

describe('buildReceiptHtml', () => {
  it('usa @page com largura de 80mm por padrão', () => {
    const html = buildReceiptHtml(sample)
    expect(html).toContain('@page { size: 80mm auto; margin: 0; }')
    expect(html).toContain('width: 72mm')
  })

  it('usa largura de 58mm quando pedido', () => {
    const html = buildReceiptHtml(sample, 58)
    expect(html).toContain('@page { size: 58mm auto; margin: 0; }')
    expect(html).toContain('width: 48mm')
  })

  it('escapa o nome da loja no HTML', () => {
    const html = buildReceiptHtml({ ...sample, storeName: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('renderiza uma div por linha de cupom', () => {
    const lines = buildReceiptLines(sample, RECEIPT_COLUMNS[80])
    const html = buildReceiptHtml(sample, 80)
    const count = (html.match(/<div class="line">/g) ?? []).length
    expect(count).toBe(lines.length)
  })
})
