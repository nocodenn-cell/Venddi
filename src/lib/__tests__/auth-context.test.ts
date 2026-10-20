import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), signUp: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getUser: mocks.getUser, signUp: mocks.signUp }, from: mocks.from },
}))
import { getAuthenticatedContext, signUp } from '@/lib/services/auth'

const profile = {
  id: '11111111-1111-4111-8111-111111111111',
  company_id: '22222222-2222-4222-8222-222222222222',
  email: 'owner@example.com', full_name: 'Owner Test', role: 'owner', is_active: true,
  created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z',
}
function query(data: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), single: vi.fn() }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.single.mockResolvedValue({ data, error: null })
  return chain
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null })
})
describe('verified operational context', () => {
  it('rejects an invalid Auth session before reading operational data', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Expired') })
    await expect(getAuthenticatedContext()).rejects.toThrow('Sessão inválida')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('rejects inactive profiles', async () => {
    mocks.from.mockReturnValue(query({ ...profile, is_active: false }))
    await expect(getAuthenticatedContext()).rejects.toThrow('Usuário sem acesso ativo')
    expect(mocks.from).toHaveBeenCalledTimes(1)
  })
  it('rejects suspended companies', async () => {
    mocks.from.mockReturnValueOnce(query(profile)).mockReturnValueOnce(query({
      id: profile.company_id, status: 'suspended',
    }))
    await expect(getAuthenticatedContext()).rejects.toThrow('Loja indisponível')
  })
  it('uses auth_id for the profile and the stored company_id for the company', async () => {
    const profileQuery = query(profile)
    const companyQuery = query({
      id: profile.company_id, name: 'Loja real', cnpj: '12.345.678/0001-90',
      plan: 'starter', status: 'active', created_at: profile.created_at, updated_at: profile.updated_at,
    })
    mocks.from.mockReturnValueOnce(profileQuery).mockReturnValueOnce(companyQuery)
    const context = await getAuthenticatedContext()
    expect(profileQuery.eq).toHaveBeenCalledWith('auth_id', 'auth-id')
    expect(companyQuery.eq).toHaveBeenCalledWith('id', profile.company_id)
    expect(context.user.id).toBe(profile.id)
    expect(context.company.id).toBe(profile.company_id)
  })
  it('does not create orphan Auth accounts while backend onboarding is unavailable', async () => {
    const result = await signUp({
      email: profile.email, password: 'password', fullName: profile.full_name,
      companyName: 'Loja real', cnpj: '12.345.678/0001-90',
    })
    expect(result.user).toBeNull()
    expect(result.error).toContain('cadastro de novas lojas')
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
