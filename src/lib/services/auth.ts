import { supabase, isSupabaseConfigured } from '@/lib/supabase'
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
  error: string | null
  company?: Company
}

// Mock users for development (when Supabase is not configured)
const mockUsers: Record<string, { user: User; password: string }> = {
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
    password: 'admin123',
  },
}

/**
 * Sign up a new user and create a company
 */
export async function signUp(data: SignUpData): Promise<AuthResponse> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
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
    
    mockUsers[data.email] = { user: newUser, password: data.password }
    return { user: newUser, error: null }
  }
  
  // Company provisioning needs an authenticated, atomic backend operation.
  // Direct client inserts are blocked by the current RLS bootstrap policies.
  return {
    user: null,
    error: 'O cadastro de novas lojas ainda não está disponível. Entre em contato para ativar sua loja.',
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
    
    return { user: mockUser.user, error: null }
  }
  
  try {
    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao autenticar')
    
    const context = await getAuthenticatedContext()
    return { ...context, error: null }
  } catch (error) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
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


/** Resolve operational identity from Auth and the database, never from localStorage.
 * Backend RPCs must independently enforce the same identity and permissions.
 */
export async function getAuthenticatedContext(): Promise<{ user: User; company: Company }> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Autenticação real indisponível')
  }
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) throw new Error('Sessão inválida. Entre novamente.')

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, company_id, email, full_name, role, is_active, created_at, updated_at')
    .eq('auth_id', authData.user.id)
    .single()
  if (profileError || !profile || !profile.is_active) {
    throw new Error('Usuário sem acesso ativo à loja')
  }
  const roles = ['owner', 'admin', 'manager', 'cashier', 'salesperson']
  if (!roles.includes(profile.role)) throw new Error('Perfil de acesso inválido')

  const { data: row, error: companyError } = await supabase
    .from('companies')
    .select('id, name, trade_name, cnpj, plan, status, created_at, updated_at')
    .eq('id', profile.company_id)
    .single()
  if (companyError || !row || row.status !== 'active') {
    throw new Error('Loja indisponível ou suspensa')
  }
  return {
    user: {
      id: profile.id,
      companyId: profile.company_id,
      email: profile.email,
      fullName: profile.full_name,
      role: profile.role,
      isActive: true,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    },
    company: {
      id: row.id,
      name: row.name,
      tradeName: row.trade_name ?? undefined,
      cnpj: row.cnpj,
      plan: row.plan,
      isActive: true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  }
}
