import { describe, it, expect } from 'vitest'
import { stockErrorMessage } from '@/lib/stockErrors'

describe('stockErrorMessage', () => {
  it('traduz a mensagem da trigger de saldo citando o produto', () => {
    const error = { message: 'Estoque insuficiente para o produto CAM-001' }
    expect(stockErrorMessage(error)).toBe(
      'Estoque insuficiente para o produto CAM-001. Ajuste a quantidade e tente novamente.'
    )
  })

  it('traduz a mensagem em inglês da RPC de venda para mensagem genérica', () => {
    const error = new Error('Insufficient stock for product: d1000000-0000-4000-8000-000000000004')
    expect(stockErrorMessage(error)).toBe(
      'Estoque insuficiente para um dos produtos. Ajuste a quantidade e tente novamente.'
    )
  })

  it('ignora erros que não são de estoque', () => {
    expect(stockErrorMessage({ message: 'Cash register is not open' })).toBeNull()
    expect(stockErrorMessage(null)).toBeNull()
    expect(stockErrorMessage(undefined)).toBeNull()
  })
})
