import { create } from 'zustand'
import type { User, Company } from '@/lib/schemas'
import { hasPermission } from '@/lib/schemas'
import { isSupabaseConfigured } from '@/lib/supabase'
import { signIn, signUp, signOut, getAuthenticatedContext } from '@/lib/services/auth'

interface RegisterData {
  fullName: string
  email: string
  password: string
  companyName: string
  cnpj: string
}

interface AuthState {
  user: User | null
  company: Company | null
  isAuthenticated: boolean
  isLoading: boolean
  isInitialized: boolean
  clearSession: () => void
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterData) => Promise<void>
  switchCompany: (company: Company) => void
  checkPermission: (permission: string) => boolean
}

const mockCompany: Company = {
  id: 'cmp_001',
  name: 'Loja Demo Venddi',
  tradeName: 'Loja Demo',
  cnpj: '12.345.678/0001-90',
  phone: '(11) 99999-9999',
  email: 'contato@lojademo.com.br',
  plan: 'starter',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}


const emptySession = { user: null, company: null, isAuthenticated: false }
let revision = 0

// The SDK owns session persistence. Persisted UI flags and roles are not trusted.
export const useAuthStore = create<AuthState>()((set, get) => ({
  ...emptySession,
  isLoading: false,
  isInitialized: false,

  clearSession: () => {
    ++revision
    set({ ...emptySession, isLoading: false, isInitialized: true })
  },

  initialize: async () => {
    const current = ++revision
    set({ isLoading: true })
    try {
      if (isSupabaseConfigured) {
        const context = await getAuthenticatedContext()
        if (current === revision) set({ ...context, isAuthenticated: true })
      } else if (current === revision) {
        set(emptySession)
      }
    } catch {
      if (current === revision) set(emptySession)
    } finally {
      if (current === revision) set({ isLoading: false, isInitialized: true })
    }
  },

  login: async (email, password) => {
    const current = ++revision
    set({ ...emptySession, isLoading: true })
    try {
      const result = await signIn(email.trim(), password)
      if (result.error || !result.user || !result.user.isActive) {
        throw new Error(result.error || 'Usuário sem acesso ativo')
      }
      if (current !== revision) throw new Error('Operação de login interrompida')
      if (isSupabaseConfigured && !result.company) {
        throw new Error('Não foi possível carregar a loja')
      }
      set({
        user: result.user,
        company: result.company ?? mockCompany,
        isAuthenticated: true,
      })
    } finally {
      if (current === revision) set({ isLoading: false, isInitialized: true })
    }
  },

  logout: async () => {
    const current = ++revision
    set({ ...emptySession, isLoading: true, isInitialized: true })
    try {
      await signOut()
    } finally {
      if (current === revision) set({ isLoading: false })
    }
  },

  register: async (data) => {
    const current = ++revision
    set({ ...emptySession, isLoading: true })
    try {
      const result = await signUp(data)
      if (current !== revision) throw new Error('Cadastro interrompido')
      if (result.error || !result.user || !result.user.isActive) {
        throw new Error(result.error || 'Não foi possível criar a conta')
      }
      if (isSupabaseConfigured) {
        const context = await getAuthenticatedContext()
        if (current !== revision) throw new Error('Cadastro interrompido')
        set({ ...context, isAuthenticated: true })
      } else {
        set({
          user: result.user,
          company: { ...mockCompany, id: result.user.companyId, name: data.companyName, cnpj: data.cnpj },
          isAuthenticated: true,
        })
      }
    } finally {
      if (current === revision) set({ isLoading: false, isInitialized: true })
    }
  },

  switchCompany: (company) => {
    // The current schema supports one company per user.
    if (!get().user || company.id !== get().user?.companyId) {
      throw new Error('Troca de loja não autorizada')
    }
    // Do not replace trusted company attributes with caller-provided data.
  },

  checkPermission: (permission) => {
    const { user, isAuthenticated } = get()
    return Boolean(isAuthenticated && user?.isActive && hasPermission(user.role, permission))
  },
}))
