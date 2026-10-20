import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Company, UserRole } from '@/lib/schemas'
import { hasPermission } from '@/lib/schemas'
import { createTrialSubscription } from '@/lib/api/subscription'

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
        
        try {
          // Simulate API call for user and company creation
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

          // Create trial subscription automatically
          try {
            await createTrialSubscription({
              companyId: newCompany.id,
              plan: 'starter',
            })
          } catch (subscriptionError) {
            console.error('Error creating trial subscription:', subscriptionError)
            // Continue even if subscription creation fails (will be created later)
          }

          set({
            user: newUser,
            company: newCompany,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
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
