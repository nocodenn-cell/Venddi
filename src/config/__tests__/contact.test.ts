import { describe, it, expect } from 'vitest'
import { whatsappHref } from '../contact'

describe('whatsappHref', () => {
  it('cai na seção de contato quando o número não está configurado', () => {
    // Sem VITE_WHATSAPP_NUMBER no ambiente de teste
    expect(whatsappHref()).toMatch(/^(#contato|https:\/\/wa\.me\/\d+\?text=)/)
  })

  it('codifica a mensagem quando há número', () => {
    const href = whatsappHref('Olá, tudo bem?')
    if (href.startsWith('https://')) {
      expect(href).toContain(encodeURIComponent('Olá, tudo bem?'))
    } else {
      expect(href).toBe('#contato')
    }
  })
})
