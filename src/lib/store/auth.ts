import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company } from '@/lib/schemas'
import { hasPermission } from '@/lib/schemas'
import { signIn, signUp, signOut } from '@/lib/services/auth'

interface AuthState {
  user: User | null
  company: Company | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
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

      logout: () => {
        void signOut()
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
    }
  )
)
