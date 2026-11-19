/**
 * Leitor de código de barras em modo teclado (HID).
 *
 * A maioria dos leitores USB/Bluetooth se comporta como teclado: envia os
 * caracteres do código em rajada (poucos ms entre teclas) e termina com Enter.
 * Digitação humana é lenta, então o intervalo entre teclas separa leitura de digitação.
 *
 * - createBarcodeParser: máquina de estados pura, testável com timestamps explícitos.
 * - attachBarcodeKeyboardReader: liga o parser a um documento (keydown). Não
 *   chama preventDefault, então o texto continua indo para o campo focado.
 *
 * Não integrado ao PDV nesta versão.
 */

export interface BarcodeKeyEvent {
  /** Valor de KeyboardEvent.key */
  key: string
  /** Momento da tecla em ms (ex.: Date.now() ou event.timeStamp) */
  timestamp: number
}

export interface BarcodeParserOptions {
  /** Intervalo máximo entre teclas dentro de uma mesma leitura. Padrão: 50 ms. */
  maxInterKeyMs?: number
  /** Tamanho mínimo do código. Padrão: 3. */
  minLength?: number
  /** Tamanho máximo do código; acima disso a rajada é descartada. Padrão: 64. */
  maxLength?: number
}

export interface BarcodeParser {
  /** Processa uma tecla. Retorna o código lido quando a rajada termina com Enter, senão null. */
  push(event: BarcodeKeyEvent): string | null
  /** Descarta o buffer em andamento. */
  reset(): void
}

const DEFAULTS: Required<BarcodeParserOptions> = {
  maxInterKeyMs: 50,
  minLength: 3,
  maxLength: 64,
}

/** Caractere imprimível sem espaço em branco (códigos não contêm espaços). */
function isBarcodeChar(key: string): boolean {
  return key.length === 1 && /\S/.test(key)
}

export function createBarcodeParser(options: BarcodeParserOptions = {}): BarcodeParser {
  const opts = { ...DEFAULTS, ...options }
  let buffer = ''
  let lastTimestamp: number | null = null
  // Rajada longa demais: ignora o resto até o Enter, para não emitir o final como código.
  let overflowed = false

  const reset = () => {
    buffer = ''
    lastTimestamp = null
    overflowed = false
  }

  const push = (event: BarcodeKeyEvent): string | null => {
    const { key, timestamp } = event

    if (key === 'Enter') {
      // Enter digitado muito depois da última tecla também não fecha uma leitura.
      const fast = lastTimestamp !== null && timestamp - lastTimestamp <= opts.maxInterKeyMs
      const code = buffer
      const valid = !overflowed && fast && code.length >= opts.minLength && code.length <= opts.maxLength
      reset()
      return valid ? code : null
    }

    if (!isBarcodeChar(key)) {
      // Shift, Tab, setas etc. não fazem parte do código, mas não interrompem a rajada.
      return null
    }

    // Intervalo grande demais: a tecla anterior não pertence a esta leitura (digitação humana).
    if (lastTimestamp !== null && timestamp - lastTimestamp > opts.maxInterKeyMs) {
      buffer = ''
      overflowed = false
    }

    lastTimestamp = timestamp
    if (overflowed) return null

    buffer += key
    if (buffer.length > opts.maxLength) {
      buffer = ''
      overflowed = true
    }
    return null
  }

  return { push, reset }
}

export interface BarcodeKeyboardReaderOptions extends BarcodeParserOptions {
  /** Chamado com cada código lido. */
  onScan: (barcode: string, event: KeyboardEvent) => void
  /** Documento onde escutar. Padrão: document global. */
  target?: Pick<Document, 'addEventListener' | 'removeEventListener'>
}

/**
 * Escuta keydown no documento e emite cada código lido.
 * Ignora teclas com Ctrl/Alt/Meta (atalhos). Retorna função para parar a escuta.
 */
export function attachBarcodeKeyboardReader(options: BarcodeKeyboardReaderOptions): () => void {
  const target = options.target ?? (typeof document !== 'undefined' ? document : undefined)
  if (!target) return () => {}

  const parser = createBarcodeParser(options)

  const handleKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent
    if (keyboardEvent.ctrlKey || keyboardEvent.altKey || keyboardEvent.metaKey) {
      parser.reset()
      return
    }
    const code = parser.push({ key: keyboardEvent.key, timestamp: Date.now() })
    if (code !== null) {
      options.onScan(code, keyboardEvent)
    }
  }

  target.addEventListener('keydown', handleKeyDown)
  return () => {
    target.removeEventListener('keydown', handleKeyDown)
    parser.reset()
  }
}
