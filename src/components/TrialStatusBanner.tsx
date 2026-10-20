import { useState, useEffect } from 'react'
import { Card, CardContent, Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import { getCompanySubscription, getRemainingTrialDays } from '@/lib/api/subscription'
import { formatTrialStatusMessage, calculateRemainingTrialDays } from '@/lib/schemas/subscription'
import type { CompanySubscription } from '@/lib/schemas/subscription'
import { Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export function TrialStatusBanner() {
  const { company } = useAuthStore()
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null)
  const [remainingDays, setRemainingDays] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSubscription = async () => {
      if (!company) return

      try {
        setLoading(true)
        const sub = await getCompanySubscription(company.id)
        if (sub) {
          setSubscription(sub)
          const days = await getRemainingTrialDays(company.id)
          setRemainingDays(days)
        }
      } catch (error) {
        console.error('Error loading subscription:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSubscription()
  }, [company])

  if (loading || !subscription) {
    return null
  }

  const status = subscription.status
  const message = formatTrialStatusMessage(subscription)

  // Don't show banner for active paid plans
  if (status === 'active') {
    return null
  }

  // Trial active
  if (status === 'trial' && remainingDays > 0) {
    const isUrgent = remainingDays <= 3

    return (
      <div className={`border-b ${isUrgent ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isUrgent ? (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              ) : (
                <Clock className="h-5 w-5 text-blue-600" />
              )}
              <div>
                <p className={`text-sm font-medium ${isUrgent ? 'text-amber-900' : 'text-blue-900'}`}>
                  {message}
                </p>
                <p className={`text-xs ${isUrgent ? 'text-amber-700' : 'text-blue-700'}`}>
                  {remainingDays === 1 
                    ? 'Assine agora para não perder acesso' 
                    : `Aproveite todos os recursos durante o trial`}
                </p>
              </div>
            </div>
            <a
              href="/precos"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isUrgent
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Ver planos
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Trial expired
  if (status === 'expired' || (status === 'trial' && remainingDays === 0)) {
    return (
      <div className="bg-red-50 border-b border-red-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  {message}
                </p>
                <p className="text-xs text-red-700">
                  Seus dados estão preservados. Assine um plano para continuar usando a Venddi.
                </p>
              </div>
            </div>
            <a
              href="/precos"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Assinar agora
            </a>
          </div>
        </div>
      </div>
    )
  }

  // Canceled
  if (status === 'canceled') {
    return (
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {message}
                </p>
                <p className="text-xs text-gray-700">
                  Você pode reativar sua assinatura a qualquer momento.
                </p>
              </div>
            </div>
            <a
              href="/precos"
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors"
            >
              Reativar
            </a>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export function TrialStatusCard() {
  const { company } = useAuthStore()
  const [subscription, setSubscription] = useState<CompanySubscription | null>(null)
  const [remainingDays, setRemainingDays] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSubscription = async () => {
      if (!company) return

      try {
        setLoading(true)
        const sub = await getCompanySubscription(company.id)
        if (sub) {
          setSubscription(sub)
          const days = await getRemainingTrialDays(company.id)
          setRemainingDays(days)
        }
      } catch (error) {
        console.error('Error loading subscription:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSubscription()
  }, [company])

  if (loading || !subscription) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const status = subscription.status
  const message = formatTrialStatusMessage(subscription)

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Status da Assinatura</h3>
            <Badge
              variant={
                status === 'trial' && remainingDays > 0
                  ? 'primary'
                  : status === 'active'
                  ? 'success'
                  : status === 'expired'
                  ? 'danger'
                  : 'default'
              }
            >
              {status === 'trial' && remainingDays > 0 && 'Trial Ativo'}
              {status === 'trial' && remainingDays === 0 && 'Trial Expirado'}
              {status === 'active' && 'Plano Pago'}
              {status === 'expired' && 'Expirado'}
              {status === 'canceled' && 'Cancelado'}
              {status === 'suspended' && 'Suspenso'}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Plano</span>
              <span className="font-medium text-gray-900 capitalize">
                {subscription.plan}
              </span>
            </div>

            {status === 'trial' && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Dias restantes</span>
                  <span className={`font-medium ${remainingDays <= 3 ? 'text-red-600' : 'text-gray-900'}`}>
                    {remainingDays} {remainingDays === 1 ? 'dia' : 'dias'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Início do trial</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscription.trialStartedAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Fim do trial</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscription.trialEndDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </>
            )}

            {status === 'active' && subscription.convertedToPaidAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Convertido em</span>
                <span className="font-medium text-gray-900">
                  {new Date(subscription.convertedToPaidAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )}
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-3">{message}</p>

            {(status === 'trial' || status === 'expired') && (
              <a
                href="/precos"
                className="block w-full text-center px-4 py-2 rounded-lg text-sm font-medium bg-[#0EA572] text-white hover:bg-[#087A54] transition-colors"
              >
                {status === 'expired' ? 'Assinar agora' : 'Ver planos'}
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
