import { supabase, getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import type { User } from '@/lib/schemas'

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
}

// Mock users for development (when Supabase is not configured)
const mockUsers: Record<string, { user: User; password: string }> = {
  'admin@blum.com': {
    user: {
      id: 'usr_001',
      companyId: 'cmp_001',
      email: 'admin@blum.com',
      fullName: 'Administrador Blum',
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
  
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error('Erro ao criar usuário')
    
    // Create company
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .insert({
        name: data.companyName,
        cnpj: data.cnpj,
        plan: 'starter',
        status: 'active',
      })
      .select()
      .single()
    
    if (companyError) throw companyError
    
    // Create user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        company_id: companyData.id,
        auth_id: authData.user.id,
        email: data.email,
        full_name: data.fullName,
        role: 'owner',
        is_active: true,
      })
      .select()
      .single()
    
    if (userError) throw userError
    
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
    
    return { user, error: null }
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
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
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
    
    return { user, error: null }
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
