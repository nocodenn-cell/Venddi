import { describe, it, expect, vi, beforeEach } from 'vitest'

const rpc = vi.fn()
const single = vi.fn()
const signUp = vi.fn()

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({ select: () => ({ eq: () => ({ single: () => single() }) }) }),
    auth: { signUp: (...args: unknown[]) => signUp(...args) },
  },
}))

import { createSale, cancelSale } from '@/lib/api/sales'
import { mapEntitlements } from '@/lib/api/entitlements'
import { FEATURE_FLAGS } from '@/lib/featureFlags'
import { useAuthStore } from '@/lib/store/auth'

beforeEach(() => {
  rpc.mockReset()
  single.mockReset()
  signUp.mockReset()
})

describe('venda: empresa e operador vêm do servidor', () => {
  it('create_atomic_sale não recebe p_company_id nem p_operator_id', async () => {
    rpc.mockResolvedValue({ data: { success: true, sale_id: 's1' }, error: null })
    single.mockResolvedValue({
      data: { id: 's1', company_id: 'c1', sale_number: 1, sale_items: [], payments: [], subtotal: 10, total: 10 },
      error: null,
    })
    await createSale({
      idempotencyKey: 'k1',
      items: [{ productId: 'p1', productName: 'Arroz', quantity: 1, unitPrice: 10, discount: 0, subtotal: 10 } as never],
      payments: [{ method: 'pix', amount: 10, installments: 1 } as never],
      operatorId: 'qualquer',
      operatorName: 'Op',
    })
    const [name, args] = rpc.mock.calls[0]
    expect(name).toBe('create_atomic_sale')
    expect(args).not.toHaveProperty('p_company_id')
    expect(args).not.toHaveProperty('p_operator_id')
    expect(JSON.stringify(args)).not.toContain('cmp_001')
  })

  it('cancel_sale_with_reversal não recebe ids fictícios', async () => {
    rpc.mockResolvedValue({ data: { success: true }, error: null })
    single.mockResolvedValue({ data: { id: 's1', sale_items: [], payments: [] }, error: null })
    try { await cancelSale('s1', 'motivo') } catch { /* leitura posterior não importa aqui */ }
    const call = rpc.mock.calls.find((c) => c[0] === 'cancel_sale_with_reversal')
    expect(call).toBeTruthy()
    expect(call![1]).not.toHaveProperty('p_company_id')
    expect(call![1]).not.toHaveProperty('p_operator_id')
    expect(JSON.stringify(call![1])).not.toMatch(/cmp_001|usr_001/)
  })
})

describe('direitos calculados no servidor', () => {
  it('falha fechada quando a resposta não diz can_operate=true', () => {
    expect(mapEntitlements(null).canOperate).toBe(false)
    expect(mapEntitlements({ can_operate: 'true' }).canOperate).toBe(false)
    expect(mapEntitlements({ can_operate: true, fiscal_enabled: false }).canOperate).toBe(true)
  })

  it('flags locais alinhadas à direção comercial', () => {
    expect(FEATURE_FLAGS.FISCAL_ENABLED.enabled).toBe(false)
    expect(FEATURE_FLAGS.TRIAL_15_DAYS.enabled).toBe(false)
  })
})

describe('cadastro real cria empresa no servidor', () => {
  it('envia dados da loja como metadados e chama bootstrap_my_company', async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: 'x' }, user: { id: 'u1' } }, error: null })
    rpc.mockResolvedValue({ data: { success: true, company_id: 'c1' }, error: null })
    const res = await useAuthStore.getState().register({
      fullName: 'Dono Teste', email: 'dono@teste.local', password: 'segredo1',
      companyName: 'Loja Teste', cnpj: '11.111.111/0001-11',
    })
    expect(res.status).toBe('pending_approval')
    expect(signUp.mock.calls[0][0].options.data).toEqual({
      full_name: 'Dono Teste', company_name: 'Loja Teste', cnpj: '11.111.111/0001-11',
    })
    expect(rpc).toHaveBeenCalledWith('bootstrap_my_company', {
      p_full_name: 'Dono Teste', p_company_name: 'Loja Teste', p_cnpj: '11.111.111/0001-11',
    })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('com confirmação de e-mail não chama a RPC (o gatilho do banco cria a empresa)', async () => {
    signUp.mockResolvedValue({ data: { session: null, user: { id: 'u2' } }, error: null })
    const res = await useAuthStore.getState().register({
      fullName: 'Dono Dois', email: 'd2@teste.local', password: 'segredo1',
      companyName: 'Loja Dois', cnpj: '22.222.222/0001-22',
    })
    expect(res.status).toBe('confirm_email')
    expect(rpc).not.toHaveBeenCalled()
  })
})
