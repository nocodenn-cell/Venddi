import { describe, it, expect, vi } from 'vitest'
import { createBarcodeParser, attachBarcodeKeyboardReader, BarcodeKeyEvent } from './barcodeKeyboardReader'

/** Gera eventos de uma rajada de leitor: uma tecla a cada `gap` ms, depois Enter. */
function burst(code: string, start = 0, gap = 5): BarcodeKeyEvent[] {
  const events: BarcodeKeyEvent[] = []
  let t = start
  for (const key of code) {
    events.push({ key, timestamp: t })
    t += gap
  }
  events.push({ key: 'Enter', timestamp: t })
  return events
}

function feed(parser: ReturnType<typeof createBarcodeParser>, events: BarcodeKeyEvent[]): Array<string | null> {
  return events.map(e => parser.push(e))
}

describe('createBarcodeParser', () => {
  it('emite o código quando a rajada termina com Enter', () => {
    const parser = createBarcodeParser()
    const results = feed(parser, burst('7891234567890'))
    expect(results.filter(r => r !== null)).toEqual(['7891234567890'])
    expect(results[results.length - 1]).toBe('7891234567890')
  })

  it('não emite nada enquanto caracteres chegam, só no Enter', () => {
    const parser = createBarcodeParser()
    const results = feed(parser, burst('ABC123'))
    expect(results.slice(0, -1).every(r => r === null)).toBe(true)
  })

  it('aceita leituras consecutivas independentes', () => {
    const parser = createBarcodeParser()
    const first = feed(parser, burst('ABC', 0))
    const second = feed(parser, burst('XYZ99', 1000))
    expect(first[first.length - 1]).toBe('ABC')
    expect(second[second.length - 1]).toBe('XYZ99')
  })

  it('descarta digitação humana lenta (intervalo acima do limite)', () => {
    const parser = createBarcodeParser({ maxInterKeyMs: 50 })
    // 6 teclas com 300 ms entre elas, depois Enter
    const results = feed(parser, burst('123456', 0, 300))
    expect(results.every(r => r === null)).toBe(true)
  })

  it('não emite código curto demais (minLength padrão 3)', () => {
    const parser = createBarcodeParser()
    const results = feed(parser, burst('12'))
    expect(results.every(r => r === null)).toBe(true)
  })

  it('aceita código com exatamente minLength caracteres', () => {
    const parser = createBarcodeParser({ minLength: 3 })
    const results = feed(parser, burst('123'))
    expect(results[results.length - 1]).toBe('123')
  })

  it('descarta rajada acima de maxLength', () => {
    const parser = createBarcodeParser({ maxLength: 5 })
    const results = feed(parser, burst('123456789'))
    expect(results.every(r => r === null)).toBe(true)
  })

  it('aceita código com exatamente maxLength caracteres', () => {
    const parser = createBarcodeParser({ maxLength: 5 })
    const results = feed(parser, burst('12345'))
    expect(results[results.length - 1]).toBe('12345')
  })

  it('ignora teclas que não são caractere (Shift, Tab, setas)', () => {
    const parser = createBarcodeParser()
    const events: BarcodeKeyEvent[] = [
      { key: 'A', timestamp: 0 },
      { key: 'Shift', timestamp: 2 },
      { key: 'B', timestamp: 4 },
      { key: 'ArrowLeft', timestamp: 6 },
      { key: 'C', timestamp: 8 },
      { key: 'Enter', timestamp: 10 },
    ]
    const results = feed(parser, events)
    expect(results[results.length - 1]).toBe('ABC')
  })

  it('não inclui espaços no código', () => {
    const parser = createBarcodeParser()
    const events: BarcodeKeyEvent[] = [
      { key: 'A', timestamp: 0 },
      { key: ' ', timestamp: 2 },
      { key: 'B', timestamp: 4 },
      { key: 'C', timestamp: 6 },
      { key: 'Enter', timestamp: 8 },
    ]
    const results = feed(parser, events)
    expect(results[results.length - 1]).toBe('ABC')
  })

  it('Enter após pausa longa não fecha leitura', () => {
    const parser = createBarcodeParser({ maxInterKeyMs: 50 })
    const events: BarcodeKeyEvent[] = [
      { key: '1', timestamp: 0 },
      { key: '2', timestamp: 5 },
      { key: '3', timestamp: 10 },
      { key: 'Enter', timestamp: 2000 },
    ]
    expect(feed(parser, events).every(r => r === null)).toBe(true)
  })

  it('reset descarta o buffer em andamento', () => {
    const parser = createBarcodeParser()
    parser.push({ key: 'A', timestamp: 0 })
    parser.push({ key: 'B', timestamp: 5 })
    parser.reset()
    const results = feed(parser, burst('XYZ', 10))
    expect(results[results.length - 1]).toBe('XYZ')
  })

  it('Enter com buffer vazio não emite', () => {
    const parser = createBarcodeParser()
    expect(parser.push({ key: 'Enter', timestamp: 0 })).toBeNull()
  })
})

describe('attachBarcodeKeyboardReader', () => {
  /** Alvo mínimo com addEventListener/removeEventListener para testar sem DOM. */
  function fakeTarget() {
    const listeners = new Set<(e: Event) => void>()
    return {
      target: {
        addEventListener: (_type: string, fn: (e: Event) => void) => { listeners.add(fn) },
        removeEventListener: (_type: string, fn: (e: Event) => void) => { listeners.delete(fn) },
      },
      dispatch(key: string, extra: Partial<KeyboardEvent> = {}) {
        const event = { key, ctrlKey: false, altKey: false, metaKey: false, ...extra } as KeyboardEvent
        listeners.forEach(fn => fn(event as unknown as Event))
      },
      count: () => listeners.size,
    }
  }

  it('emite o código lido via keydown e para de escutar ao chamar o cancelamento', () => {
    const { target, dispatch, count } = fakeTarget()
    const onScan = vi.fn()
    const stop = attachBarcodeKeyboardReader({ onScan, target })

    expect(count()).toBe(1)
    const now = Date.now()
    vi.useFakeTimers()
    vi.setSystemTime(now)
    try {
      for (const ch of '7891') {
        dispatch(ch)
        vi.advanceTimersByTime(5)
      }
      dispatch('Enter')
    } finally {
      vi.useRealTimers()
    }

    expect(onScan).toHaveBeenCalledTimes(1)
    expect(onScan.mock.calls[0][0]).toBe('7891')

    stop()
    expect(count()).toBe(0)
  })

  it('ignora teclas com Ctrl/Alt/Meta', () => {
    const { target, dispatch } = fakeTarget()
    const onScan = vi.fn()
    attachBarcodeKeyboardReader({ onScan, target })

    vi.useFakeTimers()
    try {
      for (const ch of 'ABC') {
        dispatch(ch, { ctrlKey: true })
        vi.advanceTimersByTime(5)
      }
      dispatch('Enter')
    } finally {
      vi.useRealTimers()
    }

    expect(onScan).not.toHaveBeenCalled()
  })
})
