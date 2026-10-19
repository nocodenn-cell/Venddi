import { useState, useEffect, useRef } from 'react'

// Icons as SVG components
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="24" fill="white" fillOpacity="0.9"/>
    <path d="M20 16L32 24L20 32V16Z" fill="#00856F"/>
  </svg>
)

// Navbar Component
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const menuItems = [
    { label: 'ERP', id: 'erp' },
    { label: 'HUB', id: 'hub' },
    { label: 'Inteligência', id: 'inteligencia' },
    { label: 'Para quem', id: 'para-quem' },
    { label: 'Pro seu negócio', id: 'negocio' },
    { label: 'Usando o Bling', id: 'usando' },
  ]

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-md' : 'bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 bg-[#00856F] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-[#00856F] font-bold text-xl">bling</span>
            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                className="relative px-3 py-2 text-sm font-medium text-gray-700 hover:text-[#00856F] transition-colors flex items-center gap-1"
                onMouseEnter={() => setActiveMenu(item.id)}
                onMouseLeave={() => setActiveMenu(null)}
              >
                {item.label}
                <ChevronDown />
              </button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            <button className="text-sm font-medium text-gray-700 hover:text-[#00856F] px-4 py-2">
              Já sou cliente
            </button>
            <button className="bg-[#00856F] hover:bg-[#006B59] text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors">
              Teste grátis
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M6 6L18 18M6 18L18 6" strokeLinecap="round"/>
              ) : (
                <path d="M4 6H20M4 12H20M4 18H20" strokeLinecap="round"/>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mega Menu Dropdown */}
      {activeMenu && (
        <div className="hidden lg:block absolute top-16 left-0 right-0 bg-white shadow-lg border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="grid grid-cols-3 gap-8">
              {activeMenu === 'erp' && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Gestão Operacional</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Estoque</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Vendas</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Logística</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Finanças</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Gestão financeira</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Meios de pagamento</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Bling Conta Digital</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Cadastros</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Cadastros</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Controle de estoque</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Ordem de produção</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Multiempresas</a></li>
                    </ul>
                  </div>
                </>
              )}
              {activeMenu === 'hub' && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Loja virtual, física e marketplace</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Vendas Multicanal</a></li>
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Loja Virtual</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Integrações e serviços</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Central de Extensões</a></li>
                    </ul>
                  </div>
                </>
              )}
              {activeMenu === 'inteligencia' && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Ações automáticas</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Automações</a></li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">Visão analítica</h4>
                    <ul className="space-y-2">
                      <li><a href="#" className="text-sm text-gray-700 hover:text-[#00856F]">Meu Negócio</a></li>
                    </ul>
                  </div>
                </>
              )}
              {(activeMenu === 'para-quem' || activeMenu === 'negocio' || activeMenu === 'usando') && (
                <div className="col-span-3">
                  <p className="text-sm text-gray-500">Explore nossas soluções para o seu tipo de negócio.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t">
          <div className="px-4 py-4 space-y-3">
            {menuItems.map((item) => (
              <a key={item.id} href="#" className="block text-sm font-medium text-gray-700 py-2">
                {item.label}
              </a>
            ))}
            <div className="pt-4 border-t">
              <button className="w-full bg-[#00856F] text-white font-semibold px-5 py-3 rounded-lg">
                Teste grátis
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}

// Hero Section
function HeroSection() {
  return (
    <section className="pt-16 bg-gradient-to-br from-[#E8F5F1] via-[#F0FAF7] to-white">
      {/* Promo Banner */}
      <div className="bg-[#1A1A2E] text-white text-center py-2.5">
        <p className="text-sm font-medium">
          OFERTA BLACK FRIDAY: <span className="font-bold">30 dias grátis</span> + até <span className="font-bold">45% OFF</span> na primeira mensalidade
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
              Até <span className="text-[#00856F]">45% de desconto</span> para unificar a sua operação e vender sem erros nesta <span className="text-[#00856F]">Black Friday*</span>
            </h1>
            <div className="flex flex-wrap gap-3 mt-6">
              {['Sistema de gestão', 'HUB de vendas', 'Loja virtual', 'Logística'].map((tag) => (
                <span key={tag} className="bg-white border border-gray-200 text-gray-700 text-sm px-3 py-1.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button className="bg-[#00856F] hover:bg-[#006B59] text-white font-bold px-8 py-4 rounded-lg text-lg transition-all hover:shadow-lg">
                Garantir Desconto
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              *Desconto na 1ª mensalidade para pagamentos até o vencimento. O benefício não é aplicado na 2ª via.
            </p>
          </div>
          <div className="relative">
            <div className="bg-gradient-to-br from-[#00856F] to-[#00A88C] rounded-2xl p-8 shadow-2xl">
              <div className="bg-white/10 backdrop-blur rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/20 rounded w-3/4"></div>
                  <div className="h-4 bg-white/20 rounded w-1/2"></div>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="h-16 bg-white/20 rounded-lg"></div>
                    <div className="h-16 bg-white/30 rounded-lg"></div>
                    <div className="h-16 bg-white/20 rounded-lg"></div>
                  </div>
                  <div className="h-24 bg-white/15 rounded-lg mt-2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Client Logos Carousel
function ClientLogos() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const clients = [
    'Soldiers Nutrition', 'Adamanto', 'Secret', 'Leticia Vaz Store',
    'Toda Up', 'Aura Beauty', 'Secret Group', 'Blumi', 'HeyMu', 'Guava', 'Uiara'
  ]

  return (
    <section className="py-10 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="overflow-hidden" ref={scrollRef}>
          <div className="flex animate-scroll gap-12 items-center">
            {[...clients, ...clients].map((client, i) => (
              <div key={i} className="flex-shrink-0 px-4">
                <div className="h-8 w-32 bg-gray-200 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500 font-medium">{client}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Target Audience Section
function TargetAudienceSection() {
  const audiences = [
    {
      icon: '🛍️',
      title: 'Vende online',
      desc: 'Gerencie todo seu processo de vendas online, integre com plataformas e emita notas fiscais',
      color: 'bg-emerald-50 border-emerald-100',
    },
    {
      icon: '🏪',
      title: 'Tem loja física',
      desc: 'Emita notas fiscais, controle estoque e gerencie frente de caixa (PDV) na sua loja física',
      color: 'bg-blue-50 border-blue-100',
    },
    {
      icon: '👨‍💼',
      title: 'Oferece serviço',
      desc: 'Cadastre clientes, controle ordens de serviço, faça gestão financeira e envie links de pagamento',
      color: 'bg-purple-50 border-purple-100',
    },
    {
      icon: '🏭',
      title: 'Tem pequena indústria',
      desc: 'Gerencie suprimentos e estoque, controle ordem de produção e emita notas fiscais',
      color: 'bg-orange-50 border-orange-100',
    },
  ]

  return (
    <section className="py-16 lg:py-24 bg-[#F8FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-[#00856F] uppercase tracking-wider mb-2">PARA QUEM</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            O Bling é para o <span className="text-[#00856F]">seu tipo de negócio</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((audience, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border ${audience.color} hover:shadow-lg transition-all cursor-pointer group`}
            >
              <div className="text-4xl mb-4">{audience.icon}</div>
              <h3 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-[#00856F] transition-colors">
                {audience.title}
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{audience.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-[#00856F] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Saiba mais <ArrowRight />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Services Section
function ServicesSection() {
  const services = [
    {
      title: 'Bling Envios',
      desc: 'Gerencie a separação e envio de remessas em diversos operadores logísticos.',
      gradient: 'from-teal-500 to-emerald-600',
    },
    {
      title: 'Bling Conta Digital',
      desc: 'Automatize o processo de recebimento e conciliação das vendas realizadas.',
      gradient: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Certificado Digital',
      desc: 'Otimize a gestão do seu negócio integrando automaticamente as movimentações.',
      gradient: 'from-purple-500 to-violet-600',
    },
    {
      title: 'Maquininha POS',
      desc: 'Automatize o recebimento e conciliação das vendas com cartão de crédito ou débito.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      title: 'Bling Loja Virtual',
      desc: 'Crie a sua vitrine própria na internet com estoque sincronizado.',
      gradient: 'from-pink-500 to-rose-600',
    },
  ]

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-[#00856F] uppercase tracking-wider mb-2">PRO SEU NEGÓCIO FLUIR</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Soluções completas para o seu <span className="text-[#00856F]">crescimento</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <div key={i} className="group rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all">
              <div className={`bg-gradient-to-br ${service.gradient} h-32 flex items-center justify-center`}>
                <div className="w-16 h-16 bg-white/20 rounded-xl backdrop-blur"></div>
              </div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 mb-1 group-hover:text-[#00856F] transition-colors">
                  {service.title}
                </h3>
                <p className="text-sm text-gray-500">{service.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Features Section
function FeaturesSection() {
  const [activeTab, setActiveTab] = useState('gerir')

  const tabs = [
    { id: 'gerir', label: 'Gerir' },
    { id: 'vender', label: 'Vender' },
    { id: 'enviar', label: 'Enviar' },
  ]

  const features = {
    gerir: [
      { icon: '📋', title: 'Certificado Digital', desc: 'Compre o Certificado Digital para emissão de notas fiscais eletrônicas por um dos melhores preços no mercado.' },
      { icon: '💰', title: 'Controle Financeiro', desc: 'Soluções completas para movimentar, gerenciar e impulsionar a saúde financeira do seu negócio.' },
      { icon: '💳', title: 'Meios de Pagamento', desc: 'Pix, boleto, links de pagamentos e maquininha POS conectados ao seu ERP.' },
      { icon: '📄', title: 'DANFE', desc: 'Faça a emissão do DANFE de um jeito simples e descomplicado.' },
      { icon: '🏷️', title: 'Impressão de Etiquetas', desc: 'Impressão unificada de etiqueta logística e DANFE em um clique.' },
      { icon: '📦', title: 'Separação de pedidos', desc: 'Agilize seu processo de expedição e evite erros com a verificação dos itens.' },
      { icon: '🏭', title: 'Ordem de produção', desc: 'Controle a fabricação dos produtos e gerencie seu negócio.' },
      { icon: '📊', title: 'Controle de estoque', desc: 'Gestão de estoque com sincronizações automáticas e integrada a todos seus canais.' },
      { icon: '👥', title: 'Cadastros', desc: 'Cadastre clientes, fornecedores, vendedores, funcionários, produtos e serviços.' },
      { icon: '🔧', title: 'Ordem de Serviço', desc: 'Controle a execução do trabalho e faça a gestão do negócio em poucos cliques.' },
      { icon: '📑', title: 'Propostas comerciais', desc: 'Faça a gestão de propostas comerciais e orçamentos de um jeito simples.' },
      { icon: '🖥️', title: 'Frente de Caixa (PDV)', desc: 'Venda na loja física com uma frente de caixa fácil de usar e conectada ao estoque.' },
    ],
    vender: [
      { icon: '📝', title: 'Nota fiscal eletrônica', desc: 'Emita sua nota fiscal eletrônica direto do pedido de venda de forma fácil e rápida.' },
      { icon: '🧾', title: 'Nota fiscal do consumidor', desc: 'Emita NFC-es automaticamente direto do pedido de venda.' },
      { icon: '📋', title: 'Nota fiscal de serviço', desc: 'Transforme serviços prestados em notas fiscais com apenas alguns cliques.' },
      { icon: '📈', title: 'Controle de vendas', desc: 'Faça a gestão completa dos pedidos de venda em um só lugar.' },
      { icon: '🛒', title: 'Frente de Caixa (PDV)', desc: 'Venda na loja física com uma frente de caixa fácil de usar.' },
      { icon: '🤝', title: 'Propostas comerciais', desc: 'Crie propostas e orçamentos de forma profissional.' },
      { icon: '🏪', title: 'Loja Virtual', desc: 'Gerencie sua loja online integrada com o Bling. Novo!' },
    ],
    enviar: [
      { icon: '🚚', title: 'Bling Envios', desc: 'Garanta os melhores preços de frete com experiência integrada ao ERP.' },
      { icon: '📦', title: 'Separação de pedidos', desc: 'Agilize seu processo de expedição e evite erros.' },
      { icon: '🏷️', title: 'Impressão de Etiquetas', desc: 'Impressão unificada de etiqueta logística e DANFE em um clique.' },
      { icon: '📄', title: 'DANFE', desc: 'Emita DANFEs automaticamente de forma simples.' },
    ],
  }

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Todos os recursos que a sua empresa<br />precisa para o <span className="text-[#00856F]">crescimento fluir</span>
          </h2>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00856F] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features[activeTab as keyof typeof features].map((feature, i) => (
            <div
              key={i}
              className="group p-5 rounded-xl border border-gray-100 hover:border-[#00856F]/30 hover:shadow-lg transition-all cursor-pointer bg-white"
            >
              <div className="text-3xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-[#00856F] transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-[#00856F] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Saiba mais <ArrowRight />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Growth Section
function GrowthSection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-[#F0FAF7] to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">
              Os recursos que melhoram a performance e fazem o <span className="text-[#00856F]">faturamento crescer até 60%</span>
            </h2>
            <div className="mt-8 relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#00856F] to-[#00A88C] aspect-video flex items-center justify-center cursor-pointer group">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors"></div>
              <div className="relative z-10 transform group-hover:scale-110 transition-transform">
                <PlayIcon />
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">
              <span className="text-[#00856F]">Automação inteligente</span> pro seu crescimento fluir
            </h3>
            <p className="text-gray-600 mt-4 text-lg leading-relaxed">
              Muito além de um ERP robusto, o Bling é uma plataforma completa que unifica toda a jornada do seu negócio para você gerir, vender e enviar sem esforço.
            </p>
            <button className="mt-8 bg-[#00856F] hover:bg-[#006B59] text-white font-bold px-8 py-4 rounded-lg transition-all hover:shadow-lg">
              Comece agora
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Manage-Sell-Ship Section
function ManageSellShipSection() {
  const [activeStep, setActiveStep] = useState(0)

  const steps = [
    {
      title: 'Gestão sincronizada do estoque ao financeiro',
      desc: 'Registre compras do pedido à conferência sem retrabalho. O Bling sincroniza o seu estoque em tempo real para múltiplos canais, depósitos e empresas.',
      cta: 'Ver integrações de gestão',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Vendas multicanal e notas fiscais automáticas',
      desc: 'Venda na sua loja virtual, marketplaces ou loja física. Você gerencia uma vitrine profissional com anúncios multiloja.',
      cta: 'Ver como vender mais',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Logística simplificada com Bling Envios',
      desc: 'Confira cada item antes do envio para eliminar erros. Bling envios automatiza a sua logística, gerando a remessa e a etiqueta por pedido.',
      cta: 'Conhecer o Bling Envios',
      color: 'from-orange-500 to-red-500',
    },
  ]

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 text-center mb-4">
          Conte com o Bling para gerir, vender e enviar.<br />
          <span className="text-[#00856F]">Tudo conectado no mesmo lugar.</span>
        </h2>

        <div className="flex justify-center gap-4 mt-10 mb-12">
          {['Gerir', 'Vender', 'Enviar'].map((label, i) => (
            <button
              key={label}
              onClick={() => setActiveStep(i)}
              className={`px-6 py-3 rounded-full font-semibold text-sm transition-all ${
                activeStep === i
                  ? 'bg-[#00856F] text-white shadow-lg'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">{steps[activeStep].title}</h3>
            <p className="text-gray-600 text-lg leading-relaxed mb-6">{steps[activeStep].desc}</p>
            <button className="flex items-center gap-2 text-[#00856F] font-semibold hover:underline">
              {steps[activeStep].cta} <ArrowRight />
            </button>
          </div>
          <div className={`bg-gradient-to-br ${steps[activeStep].color} rounded-2xl p-8 aspect-[4/3] flex items-center justify-center`}>
            <div className="bg-white/10 backdrop-blur rounded-xl p-6 w-full">
              <div className="space-y-3">
                <div className="h-3 bg-white/30 rounded w-2/3"></div>
                <div className="h-3 bg-white/20 rounded w-1/2"></div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="h-20 bg-white/20 rounded-lg"></div>
                  <div className="h-20 bg-white/15 rounded-lg"></div>
                </div>
                <div className="h-16 bg-white/10 rounded-lg mt-3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Benefits Section
function BenefitsSection() {
  const benefits = [
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <path d="M10 16H22M16 10V22" stroke="#00856F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Plataforma integrada',
      desc: 'Integre tudo o que seu negócio precisa para crescer em um único painel. Uma interface simples desenhada para simplificar sua rotina.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <circle cx="16" cy="14" r="4" stroke="#00856F" strokeWidth="2"/>
          <path d="M10 24C10 20.6863 12.6863 18 16 18C19.3137 18 22 20.6863 22 24" stroke="#00856F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Suporte humano especialista',
      desc: 'Suporte por telefone, e-mail ou ticket. O nosso time está pronto para apoiar a sua jornada.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <path d="M10 22L14 14L18 18L22 10" stroke="#00856F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: 'Visão analítica apoiada por IA',
      desc: 'Acesse dashboards inteligentes e use nosso Agente de IA para extrair insights precisos sobre o negócio.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <rect x="10" y="10" width="12" height="12" rx="2" stroke="#00856F" strokeWidth="2"/>
          <path d="M14 16H18M16 14V18" stroke="#00856F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Operação centralizada',
      desc: 'Substitua planilhas por um fluxo automático sem sair da plataforma. Do estoque ao envio, gerencie notas fiscais.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <path d="M12 16C12 13.7909 13.7909 12 16 12C18.2091 12 20 13.7909 20 16C20 18.2091 18.2091 20 16 20" stroke="#00856F" strokeWidth="2" strokeLinecap="round"/>
          <path d="M16 10V12M16 20V22M10 16H12M20 16H22" stroke="#00856F" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      title: 'Sincronização multicanal e multiempresas',
      desc: 'Um ecossistema sob medida que se molda ao seu volume. Organize estoques unificados e múltiplos CNPJs.',
    },
    {
      icon: (
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="#E8F5F1"/>
          <path d="M11 17L14 20L21 13" stroke="#00856F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
      title: 'Automações e envios sem atrito',
      desc: 'Quando a venda acontece, o Bling Envios já entra em ação. Automatiza o faturamento e gera etiquetas com tarifas competitivas.',
    },
  ]

  return (
    <section className="py-16 lg:py-24 bg-[#F8FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-shrink-0">{benefit.icon}</div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{benefit.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Integrations Section
function IntegrationsSection() {
  const scrollRef = useRef<HTMLDivElement>(null)

  const integrations = [
    'Mercado Livre', 'Shopee', 'Amazon', 'Magalu', 'Shein',
    'Nuvemshop', 'Shopify', 'Tray', 'iFood', 'TikTok Shop',
    'Correios', 'Jadlog', 'Loggi', 'Melhor Envio', 'Frenet',
    'Instagram', 'Bagy', 'Loja Integrada', 'Wake', 'Mercos',
  ]

  return (
    <section className="py-16 lg:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Conecte seu negócio a mais de <span className="text-[#00856F]">250 plataformas</span> e marketplaces com o Bling
          </h2>
          <p className="text-gray-600 mt-4 text-lg max-w-2xl mx-auto">
            Sincronize a sua operação com as maiores plataformas do mercado. Conecte canais de venda, ferramentas de logística e inteligência artificial.
          </p>
          <button className="mt-6 text-[#00856F] font-semibold flex items-center gap-2 mx-auto hover:underline">
            Conheça a Central de Extensões <ArrowRight />
          </button>
        </div>

        {/* Integration logos grid */}
        <div className="overflow-hidden relative">
          <div className="flex animate-scroll-fast gap-6 items-center py-4">
            {[...integrations, ...integrations].map((name, i) => (
              <div key={i} className="flex-shrink-0 w-36 h-16 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center hover:border-[#00856F]/30 hover:shadow-sm transition-all">
                <span className="text-xs font-medium text-gray-600 text-center px-2">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// CTA Section
function CTASection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-[#00856F] to-[#005C4D]">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
          Comece agora e transforme a gestão do seu negócio
        </h2>
        <p className="text-white/80 text-lg mb-8">
          30 dias grátis. Sem compromisso. Cancele quando quiser.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-white text-[#00856F] font-bold px-8 py-4 rounded-lg text-lg hover:bg-gray-100 transition-colors shadow-lg">
            Teste grátis por 30 dias
          </button>
          <button className="border-2 border-white text-white font-bold px-8 py-4 rounded-lg text-lg hover:bg-white/10 transition-colors">
            Ver planos e preços
          </button>
        </div>
      </div>
    </section>
  )
}

// Footer
function Footer() {
  return (
    <footer className="bg-[#1A1A2E] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-1 mb-4">
              <div className="w-8 h-8 bg-[#00856F] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="text-white font-bold text-xl">bling</span>
            </div>
            <p className="text-gray-400 text-sm">
              Sua plataforma completa de negócios.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Produto</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">ERP</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">HUB</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Loja Virtual</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Bling Envios</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Conta Digital</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Recursos</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Central de Ajuda</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Blog</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Academy</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Treinamentos</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">API</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Sobre nós</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Carreiras</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Parceiros</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Contato</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Termos de uso</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Privacidade</a></li>
              <li><a href="#" className="text-gray-400 text-sm hover:text-white">Segurança</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2026 Bling Sistemas. Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-gray-400 hover:text-white">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-white">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// Learning Section
function LearningSection() {
  const resources = [
    { icon: '🎓', title: 'Bling Academy', desc: 'Acesse gratuitamente cursos sobre o Bling, vendas, marketing e muito mais' },
    { icon: '🚀', title: 'Implantação Guiada', desc: 'Faça as primeiras configurações do Bling junto com nossos especialistas' },
    { icon: '📺', title: 'Treinamentos ao vivo', desc: 'Participe do treinamento gratuito que acontece todos os dias às 14h' },
    { icon: '❓', title: 'Central de Ajuda', desc: 'Encontre tutoriais sobre as funcionalidades e integrações do Bling' },
    { icon: '📝', title: 'Blog', desc: 'Aprenda com artigos de tendências e boas práticas para empreendedores' },
    { icon: '🎥', title: 'Youtube', desc: 'Veja vídeos tutoriais criados pelo nosso time de suporte' },
  ]

  return (
    <section className="py-16 lg:py-24 bg-[#F8FAFB]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-bold text-[#00856F] uppercase tracking-wider mb-2">USANDO O BLING</p>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
            Aprenda e <span className="text-[#00856F]">cresça</span> com a gente
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource, i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-white border border-gray-100 hover:border-[#00856F]/30 hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="text-3xl mb-3">{resource.icon}</div>
              <h3 className="font-bold text-gray-900 mb-1 group-hover:text-[#00856F] transition-colors">
                {resource.title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">{resource.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Partner Section
function PartnerSection() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
            <div className="text-4xl mb-4">🤝</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Contrate um Parceiro</h3>
            <p className="text-sm text-gray-600 mb-4">Conte com parceiros oficiais para implantação, treinamento e consultoria.</p>
            <button className="text-[#00856F] font-semibold text-sm flex items-center gap-1 mx-auto hover:underline">
              Encontrar especialista <ArrowRight />
            </button>
          </div>
          <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
            <div className="text-4xl mb-4">⭐</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Seja um Top Especialista</h3>
            <p className="text-sm text-gray-600 mb-4">Torne-se certificado, ganhe destaque e escale seus serviços.</p>
            <button className="text-[#00856F] font-semibold text-sm flex items-center gap-1 mx-auto hover:underline">
              Saiba mais <ArrowRight />
            </button>
          </div>
          <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Parceiros Afiliados</h3>
            <p className="text-sm text-gray-600 mb-4">Indique o Bling e receba 10% de comissão recorrente por cada cliente.</p>
            <button className="text-[#00856F] font-semibold text-sm flex items-center gap-1 mx-auto hover:underline">
              Seja afiliado <ArrowRight />
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// Main App
function App() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />
      <HeroSection />
      <ClientLogos />
      <GrowthSection />
      <ManageSellShipSection />
      <BenefitsSection />
      <TargetAudienceSection />
      <ServicesSection />
      <FeaturesSection />
      <IntegrationsSection />
      <LearningSection />
      <PartnerSection />
      <CTASection />
      <Footer />
    </div>
  )
}

export default App
