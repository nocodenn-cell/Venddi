import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { isFeatureEnabled } from '@/lib/featureFlags'

/**
 * Direitos da empresa do usuário logado, calculados no servidor
 * (RPC get_company_entitlements, migration 012). A interface só reflete isto.
 */
export interface ServerEntitlements {
  authenticated: boolean
  hasCompany: boolean
  companyId?: string
  userId?: string
  role?: string
  subscriptionStatus?: 'pending' | 'trial' | 'active' | 'expired' | 'suspended' | 'canceled' | 'legacy'
  trialEndDate?: string | null
  canOperate: boolean
  fiscalEnabled: boolean
  autoTrial: boolean
  reason?: string | null
  source: 'server' | 'demo'
}

export function mapEntitlements(raw: Record<string, unknown> | null | undefined): ServerEntitlements {
  const r = raw ?? {}
  return {
    authenticated: r.authenticated === true,
    hasCompany: r.has_company === true,
    companyId: (r.company_id as string) ?? undefined,
    userId: (r.user_id as string) ?? undefined,
    role: (r.role as string) ?? undefined,
    subscriptionStatus: (r.subscription_status as ServerEntitlements['subscriptionStatus']) ?? undefined,
    trialEndDate: (r.trial_end_date as string | null) ?? null,
    // Falha fechada: qualquer valor que não seja true bloqueia.
    canOperate: r.can_operate === true,
    fiscalEnabled: r.fiscal_enabled === true,
    autoTrial: r.auto_trial === true,
    reason: (r.reason as string | null) ?? null,
    source: 'server',
  }
}

export async function getServerEntitlements(): Promise<ServerEntitlements> {
  if (!isSupabaseConfigured || !supabase) {
    // Modo demonstração: espelha as flags locais (sem valor de segurança).
    return {
      authenticated: true,
      hasCompany: true,
      canOperate: true,
      fiscalEnabled: isFeatureEnabled('FISCAL_ENABLED'),
      autoTrial: isFeatureEnabled('TRIAL_15_DAYS'),
      source: 'demo',
    }
  }
  const { data, error } = await supabase.rpc('get_company_entitlements')
  if (error) {
    return { ...mapEntitlements(null), reason: 'entitlements_unavailable' }
  }
  return mapEntitlements(data as Record<string, unknown>)
}
