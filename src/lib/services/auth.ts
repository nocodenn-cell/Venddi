import { supabase, getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { User, Company } from '@/lib/schemas'

export interface SignUpData {
  email: string
  password: string
  fullName: string
  companyName: string
  cnpj: string
}

export interface AuthResponse {
  user: User | null
  company?: Company | null
  error: string | null
}

// Mock users for development (when Supabase is not configured).
// Only defined in dev builds: in production the object is empty, so the demo
// credentials are not shipped in the bundle.
const mockUsers: Record<string, { user: User; company: Company; password: string }> = import.meta.env.DEV ? {
  'admin@venddi.com': {
    user: {
      id: 'usr_001',
      companyId: 'cmp_001',
      email: 'admin@venddi.com',
      fullName: 'Administrador Venddi',
      role: 'owner',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    company: {
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
    },
    password: 'admin123',
  },
} : {}

// Converte a linha `companies` do Supabase (snake_case) para o schema do app
function toCompany(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    tradeName: row.trade_name ?? undefined,
    cnpj: row.cnpj,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    plan: row.plan,
    isActive: row.status === 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Sign up a new user and create a company
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  if (!isSupabaseConfigured || !supabase) {
    if (import.meta.env.PROD) {
      return { user: null, error: 'Sistema indisponível. Contate o suporte.' }
    }

    // Mock mode (somente dev)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    
    if (mockUsers[data.email]) {
      return { user: null, error: 'Email já cadastrado' }
    }
    
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

    mockUsers[data.email] = { user: newUser, company: newCompany, password: data.password }
    return { user: newUser, company: newCompany, error: null }
  }
  
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao criar usuário')

    // Empresa, usuário owner e trial são criados atomicamente no banco (migration 012)
    const { data: tenant, error: tenantError } = await supabase.rpc('register_tenant', {
      p_company_name: data.companyName,
      p_cnpj: data.cnpj,
      p_full_name: data.fullName,
      p_plan: 'starter',
    })

    if (tenantError) throw tenantError

    const userData = tenant.user

    const user: User = {
      id: userData.id,
      companyId: userData.company_id,
      email: userData.email,
      fullName: userData.full_name,
      role: userData.role,
      isActive: userData.is_active,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    }

    return { user, company: toCompany(tenant.company), error: null }
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Erro ao criar conta',
    }
  }
}

/**
 * Sign in an existing user
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  // CRITICAL: Never fall back to mock mode after authentication failure
  // Mock mode is ONLY for development when Supabase is not configured
  if (!isSupabaseConfigured || !supabase) {
    // Development/demo mode only
    if (import.meta.env.PROD) {
      console.error('🚨 CRITICAL: Authentication attempted in production without Supabase')
      return { user: null, error: 'Sistema indisponível. Contate o suporte.' }
    }
    
    // Mock mode for development
    await new Promise((resolve) => setTimeout(resolve, 800))
    
    const mockUser = mockUsers[email]
    if (!mockUser || mockUser.password !== password) {
      return { user: null, error: 'Credenciais inválidas' }
    }
    
    return { user: mockUser.user, company: mockUser.company, error: null }
  }
  
  try {
    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao autenticar')
    
    // Get user record from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        *,
        companies (*)
      `)
      .eq('auth_id', authData.user.id)
      .single()
    
    if (userError) throw userError
    if (!userData) throw new Error('Usuário não encontrado')

    // Usuário desativado ou empresa suspensa/cancelada não pode entrar
    if (!userData.is_active || userData.companies?.status !== 'active') {
      await supabase.auth.signOut()
      throw new Error('Acesso bloqueado. Contate o administrador da sua empresa.')
    }

    const user: User = {
      id: userData.id,
      companyId: userData.company_id,
      email: userData.email,
      fullName: userData.full_name,
      role: userData.role,
      isActive: userData.is_active,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    }
    
    return { user, company: toCompany(userData.companies), error: null }
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Erro ao fazer login',
    }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))
    return { error: null }
  }
  
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Erro ao fazer logout',
    }
  }
}

/**
 * Request password reset
 */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { error: null }
  }
  
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    
    if (error) throw error
    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Erro ao solicitar recuperação de senha',
    }
  }
}

/**
 * Get current session
 */
export async function getSession() {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }
  
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Get current user from Supabase Auth
 */
export async function getCurrentAuthUser() {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }
  
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
