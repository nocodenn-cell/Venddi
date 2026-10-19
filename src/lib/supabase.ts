import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// Create Supabase client (or null if not configured)
let supabaseInstance: SupabaseClient | null = null

if (isSupabaseConfigured) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

// Export client (may be null in development without Supabase)
export const supabase = supabaseInstance

// Helper to check if Supabase is available
export function getSupabase(): SupabaseClient | null {
  return supabase
}

// Type-safe database types (generated from Supabase schema)
export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          trade_name: string | null
          cnpj: string
          state_registration: string | null
          municipal_registration: string | null
          phone: string | null
          email: string | null
          plan: 'starter' | 'professional' | 'enterprise'
          status: 'active' | 'suspended' | 'cancelled'
          address: Record<string, any> | null
          settings: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['companies']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['companies']['Insert']>
      }
      users: {
        Row: {
          id: string
          company_id: string
          auth_id: string | null
          email: string
          full_name: string
          role: 'owner' | 'admin' | 'manager' | 'cashier' | 'salesperson'
          avatar_url: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      products: {
        Row: {
          id: string
          company_id: string
          category_id: string | null
          sku: string
          barcode: string | null
          name: string
          description: string | null
          cost_price: number
          sell_price: number
          stock_quantity: number
          min_stock: number
          is_active: boolean
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
    }
  }
}
