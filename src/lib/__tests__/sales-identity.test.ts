import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ context: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: mocks.rpc, from: mocks.from },
}))
vi.mock('@/lib/services/auth', () => ({ getAuthenticatedContext: mocks.context }))
import { createSale, cancelSale } from '@/lib/api/sales'

const companyId = '22222222-2222-4222-8222-222222222222'
const operatorId = '11111111-1111-4111-8111-111111111111'
const params = {
  idempotencyKey: '33333333-3333-4333-8333-333333333333',
  operatorId: 'forged-operator', operatorName: 'Untrusted',
  cashRegisterId: '44444444-4444-4444-8444-444444444444',
  items: [{ productId: '55555555-5555-4555-8555-555555555555',
    productName: 'Produto', quantity: 1, unitPrice: 10, discount: 0, subtotal: 10 }],
  payments: [{ method: 'cash' as const, amount: 10, installments: 1, changeAmount: 0 }],
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.context.mockResolvedValue({
    user: { id: operatorId, role: 'owner' },
    company: { id: companyId },
  })
  // Stop after the RPC; assertions cover the outgoing identity, not database execution.
  mocks.rpc.mockResolvedValue({ error: new Error('test stop') })
})

describe('sale API identity', () => {
  it('uses verified identity instead of caller-supplied operator or demo IDs', async () => {
    await expect(createSale(params)).rejects.toThrow()
    expect(mocks.rpc).toHaveBeenCalledWith('create_atomic_sale', expect.objectContaining({
      p_company_id: companyId, p_operator_id: operatorId,
    }))
  })

  it('uses verified identity for cancellation', async () => {
    await expect(cancelSale('sale-id', 'Motivo')).rejects.toThrow()
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_sale_with_reversal', expect.objectContaining({
      p_company_id: companyId, p_operator_id: operatorId,
    }))
  })

  it('does not call the RPC with an invalid session', async () => {
    mocks.context.mockRejectedValue(new Error('Sessão inválida'))
    await expect(createSale(params)).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('does not allow cashier cancellation', async () => {
    mocks.context.mockResolvedValue({
      user: { id: operatorId, role: 'cashier' }, company: { id: companyId },
    })
    await expect(cancelSale('sale-id', 'Motivo')).rejects.toThrow()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
