import { z } from 'zod'

// ============================================
// Trial & Subscription Schemas
// ============================================

export const subscriptionStatusSchema = z.enum([
  'trial',
  'active',
  'expired',
  'suspended',
  'canceled'
])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const subscriptionPlanSchema = z.enum([
  'starter',
  'professional',
  'business'
])
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>

export const companySubscriptionSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  
  // Plan
  plan: subscriptionPlanSchema,
  
  // Trial
  trialStartedAt: z.string().datetime(),
  trialEndDate: z.string().datetime(),
  trialDays: z.number().int().positive().default(15),
  
  // Status
  status: subscriptionStatusSchema,
  
  // Conversion
  convertedToPaidAt: z.string().datetime().optional(),
  canceledAt: z.string().datetime().optional(),
  cancellationReason: z.string().optional(),
  
  // Payment (future)
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type CompanySubscription = z.infer<typeof companySubscriptionSchema>

// ============================================
// Trial Helper Functions
// ============================================

/**
 * Calcula a data de fim do trial (15 dias a partir de agora)
 */
export function calculateTrialEndDate(startDate: Date = new Date()): Date {
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 15)
  return endDate
}

/**
 * Calcula quantos dias restam no trial
 */
export function calculateRemainingTrialDays(trialEndDate: string | Date): number {
  const end = typeof trialEndDate === 'string' ? new Date(trialEndDate) : trialEndDate
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Verifica se o trial está ativo
 */
export function isTrialActive(trialEndDate: string | Date): boolean {
  return calculateRemainingTrialDays(trialEndDate) > 0
}

/**
 * Verifica se o trial expirou
 */
export function isTrialExpired(trialEndDate: string | Date): boolean {
  return calculateRemainingTrialDays(trialEndDate) === 0
}

/**
 * Determina o status da assinatura baseado nas datas
 */
export function determineSubscriptionStatus(subscription: CompanySubscription): SubscriptionStatus {
  const now = new Date()
  const trialEnd = new Date(subscription.trialEndDate)
  
  // Se foi cancelado
  if (subscription.status === 'canceled') {
    return 'canceled'
  }
  
  // Se foi suspenso
  if (subscription.status === 'suspended') {
    return 'suspended'
  }
  
  // Se converteu para pago
  if (subscription.convertedToPaidAt) {
    return 'active'
  }
  
  // Se o trial ainda está ativo
  if (now < trialEnd) {
    return 'trial'
  }
  
  // Se o trial expirou
  return 'expired'
}

/**
 * Formata mensagem de status do trial
 */
export function formatTrialStatusMessage(subscription: CompanySubscription): string {
  const status = determineSubscriptionStatus(subscription)
  const remainingDays = calculateRemainingTrialDays(subscription.trialEndDate)
  
  switch (status) {
    case 'trial':
      if (remainingDays === 1) {
        return 'Seu trial expira amanhã!'
      } else if (remainingDays <= 3) {
        return `Seu trial expira em ${remainingDays} dias`
      } else {
        return `Trial ativo - ${remainingDays} dias restantes`
      }
    
    case 'expired':
      return 'Trial expirado. Assine um plano para continuar usando a Venddi.'
    
    case 'active':
      return 'Plano ativo'
    
    case 'canceled':
      return 'Assinatura cancelada'
    
    case 'suspended':
      return 'Conta suspensa'
    
    default:
      return 'Status desconhecido'
  }
}

/**
 * Calcula data de início do trial
 */
export function calculateTrialStartDate(): string {
  return new Date().toISOString()
}

/**
 * Valida se uma empresa pode acessar o sistema
 */
export function canCompanyAccessSystem(subscription: CompanySubscription): boolean {
  const status = determineSubscriptionStatus(subscription)
  
  // Permite acesso se:
  // - Trial ativo
  // - Plano ativo (pago)
  return status === 'trial' || status === 'active'
}

/**
 * Valida se uma empresa pode realizar operações críticas
 */
export function canCompanyPerformCriticalOperations(subscription: CompanySubscription): boolean {
  const status = determineSubscriptionStatus(subscription)
  
  // Permite operações críticas se:
  // - Trial ativo
  // - Plano ativo (pago)
  // NÃO permite se:
  // - Trial expirado
  // - Cancelado
  // - Suspenso
  return status === 'trial' || status === 'active'
}

// ============================================
// Plan Definitions
// ============================================

export interface PlanDefinition {
  name: string
  price: number
  currency: string
  interval: 'month'
  features: string[]
  limits: {
    maxUsers: number
    maxProducts: number
    maxSalesPerMonth: number
  }
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlan, PlanDefinition> = {
  starter: {
    name: 'Starter',
    price: 99,
    currency: 'BRL',
    interval: 'month',
    features: [
      '1 ponto de venda (PDV)',
      'Até 300 produtos',
      'Controle de estoque básico',
      'Relatórios de vendas',
      'Fechamento de caixa',
      'Suporte por e-mail',
    ],
    limits: {
      maxUsers: 2,
      maxProducts: 300,
      maxSalesPerMonth: 1000,
    },
  },
  professional: {
    name: 'Professional',
    price: 199,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Até 3 pontos de venda',
      'Produtos ilimitados',
      'Controle de estoque avançado',
      'Relatórios completos',
      'Múltiplos operadores',
      'Suporte prioritário',
      'Backup automático',
    ],
    limits: {
      maxUsers: 10,
      maxProducts: -1, // unlimited
      maxSalesPerMonth: -1, // unlimited
    },
  },
  business: {
    name: 'Business',
    price: 349,
    currency: 'BRL',
    interval: 'month',
    features: [
      'PDVs ilimitados',
      'Produtos ilimitados',
      'Múltiplas lojas',
      'Relatórios avançados',
      'API de integração',
      'Suporte dedicado',
      'Gerente de conta',
      'Treinamento personalizado',
    ],
    limits: {
      maxUsers: -1, // unlimited
      maxProducts: -1, // unlimited
      maxSalesPerMonth: -1, // unlimited
    },
  },
}

// ============================================
// Export
// ============================================

export default {
  subscriptionStatusSchema,
  subscriptionPlanSchema,
  companySubscriptionSchema,
  calculateTrialEndDate,
  calculateRemainingTrialDays,
  isTrialActive,
  isTrialExpired,
  determineSubscriptionStatus,
  formatTrialStatusMessage,
  calculateTrialStartDate,
  canCompanyAccessSystem,
  canCompanyPerformCriticalOperations,
  PLAN_DEFINITIONS,
}
