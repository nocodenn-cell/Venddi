import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { CompanySubscription, SubscriptionPlan, SubscriptionStatus } from '@/lib/schemas/subscription'
import { calculateTrialEndDate, calculateTrialStartDate, determineSubscriptionStatus } from '@/lib/schemas/subscription'

// ============================================
// Trial & Subscription API
// ============================================

/**
 * Create a new subscription with 30-day trial
 */
export async function createTrialSubscription(params: {
  companyId: string
  plan?: SubscriptionPlan
}): Promise<CompanySubscription> {
  const { companyId, plan = 'starter' } = params

  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const trialStartedAt = calculateTrialStartDate()
    const trialEndDate = calculateTrialEndDate().toISOString()

    const { data, error } = await supabase
      .from('company_subscriptions')
      .insert({
        company_id: companyId,
        plan,
        trial_started_at: trialStartedAt,
        trial_end_date: trialEndDate,
        trial_days: 30,
        status: 'trial',
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      plan: data.plan,
      trialStartedAt: data.trial_started_at,
      trialEndDate: data.trial_end_date,
      trialDays: data.trial_days,
      status: data.status,
      convertedToPaidAt: data.converted_to_paid_at,
      canceledAt: data.canceled_at,
      cancellationReason: data.cancellation_reason,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error creating trial subscription:', error)
    throw new Error('Erro ao criar trial')
  }
}

/**
 * Get subscription for a company
 */
export async function getCompanySubscription(companyId: string): Promise<CompanySubscription | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null
  }

  try {
    const { data, error } = await supabase
      .from('company_subscriptions')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows
      throw error
    }

    return {
      id: data.id,
      companyId: data.company_id,
      plan: data.plan,
      trialStartedAt: data.trial_started_at,
      trialEndDate: data.trial_end_date,
      trialDays: data.trial_days,
      status: data.status,
      convertedToPaidAt: data.converted_to_paid_at,
      canceledAt: data.canceled_at,
      cancellationReason: data.cancellation_reason,
      stripeCustomerId: data.stripe_customer_id,
      stripeSubscriptionId: data.stripe_subscription_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return null
  }
}

/**
 * Check if company can access the system
 */
export async function canCompanyAccess(companyId: string): Promise<{
  canAccess: boolean
  reason?: string
  subscription?: CompanySubscription
}> {
  const subscription = await getCompanySubscription(companyId)

  if (!subscription) {
    return {
      canAccess: false,
      reason: 'Assinatura não encontrada',
    }
  }

  const currentStatus = determineSubscriptionStatus(subscription)

  // Update status if changed
  if (currentStatus !== subscription.status) {
    await updateSubscriptionStatus(subscription.id, currentStatus)
    subscription.status = currentStatus
  }

  // Check access
  if (currentStatus === 'trial' || currentStatus === 'active') {
    return {
      canAccess: true,
      subscription,
    }
  }

  if (currentStatus === 'expired') {
    return {
      canAccess: false,
      reason: 'Trial expirado. Assine um plano para continuar.',
      subscription,
    }
  }

  if (currentStatus === 'canceled') {
    return {
      canAccess: false,
      reason: 'Assinatura cancelada',
      subscription,
    }
  }

  if (currentStatus === 'suspended') {
    return {
      canAccess: false,
      reason: 'Conta suspensa',
      subscription,
    }
  }

  return {
    canAccess: false,
    reason: 'Status desconhecido',
    subscription,
  }
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'canceled') {
      updateData.canceled_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('company_subscriptions')
      .update(updateData)
      .eq('id', subscriptionId)

    if (error) throw error
  } catch (error) {
    console.error('Error updating subscription status:', error)
    throw new Error('Erro ao atualizar status da assinatura')
  }
}

/**
 * Convert trial to paid subscription
 */
export async function convertTrialToPaid(params: {
  subscriptionId: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { error } = await supabase
      .from('company_subscriptions')
      .update({
        status: 'active',
        converted_to_paid_at: new Date().toISOString(),
        stripe_customer_id: params.stripeCustomerId,
        stripe_subscription_id: params.stripeSubscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.subscriptionId)

    if (error) throw error

    // Create notification
    const { data: subscriptionData, error: subError } = await supabase
      .from('company_subscriptions')
      .select('company_id')
      .eq('id', params.subscriptionId)
      .single()

    if (!subError && subscriptionData) {
      await supabase.from('trial_notifications').insert({
        company_id: subscriptionData.company_id,
        notification_type: 'trial_converted',
        message: 'Trial convertido para plano pago com sucesso!',
        sent_at: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error('Error converting trial to paid:', error)
    throw new Error('Erro ao converter trial para pago')
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(params: {
  subscriptionId: string
  reason?: string
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { error } = await supabase
      .from('company_subscriptions')
      .update({
        status: 'canceled',
        canceled_at: new Date().toISOString(),
        cancellation_reason: params.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.subscriptionId)

    if (error) throw error
  } catch (error) {
    console.error('Error canceling subscription:', error)
    throw new Error('Erro ao cancelar assinatura')
  }
}

/**
 * Get remaining trial days
 */
export async function getRemainingTrialDays(companyId: string): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    return 0
  }

  try {
    const { data, error } = await supabase
      .rpc('get_remaining_trial_days', { p_company_id: companyId })

    if (error) throw error

    return data || 0
  } catch (error) {
    console.error('Error getting remaining trial days:', error)
    return 0
  }
}

/**
 * Update expired subscriptions (background job)
 */
export async function updateExpiredSubscriptions(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { data, error } = await supabase
      .rpc('update_subscription_statuses')

    if (error) throw error

    return data || 0
  } catch (error) {
    console.error('Error updating expired subscriptions:', error)
    throw new Error('Erro ao atualizar assinaturas expiradas')
  }
}

/**
 * Create trial notification
 */
export async function createTrialNotification(params: {
  companyId: string
  type: 'trial_started' | 'trial_ending_soon' | 'trial_expired' | 'trial_converted'
  message: string
  metadata?: Record<string, any>
}): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { error } = await supabase
      .from('trial_notifications')
      .insert({
        company_id: params.companyId,
        notification_type: params.type,
        message: params.message,
        metadata: params.metadata || {},
        sent_at: new Date().toISOString(),
      })

    if (error) throw error
  } catch (error) {
    console.error('Error creating trial notification:', error)
    throw new Error('Erro ao criar notificação')
  }
}

/**
 * Get trial notifications for a company
 */
export async function getTrialNotifications(companyId: string): Promise<any[]> {
  if (!isSupabaseConfigured || !supabase) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('trial_notifications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    return data || []
  } catch (error) {
    console.error('Error fetching trial notifications:', error)
    return []
  }
}
