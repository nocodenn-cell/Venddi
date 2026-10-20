import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 'R$ 49',
      period: '/mês',
      description: 'Para lojas que estão começando',
      features: [
        '1 ponto de venda (PDV)',
        'Até 300 produtos',
        'Controle de estoque básico',
        'Relatórios de vendas',
        'Fechamento de caixa',
        'Suporte por e-mail',
      ],
      cta: 'Começar agora',
      highlighted: false,
    },
    {
      name: 'Professional',
      price: 'R$ 99',
      period: '/mês',
      description: 'Para lojas em crescimento',
      features: [
        'Até 3 pontos de venda',
        'Produtos ilimitados',
        'Controle de estoque avançado',
        'Relatórios completos',
        'Múltiplos operadores',
        'Suporte prioritário',
        'Backup automático',
      ],
      cta: 'Começar agora',
      highlighted: true,
    },
    {
      name: 'Business',
      price: 'R$ 199',
      period: '/mês',
      description: 'Para redes e múltiplas lojas',
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
      cta: 'Falar com vendas',
      highlighted: false,
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Venddi</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost" size="sm">Entrar</Button>
              </Link>
              <Link to="/cadastro">
                <Button size="sm">15 dias grátis</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-[#F0FDF4] via-white to-[#ECFDF5]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Planos simples para<br />
            <span className="text-[#0EA572]">vendas sem complicação</span>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Comece com 30 dias grátis. Sem cartão de crédito. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 ${
                  plan.highlighted
                    ? 'bg-[#0EA572] text-white shadow-2xl scale-105'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.highlighted && (
                  <div className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
                    Mais popular
                  </div>
                )}
                <h3 className={`text-2xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-white/80' : 'text-gray-600'}`}>
                  {plan.description}
                </p>
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm ${plan.highlighted ? 'text-white/80' : 'text-gray-600'}`}>
                    {plan.period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        plan.highlighted ? 'text-white' : 'text-[#0EA572]'
                      }`} />
                      <span className={`text-sm ${plan.highlighted ? 'text-white/90' : 'text-gray-600'}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to="/cadastro">
                  <Button
                    size="lg"
                    variant={plan.highlighted ? 'secondary' : 'primary'}
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-white text-[#0EA572] hover:bg-gray-100'
                        : ''
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Perguntas frequentes
          </h2>
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Como funciona o teste grátis de 30 dias?
              </h3>
              <p className="text-gray-600">
                Você cria sua conta e tem acesso completo ao Venddi por 30 dias, sem precisar 
                cadastrar cartão de crédito. Ao final do período, você pode escolher um plano 
                pago ou simplesmente não continuar, sem nenhum custo.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Preciso de conhecimento técnico para usar?
              </h3>
              <p className="text-gray-600">
                Não! O Venddi foi feito para ser extremamente simples. Se você sabe usar um 
                computador básico, consegue usar o Venddi. A interface é intuitiva e focada 
                em vendas rápidas.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Posso cancelar a qualquer momento?
              </h3>
              <p className="text-gray-600">
                Sim! Não há fidelidade. Você pode cancelar sua assinatura quando quiser, 
                sem multas ou taxas. Seus dados ficam disponíveis para exportação por 30 dias 
                após o cancelamento.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Meus dados estão seguros?
              </h3>
              <p className="text-gray-600">
                Absolutamente. Usamos criptografia de ponta a ponta, backups automáticos e 
                seguimos todas as normas da LGPD. Seus dados de vendas e clientes são 
                completamente privados e isolados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-[#0EA572] to-[#087A54]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Pronto para começar?
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Crie sua conta agora e teste grátis por 30 dias.
          </p>
          <Link to="/cadastro">
            <Button size="lg" variant="secondary" className="bg-white text-[#0EA572] hover:bg-gray-100">
              Criar minha conta grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
                </svg>
              </div>
              <span className="text-xl font-bold">Venddi</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              © 2026 Venddi. Um produto Mature Code. Todos os direitos reservados.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
              <Link to="/" className="hover:text-white">Início</Link>
              <a href="#" className="hover:text-white">Termos</a>
              <a href="#" className="hover:text-white">Privacidade</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
