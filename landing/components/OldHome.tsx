import { Button } from '@/components/Button'
import { 
  ShoppingCart, 
  Package, 
  TrendingUp, 
  CheckCircle2, 
  ArrowRight,
  Zap,
  Shield,
  Clock
} from 'lucide-react'

export default function OldHome({ middle }: { middle: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Venddi</span>
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#beneficios" className="text-sm text-gray-600 hover:text-gray-900">Benefícios</a>
              <a href="#como-funciona" className="text-sm text-gray-600 hover:text-gray-900">Como funciona</a>
              <a href="/precos" className="text-sm text-gray-600 hover:text-gray-900">Preços</a>
            </nav>
            <div className="flex items-center gap-3">
              <a href="/login">
                <Button variant="ghost" size="sm">Entrar</Button>
              </a>
              <a href="#teste">
                <Button size="sm">Teste grátis por 7 dias</Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 lg:py-32 bg-gradient-to-br from-[#F0FDF4] via-white to-[#ECFDF5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#D1FAE5] text-[#087A54] px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                PDV simples para pequenas lojas
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight mb-6">
                Seu caixa simples.<br />
                <span className="text-[#0EA572]">Sua loja sob controle.</span>
              </h1>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Venda rápido, controle estoque e acompanhe seus resultados. 
                Tudo em um sistema fácil de usar, feito para quem está no balcão.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="#teste">
                  <Button size="lg" className="w-full sm:w-auto">
                    Teste grátis por 7 dias
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
                <a href="#como-funciona">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Ver como funciona
                  </Button>
                </a>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Sem cartão de crédito. Cancele quando quiser.
              </p>
            </div>
            <div className="relative">
              {/* Mockup do PDV */}
              <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-[#0EA572]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Camiseta Básica</p>
                        <p className="text-xs text-gray-500">SKU: CAM-001</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">R$ 49,90</p>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-[#0EA572]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Calça Jeans</p>
                        <p className="text-xs text-gray-500">SKU: CAL-002</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-gray-900">R$ 129,90</p>
                  </div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="text-2xl font-bold text-[#0EA572]">R$ 179,80</span>
                    </div>
                    <button className="w-full bg-[#0EA572] text-white py-3 rounded-lg font-semibold hover:bg-[#087A54] transition-colors">
                      Finalizar Venda
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Tudo que você precisa para vender melhor
            </h2>
            <p className="text-lg text-gray-600">
              Simples, rápido e feito para pequenas lojas
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-[#0EA572]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Venda rápido</h3>
              <p className="text-sm text-gray-600">
                Interface simples e intuitiva. Atenda seus clientes em segundos.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-[#0EA572]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Controle estoque</h3>
              <p className="text-sm text-gray-600">
                Saiba exatamente o que tem na loja. Receba alertas de estoque baixo.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-[#0EA572]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Acompanhe resultados</h3>
              <p className="text-sm text-gray-600">
                Veja quanto vendeu, ticket médio e produtos mais vendidos.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#D1FAE5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-[#0EA572]" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Feche o caixa</h3>
              <p className="text-sm text-gray-600">
                Conferência automática no fim do dia. Sem surpresas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Comece a vender em 3 passos
            </h2>
            <p className="text-lg text-gray-600">
              Simples assim. Sem complicação.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-[#0EA572] rounded-full flex items-center justify-center mb-4">
                <span className="text-white text-xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Crie sua conta</h3>
              <p className="text-gray-600">
                Cadastre-se em menos de 2 minutos. Sem cartão de crédito.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-[#0EA572] rounded-full flex items-center justify-center mb-4">
                <span className="text-white text-xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Cadastre produtos</h3>
              <p className="text-gray-600">
                Adicione seus produtos com nome, preço e estoque.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="w-12 h-12 bg-[#0EA572] rounded-full flex items-center justify-center mb-4">
                <span className="text-white text-xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Comece a vender</h3>
              <p className="text-gray-600">
                Abra o caixa e atenda seus clientes. Simples assim.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Acompanhe tudo em um só lugar
            </h2>
            <p className="text-lg text-gray-600">
              Veja como sua loja está performando em tempo real
            </p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Vendas hoje</span>
                  <TrendingUp className="h-4 w-4 text-[#0EA572]" />
                </div>
                <p className="text-3xl font-bold text-gray-900">R$ 2.450</p>
                <p className="text-sm text-[#0EA572] mt-1">+12% vs ontem</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Ticket médio</span>
                  <ShoppingCart className="h-4 w-4 text-[#0EA572]" />
                </div>
                <p className="text-3xl font-bold text-gray-900">R$ 89</p>
                <p className="text-sm text-gray-500 mt-1">12 vendas</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Estoque baixo</span>
                  <Package className="h-4 w-4 text-[#F59E0B]" />
                </div>
                <p className="text-3xl font-bold text-gray-900">5</p>
                <p className="text-sm text-[#F59E0B] mt-1">produtos</p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Produtos mais vendidos</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-[#0EA572]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Camiseta Básica</p>
                      <p className="text-xs text-gray-500">25 vendas</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">R$ 1.247,50</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                      <Package className="h-5 w-5 text-[#0EA572]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Calça Jeans</p>
                      <p className="text-xs text-gray-500">18 vendas</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">R$ 2.338,20</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {middle}

      {/* CTA Final */}
      <section className="py-20 bg-gradient-to-br from-[#0EA572] to-[#087A54]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Pronto para vender mais?
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Teste grátis por 7 dias. Sem cartão de crédito.
          </p>
          <a href="#teste">
            <Button size="lg" variant="secondary" className="bg-white text-[#0EA572] hover:bg-gray-100">
              Criar minha conta grátis
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
          <div className="flex items-center justify-center gap-6 mt-8 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Teste grátis por 7 dias</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Sem cartão</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
                  </svg>
                </div>
                <span className="text-xl font-bold">Venddi</span>
              </div>
              <p className="text-sm text-gray-400">
                Seu caixa simples. Sua loja sob controle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Benefícios</a></li>
                <li><a href="/precos" className="hover:text-white">Preços</a></li>
                <li><a href="#" className="hover:text-white">Como funciona</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Sobre nós</a></li>
                <li><a href="#" className="hover:text-white">Contato</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Termos de uso</a></li>
                <li><a href="#" className="hover:text-white">Privacidade</a></li>
                <li><a href="#" className="hover:text-white">LGPD</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>© 2026 Venddi. Um produto Mature Code. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
