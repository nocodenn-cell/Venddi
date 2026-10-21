import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company } from '@/lib/schemas'
import { hasPermission } from '@/lib/schemas'
import { signIn, signUp, signOut } from '@/lib/services/auth'
import { supabase } from '@/lib/supabase'

interface AuthState {
  user: User | null
  company: Company | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (data: RegisterData) => Promise<void>
  switchCompany: (company: Company) => void
  checkPermission: (permission: string) => boolean
}

interface RegisterData {
  fullName: string
  email: string
  password: string
  companyName: string
  cnpj: string
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })

        // Autenticação real (Supabase) ou mock somente em dev, via services/auth
        const { user, company, error } = await signIn(email, password)

        if (error || !user) {
          set({ isLoading: false })
          throw new Error(error ?? 'Credenciais inválidas')
        }

        set({
          user,
          company: company ?? null,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      logout: async () => {
        // Só encerra a sessão local depois que o Supabase confirmar o logout
        const { error } = await signOut()
        if (error) throw new Error(error)

        set({
          user: null,
          company: null,
          isAuthenticated: false,
        })
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true })

        const { user, company, error } = await signUp(data)

        if (error || !user) {
          set({ isLoading: false })
          throw new Error(error ?? 'Erro ao criar conta')
        }

        set({
          user,
          company: company ?? null,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      switchCompany: (company: Company) => {
        set({ company })
      },

      checkPermission: (permission: string) => {
        const { user } = get()
        if (!user) return false
        return hasPermission(user.role, permission)
      },
    }),
    {
      name: 'venddi-auth',
      // Versão 2: descarta o estado persistido pelo mock antigo (email-only)
      version: 2,
      migrate: (persisted, version) =>
        version < 2
          ? ({ user: null, company: null, isAuthenticated: false } as AuthState)
          : (persisted as AuthState),
    }
  )
)

// Com Supabase configurado, a sessão local precisa acompanhar a sessão do Supabase.
// Dispara ao carregar (INITIAL_SESSION), quando a sessão expira ou é revogada,
// e quando o usuário sai em outra aba. Sem sessão, o estado local é descartado.
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      useAuthStore.setState({ user: null, company: null, isAuthenticated: false })
    }
  })
}

// Empresa da sessão atual, usada pelas camadas de API no lugar de IDs fixos
export function getCurrentCompanyId(): string {
  return useAuthStore.getState().company?.id ?? ''
}
