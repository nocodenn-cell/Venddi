import { useState, useEffect } from 'react'
import { Modal, Button, Card, CardContent } from '@/components/ui'
import { CheckCircle, Circle, ArrowRight, ArrowLeft, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'

interface OnboardingStep {
  id: number
  title: string
  description: string
  icon: string
  action: string
  completed: boolean
}

export function OnboardingTour() {
  const { company } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 1,
      title: 'Bem-vindo à Venddi!',
      description: 'Vamos configurar sua loja em 6 passos simples. Você estará vendendo em menos de 10 minutos.',
      icon: '👋',
      action: 'Começar',
      completed: false,
    },
    {
      id: 2,
      title: 'Dados da Empresa',
      description: 'Seus dados já estão cadastrados. Vamos verificar se estão corretos.',
      icon: '🏪',
      action: 'Verificar Dados',
      completed: false,
    },
    {
      id: 3,
      title: 'Cadastrar Produtos',
      description: 'Adicione seus primeiros produtos. Você pode cadastrar manualmente ou importar de uma planilha.',
      icon: '📦',
      action: 'Cadastrar Produto',
      completed: false,
    },
    {
      id: 4,
      title: 'Configurar Formas de Pagamento',
      description: 'Defina quais formas de pagamento você aceita: dinheiro, cartão, PIX.',
      icon: '💳',
      action: 'Configurar Pagamentos',
      completed: false,
    },
    {
      id: 5,
      title: 'Abrir Caixa',
      description: 'Abra seu primeiro caixa para começar a vender. Defina o valor inicial (fundo de troco).',
      icon: '💰',
      action: 'Abrir Caixa',
      completed: false,
    },
    {
      id: 6,
      title: 'Realizar Primeira Venda',
      description: 'Parabéns! Agora vamos realizar sua primeira venda e ver como é fácil.',
      icon: '🎉',
      action: 'Fazer Primeira Venda',
      completed: false,
    },
  ])

  useEffect(() => {
    // Verificar se usuário já completou onboarding
    const hasCompletedOnboarding = localStorage.getItem(`venddi_onboarding_${company?.id}`)
    if (!hasCompletedOnboarding) {
      setIsOpen(true)
    }
  }, [company])

  const handleNext = () => {
    const newSteps = [...steps]
    newSteps[currentStep].completed = true
    setSteps(newSteps)

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Onboarding completo
      localStorage.setItem(`venddi_onboarding_${company?.id}`, 'true')
      setIsOpen(false)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    localStorage.setItem(`venddi_onboarding_${company?.id}`, 'true')
    setIsOpen(false)
  }

  const handleAction = () => {
    // Redirecionar para a ação correspondente
    switch (currentStep) {
      case 1:
        window.location.href = '/app/configuracoes'
        break
      case 2:
        window.location.href = '/app/produtos'
        break
      case 3:
        window.location.href = '/app/configuracoes#pagamentos'
        break
      case 4:
        window.location.href = '/app/caixas'
        break
      case 5:
        window.location.href = '/app/pdv'
        break
    }
    handleNext()
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{steps[currentStep].icon}</div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {steps[currentStep].title}
              </h2>
              <p className="text-sm text-gray-500">
                Passo {currentStep + 1} de {steps.length}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                {step.completed ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : index === currentStep ? (
                  <div className="h-6 w-6 rounded-full bg-[#0EA572] flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{index + 1}</span>
                  </div>
                ) : (
                  <Circle className="h-6 w-6 text-gray-300" />
                )}
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-2 ${
                      step.completed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-gray-700 text-lg leading-relaxed">
              {steps[currentStep].description}
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {currentStep === steps.length - 1 ? (
            <Button onClick={handleAction}>
              {steps[currentStep].action}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleAction}>
              {steps[currentStep].action}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
