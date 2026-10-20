import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  context: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }))
vi.mock('@/lib/services/auth', () => ({
  signIn: mocks.signIn,
  signUp: mocks.signUp,
  signOut: mocks.signOut,
  getAuthenticatedContext: mocks.context,
}))
import { useAuthStore } from '@/lib/store/auth'

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  companyId: '22222222-2222-4222-8222-222222222222',
  email: 'owner@example.com', fullName: 'Owner Test', role: 'owner' as const,
  isActive: true, createdAt: '2026-10-20T00:00:00Z', updatedAt: '2026-10-20T00:00:00Z',
}
const company = {
  id: user.companyId, name: 'Loja real', cnpj: '12.345.678/0001-90',
  plan: 'starter' as const, isActive: true,
  createdAt: user.createdAt, updatedAt: user.updatedAt,
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.getState().clearSession()
  mocks.signOut.mockResolvedValue({ error: null })
})

describe('operational authentication', () => {
  it('passes the password to the real service and does not admit a failed demo login', async () => {
    mocks.signIn.mockResolvedValue({ user: null, error: 'Credenciais inválidas' })
    await expect(useAuthStore.getState().login('admin@venddi.com', 'wrong-password'))
      .rejects.toThrow('Credenciais inválidas')
    expect(mocks.signIn).toHaveBeenCalledWith('admin@venddi.com', 'wrong-password')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('uses the company returned by the authentication service', async () => {
    mocks.signIn.mockResolvedValue({ user, company, error: null })
    await useAuthStore.getState().login('owner@example.com', 'password')
    expect(useAuthStore.getState().company?.id).toBe(company.id)
    expect(useAuthStore.getState().user?.id).toBe(user.id)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('rejects incomplete real login rather than using the demo company', async () => {
    mocks.signIn.mockResolvedValue({ user, error: null })
    await expect(useAuthStore.getState().login(user.email, 'password')).rejects.toThrow()
    expect(useAuthStore.getState().company).toBeNull()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('restores only a verified context', async () => {
    mocks.context.mockResolvedValue({ user, company })
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    mocks.context.mockRejectedValue(new Error('Sessão expirada'))
    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().company).toBeNull()
  })

  it('does not restore an old context after logout', async () => {
    let resolveContext!: (value: { user: typeof user; company: typeof company }) => void
    mocks.context.mockReturnValue(new Promise(resolve => { resolveContext = resolve }))
    const restoring = useAuthStore.getState().initialize()
    await useAuthStore.getState().logout()
    resolveContext({ user, company })
    await restoring
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('denies changing to a different company and ignores caller-supplied company attributes', async () => {
    mocks.signIn.mockResolvedValue({ user, company, error: null })
    await useAuthStore.getState().login(user.email, 'password')
    expect(() => useAuthStore.getState().switchCompany({ ...company, id: 'other' })).toThrow()
    useAuthStore.getState().switchCompany({ ...company, name: 'Forged' })
    expect(useAuthStore.getState().company?.name).toBe('Loja real')
  })

  it('does not create a fake authenticated account on registration failure', async () => {
    mocks.signUp.mockResolvedValue({ user: null, error: 'Cadastro indisponível' })
    await expect(useAuthStore.getState().register({
      fullName: user.fullName, email: user.email, password: 'password',
      companyName: company.name, cnpj: company.cnpj,
    })).rejects.toThrow('Cadastro indisponível')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('does not grant permissions to an inactive profile', () => {
    useAuthStore.setState({ user: { ...user, isActive: false }, isAuthenticated: true })
    expect(useAuthStore.getState().checkPermission('sales.cancel')).toBe(false)
  })
})
