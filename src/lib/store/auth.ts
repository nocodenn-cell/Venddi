import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company, UserRole } from '@/lib/schemas'
import { hasPermission } from '@/lib/schemas'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

interface AuthState {
  user: User | null
  company: Company | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (data: RegisterData) => Promise<RegisterResult>
  switchCompany: (company: Company) => void
  checkPermission: (permission: string) => boolean
}

/**
 * Resultado do cadastro.
 * - 'demo': modo demonstração (sem Supabase), entra direto como antes.
 * - 'pending_approval': conta e empresa criadas no servidor; a equipe libera a avaliação.
 * - 'confirm_email': o Supabase exige confirmação de e-mail; a empresa é criada pelo
 *   gatilho do banco e a liberação segue o mesmo fluxo.
 */
export type RegisterResult = { status: 'demo' | 'pending_approval' | 'confirm_email' }

interface RegisterData {
  fullName: string
  email: string
  password: string
  companyName: string
  cnpj: string
}

// Mock data for development
const mockUser: User = {
  id: 'usr_001',
  companyId: 'cmp_001',
  email: 'admin@venddi.com',
  fullName: 'Administrador Venddi',
  role: 'owner' as UserRole,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      company: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, _password: string) => {
        set({ isLoading: true })
        
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Mock authentication
        if (email === 'admin@venddi.com') {
          set({
            user: mockUser,
            company: mockCompany,
            isAuthenticated: true,
            isLoading: false,
          })
        } else {
          set({ isLoading: false })
          throw new Error('Credenciais inválidas')
        }
      },

      logout: () => {
        set({
          user: null,
          company: null,
          isAuthenticated: false,
        })
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true })

        if (isSupabaseConfigured && supabase) {
          // Cadastro real: a empresa, o vínculo (owner) e a assinatura "pending" são
          // criados no servidor (gatilho em auth.users + RPC idempotente bootstrap_my_company).
          // O navegador nunca escolhe company_id nem papel.
          try {
            const { data: signUp, error } = await supabase.auth.signUp({
              email: data.email,
              password: data.password,
              options: {
                data: {
                  full_name: data.fullName,
                  company_name: data.companyName,
                  cnpj: data.cnpj,
                },
              },
            })
            if (error) throw error

            if (!signUp.session) {
              return { status: 'confirm_email' }
            }

            const { error: bootstrapError } = await supabase.rpc('bootstrap_my_company', {
              p_full_name: data.fullName,
              p_company_name: data.companyName,
              p_cnpj: data.cnpj,
            })
            if (bootstrapError) throw bootstrapError

            return { status: 'pending_approval' }
          } catch (err) {
            throw new Error(err instanceof Error && err.message ? err.message : 'Erro ao criar conta')
          } finally {
            set({ isLoading: false })
          }
        }

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const newUser: User = {
          id: `usr_${Date.now()}`,
          companyId: `cmp_${Date.now()}`,
          email: data.email,
          fullName: data.fullName,
          role: 'owner',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        const newCompany: Company = {
          id: newUser.companyId,
          name: data.companyName,
          cnpj: data.cnpj,
          plan: 'starter',
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set({
          user: newUser,
          company: newCompany,
          isAuthenticated: true,
          isLoading: false,
        })
        return { status: 'demo' }
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

