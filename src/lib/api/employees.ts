import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentCompanyId } from '@/lib/store/auth'

export interface Employee {
  id: string
  fullName: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'cashier' | 'salesperson'
  isActive: boolean
  commissionPercent: number
}

export interface CommissionRow {
  userId: string
  fullName: string
  role: Employee['role']
  commissionPercent: number
  salesCount: number
  salesTotal: number
  commissionValue: number
}

/**
 * Lista os funcionários da empresa (RLS limita à empresa do usuário).
 */
export async function listEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, commission_percent')
    .eq('company_id', getCurrentCompanyId())
    .order('full_name')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    commissionPercent: Number(row.commission_percent),
  }))
}

/**
 * Define a comissão (%) de um funcionário. Só owner e admin (RPC set_commission_percent).
 */
export async function setCommissionPercent(userId: string, percent: number): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Alteração de comissão requer Supabase configurado')
  }

  const { error } = await supabase.rpc('set_commission_percent', {
    p_user_id: userId,
    p_percent: percent,
  })

  if (error) throw new Error(error.message)
}

/**
 * Relatório de comissão por funcionário no período (RPC relatorio_comissoes).
 * Owner, admin e manager.
 */
export async function getCommissionReport(start: Date, end: Date): Promise<CommissionRow[]> {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  const { data, error } = await supabase.rpc('relatorio_comissoes', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    fullName: row.full_name,
    role: row.role,
    commissionPercent: Number(row.commission_percent),
    salesCount: Number(row.sales_count),
    salesTotal: Number(row.sales_total),
    commissionValue: Number(row.commission_value),
  }))
}

/**
 * Convida um funcionário por e-mail (Edge Function invite-employee).
 * Só owner e admin. Cria o registro e envia o link para definir a senha.
 */
export async function inviteEmployee(input: {
  email: string
  fullName: string
  role: 'admin' | 'manager' | 'cashier' | 'salesperson'
  commissionPercent: number
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Convite requer Supabase configurado')
  }

  const { data, error } = await supabase.functions.invoke('invite-employee', { body: input })

  if (error) {
    // Erros HTTP da função vêm com o corpo JSON em error.context
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(body?.error ?? error.message)
  }
  if (data?.error) throw new Error(data.error)
}
