import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth'
import { getCompanySubscription } from '@/lib/api/subscription'
import { determineSubscriptionStatus, calculateRemainingTrialDays } from '@/lib/schemas/subscription'
import type { CompanySubscription, SubscriptionStatus } from '@/lib/schemas/subscription'

interface UseTrialStatusReturn {
  subscription: CompanySubscription | null
  status: SubscriptionStatus | null
  remainingDays: number
  isLoading: boolean
  canAccess: boolean
  error: string | null
}

/**
 * Hook to check trial status and access permissions
 */
export function useTrialStatus(): UseTrialStatusReturn {
  const { company } = useAuthStore()
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null)
  const [status, setStatus] = useState<SubscriptionStatus | null>(null)
  const [remainingDays, setRemainingDays] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!company) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const sub = await getCompanySubscription(company.id)
        
        if (!sub) {
          // No subscription found - this shouldn't happen after registration
          // but handle it gracefully
          setSubscription(null)
          setStatus(null)
          setRemainingDays(0)
          setError('Assinatura não encontrada')
          setIsLoading(false)
          return
        }

        setSubscription(sub)
        
        // Determine current status
        const currentStatus = determineSubscriptionStatus(sub)
        setStatus(currentStatus)
        
        // Calculate remaining days
        const days = calculateRemainingTrialDays(sub.trialEndDate)
        setRemainingDays(days)
        
      } catch (err) {
        console.error('Error checking trial status:', err)
        setError('Erro ao verificar status da assinatura')
      } finally {
        setIsLoading(false)
      }
    }

    checkTrialStatus()
  }, [company])

  // Determine if user can access the system
  const canAccess = status === 'trial' || status === 'active'

  return {
    subscription,
    status,
    remainingDays,
    isLoading,
    canAccess,
    error,
  }
}

/**
 * Component to protect routes based on trial status
 */
export function TrialGuard({ children }: { children: React.ReactNode }) {
  const { canAccess, status, remainingDays, isLoading } = useTrialStatus()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0EA572]"></div>
      </div>
    )
  }

  if (!canAccess) {
    // Redirect to pricing page with message
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {status === 'expired' ? 'Trial Expirado' : 'Acesso Negado'}
          </h2>
          <p className="text-gray-600 mb-6">
            {status === 'expired' 
              ? `Seu período de teste de 30 dias expirou. Assine um plano para continuar usando a Venddi.`
              : 'Você não tem permissão para acessar esta área.'}
          </p>
          {status === 'expired' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-900">
                <strong>Seus dados estão seguros!</strong><br />
                Você pode acessar seus dados por mais 30 dias após a expiração do trial.
              </p>
            </div>
          )}
          <a
            href="/precos"
            className="block w-full text-center px-4 py-2 bg-[#0EA572] text-white rounded-lg hover:bg-[#087A54] transition-colors"
          >
            Ver Planos
          </a>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
