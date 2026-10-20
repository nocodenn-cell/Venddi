import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui'
import { whatsappHref, hasWhatsApp } from '@/config/contact'
import {
  ShoppingCart,
  Package,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Store,
  Shirt,
  Coffee,
  PenTool,
  Smartphone,
  Sparkles,
  MessageCircle,
  ChevronDown,
  AlertTriangle,
  Users,
  Mail,
  Menu,
  X,
} from 'lucide-react'

/*
 * Landing page pública do Venddi.
 * Paleta: verde da marca (#0EA572 / #087A54 / #065F46) + acento quente (amarelo #FBBF24 / laranja #F97316).
 * Texto escuro sobre o amarelo garante contraste AA nos botões principais.
 * Placeholders [PREÇO] / [CONFIRMAR: ...] marcam informações que ainda não foram confirmadas.
 */

function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 bg-[#0EA572] rounded-xl flex items-center justify-center shadow-sm">
        <svg width="22" height="22" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
        </svg>
      </div>
      <span className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-gray-950'}`}>Venddi</span>
    </div>
  )
}

const ctaPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#FBBF24] px-6 h-14 text-base font-extrabold text-gray-950 shadow-[0_4px_0_#B45309] hover:bg-[#F59E0B] active:translate-y-0.5 active:shadow-[0_2px_0_#B45309] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FBBF24]/50 w-full sm:w-auto'

const ctaWhatsApp =
  'inline-flex items-center justify-center gap-2 rounded-xl border-2 border-white/80 px-6 h-14 text-base font-bold text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 w-full sm:w-auto'

/** Ilustração em SVG de um balcão de comércio (sem fotos, sem pessoas). */
function CounterIllustration() {
  return (
    <svg viewBox="0 0 480 300" className="w-full h-auto" role="img" aria-label="Ilustração de um balcão de loja com prateleiras e caixa">
      {/* parede */}
      <rect x="0" y="0" width="480" height="300" rx="24" fill="#064E3B" />
      {/* prateleiras */}
      {[50, 110, 170].map((y) => (
        <rect key={y} x="30" y={y} width="420" height="8" rx="4" fill="#047857" />
      ))}
      {/* produtos nas prateleiras */}
      {[
        [40, 18, '#FBBF24'], [70, 22, '#F97316'], [100, 16, '#FDE68A'], [128, 24, '#34D399'], [162, 18, '#FBBF24'],
        [196, 20, '#F87171'], [228, 22, '#FDE68A'], [262, 18, '#F97316'], [292, 24, '#34D399'], [328, 20, '#FBBF24'],
        [360, 16, '#F87171'], [388, 22, '#FDE68A'], [420, 18, '#F97316'],
      ].map(([x, h, c], i) => (
        <g key={i}>
          <rect x={x as number} y={50 - (h as number) - 18} width="22" height={(h as number) + 18} rx="4" fill={c as string} />
          <rect x={(x as number) + 6} y={110 - (h as number) - 10} width="18" height={(h as number) + 10} rx="3" fill={c as string} opacity="0.85" />
          <rect x={(x as number) + 2} y={170 - (h as number) - 14} width="20" height={(h as number) + 14} rx="4" fill={c as string} opacity="0.7" />
        </g>
      ))}
      {/* balcão */}
      <rect x="0" y="200" width="480" height="100" fill="#F59E0B" />
      <rect x="0" y="196" width="480" height="12" fill="#FBBF24" />
      <rect x="0" y="292" width="480" height="8" fill="#B45309" />
      {/* caixa registradora / tablet */}
      <rect x="300" y="140" width="120" height="70" rx="10" fill="#111827" />
      <rect x="308" y="148" width="104" height="48" rx="6" fill="#0EA572" />
      <text x="360" y="178" textAnchor="middle" fontSize="16" fontWeight="800" fill="white">R$ 0,00</text>
      <rect x="350" y="210" width="20" height="10" fill="#111827" />
      {/* sacola */}
      <path d="M70 200 L80 150 L140 150 L150 200 Z" fill="#FDE68A" />
      <path d="M95 150 Q110 125 125 150" stroke="#B45309" strokeWidth="4" fill="none" />
      {/* placa aberto */}
      <rect x="190" y="215" width="100" height="40" rx="8" fill="#065F46" />
      <text x="240" y="241" textAnchor="middle" fontSize="16" fontWeight="800" fill="#FBBF24">ABERTO</text>
    </svg>
  )
}

function HeroMockup() {
  const items = [
    { name: 'Arroz 5kg', qty: 1, price: 'R$ 0,00' },
    { name: 'Feijão 1kg', qty: 2, price: 'R$ 0,00' },
    { name: 'Refrigerante 2L', qty: 1, price: 'R$ 0,00' },
  ]
  return (
    <div className="relative">
      <div className="hidden sm:block absolute -inset-4 bg-[#FBBF24] rounded-[2rem] rotate-2" aria-hidden="true" />
      <div className="relative bg-white rounded-3xl shadow-2xl p-5 sm:p-6 border-4 border-gray-950">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-extrabold text-gray-950">Caixa 1 · Venda atual</span>
          <span className="text-xs font-bold bg-[#D1FAE5] text-[#065F46] px-2 py-1 rounded-full">Caixa aberto</span>
        </div>
        <ul className="space-y-2" aria-label="Itens da venda de exemplo">
          {items.map((item) => (
            <li key={item.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-[#B45309]" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-950">{item.name}</p>
                  <p className="text-xs text-gray-600">Qtd. {item.qty}</p>
                </div>
              </div>
              <p className="text-sm font-bold text-gray-950">{item.price}</p>
            </li>
          ))}
        </ul>
        <div className="border-t-2 border-dashed border-gray-200 pt-3 mt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Total</span>
            <span className="text-3xl font-black text-[#087A54]">R$ 0,00</span>
          </div>
          <div className="w-full bg-[#0EA572] text-white py-3 rounded-xl font-extrabold text-center">Finalizar venda</div>
          <p className="text-[11px] text-gray-500 mt-2 text-center">Exemplo ilustrativo. Valores fictícios.</p>
        </div>
      </div>
    </div>
  )
}

const niches = [
  { icon: Store, title: 'Mercadinho', text: 'Venda rápido no balcão e saiba o que está acabando.', note: '[CONFIRMAR: balança?]' },
  { icon: Shirt, title: 'Roupas e calçados', text: 'Controle o que entra e o que sai da loja.', note: '[CONFIRMAR: grade tamanho/cor?]' },
  { icon: Coffee, title: 'Conveniência', text: 'Atenda a fila sem enrolação.', note: '' },
  { icon: PenTool, title: 'Papelaria', text: 'Muitos itens pequenos, tudo no estoque.', note: '' },
  { icon: Smartphone, title: 'Celular e acessórios', text: 'Veja o que mais vende e reponha a tempo.', note: '' },
  { icon: Sparkles, title: 'Cosméticos', text: 'Saiba quanto vendeu no dia, sem planilha.', note: '' },
]

const pains = [
  { q: 'Fila no caixa?', a: 'Venda em poucos toques. O cliente paga e vai embora.', icon: Users },
  { q: 'Produto acabou e você nem viu?', a: 'O Venddi avisa quando o estoque está baixo.', icon: AlertTriangle },
  { q: 'Não sabe quanto lucrou hoje?', a: 'Abra o painel e veja vendas do dia e ticket médio.', icon: TrendingUp },
]

const benefits = [
  { icon: ShoppingCart, title: 'Venda rápido', text: 'Tela simples. Atenda seus clientes em segundos.' },
  { icon: Package, title: 'Controle o estoque', text: 'Saiba o que tem na loja. Receba alerta de estoque baixo.' },
  { icon: TrendingUp, title: 'Veja seus resultados', text: 'Quanto vendeu, ticket médio e mais vendidos.' },
  { icon: Shield, title: 'Feche o caixa', text: 'Confira o caixa no fim do dia. Sem susto.' },
]

const steps = [
  { title: 'Crie sua conta', text: 'Cadastro rápido. Sem cartão de crédito.' },
  { title: 'Cadastre seus produtos', text: 'Nome, preço e quantidade em estoque.' },
  { title: 'Comece a vender', text: 'Abra o caixa e atenda. Simples assim.' },
]

const topSellers = [
  { name: 'Refrigerante 2L', niche: 'Mercadinho' },
  { name: 'Camiseta básica', niche: 'Roupas' },
  { name: 'Caderno 10 matérias', niche: 'Papelaria' },
]

const plans = [
  { name: 'Plano [CONFIRMAR: nome]', price: '[PREÇO]', highlight: false },
  { name: 'Plano [CONFIRMAR: nome]', price: '[PREÇO]', highlight: true },
  { name: 'Plano [CONFIRMAR: nome]', price: '[PREÇO]', highlight: false },
]

const faqs = [
  { q: 'Serve para o meu tipo de loja?', a: 'Serve para pequenos comércios que vendem no balcão: mercadinho, roupas, conveniência, papelaria, celular e acessórios, cosméticos e outros. Funções específicas de cada ramo: [CONFIRMAR: balança? grade tamanho/cor?].' },
  { q: 'Funciona no celular?', a: 'O Venddi abre no navegador. [CONFIRMAR: uso completo no celular e tablet?]' },
  { q: 'Precisa de internet?', a: '[CONFIRMAR: funciona sem internet?]' },
  { q: 'Emite nota fiscal?', a: '[CONFIRMAR: NFC-e?]' },
  { q: 'Quanto custa?', a: 'Você testa 30 dias grátis. Depois, [PREÇO] por mês. Veja os planos na seção de preços.' },
  { q: 'Como eu cancelo?', a: 'Sem multa e sem cartão no teste. [CONFIRMAR: passo a passo do cancelamento].' },
]

// Prova social: fica oculta até existir depoimento real. Ex.: [{ name: '[DEPOIMENTO REAL]', text: '...' }]
const testimonials: { name: string; store: string; text: string }[] = []

function FaqItem({ q, a, id }: { q: string; a: string; id: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-4 p-5 text-left font-bold text-gray-950 text-lg"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen((v) => !v)}
      >
        {q}
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <div id={`${id}-panel`} hidden={!open} className="px-5 pb-5 text-gray-700">
        {a}
      </div>
    </div>
  )
}

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const wa = whatsappHref()
  const waExternal = hasWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {}

  return (
    <div className="min-h-screen bg-white text-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#topo" aria-label="Venddi, ir para o início"><Logo /></a>
            <nav className="hidden md:flex items-center gap-7" aria-label="Principal">
              <a href="#beneficios" className="text-sm font-semibold text-gray-700 hover:text-gray-950">Benefícios</a>
              <a href="#como-funciona" className="text-sm font-semibold text-gray-700 hover:text-gray-950">Como funciona</a>
              <Link to="/precos" className="text-sm font-semibold text-gray-700 hover:text-gray-950">Preços</Link>
              <a href="#faq" className="text-sm font-semibold text-gray-700 hover:text-gray-950">Dúvidas</a>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="font-bold">Entrar</Button>
              </Link>
              <Link to="/cadastro" className="hidden sm:inline-flex">
                <Button size="sm" className="bg-[#FBBF24] text-gray-950 font-extrabold hover:bg-[#F59E0B]">30 dias grátis</Button>
              </Link>
              <button
                type="button"
                className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-800 hover:bg-gray-100"
                aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
          {menuOpen && (
            <nav className="md:hidden pb-4 flex flex-col gap-1" aria-label="Menu móvel">
              {[
                ['#beneficios', 'Benefícios'],
                ['#como-funciona', 'Como funciona'],
                ['#precos', 'Preços'],
                ['#faq', 'Dúvidas'],
              ].map(([href, label]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)} className="px-2 py-3 rounded-lg font-semibold text-gray-800 hover:bg-gray-100">
                  {label}
                </a>
              ))}
              <Link to="/precos" className="px-2 py-3 rounded-lg font-semibold text-gray-800 hover:bg-gray-100">Todos os planos</Link>
              <Link to="/cadastro" className="mt-2 inline-flex items-center justify-center rounded-xl bg-[#FBBF24] h-12 font-extrabold text-gray-950">
                Testar 30 dias grátis
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main id="topo">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#065F46] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,#0EA572_0%,transparent_55%)]" aria-hidden="true" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-[#FBBF24] text-gray-950 px-3 py-1.5 rounded-full text-sm font-extrabold mb-5">
                  <Zap className="h-4 w-4" aria-hidden="true" />
                  Caixa simples para pequenas lojas
                </div>
                <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl font-black tracking-tight mb-5">
                  O caixa da sua loja, <span className="text-[#FBBF24]">rápido e sem confusão.</span>
                </h1>
                <p className="text-lg sm:text-xl text-emerald-50 mb-8 max-w-xl">
                  Mercadinho, loja de roupa, conveniência, papelaria… Venda em segundos, saiba o que tem no estoque e feche o caixa sem susto.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/cadastro" className={ctaPrimary}>
                    Testar 30 dias grátis
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </Link>
                  <a href={wa} {...waExternal} className={ctaWhatsApp}>
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                    Falar no WhatsApp
                  </a>
                </div>
                <a href="#como-funciona" className="inline-block mt-4 text-sm font-bold text-white underline underline-offset-4 hover:text-[#FBBF24]">
                  Ver como funciona
                </a>
                <p className="text-sm text-emerald-100 mt-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                  Sem cartão de crédito. Cancele quando quiser.
                </p>
              </div>
              <div className="grid gap-6">
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        {/* Nichos */}
        <section id="tipos-de-loja" className="py-14 sm:py-20 bg-[#FFFBEB]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-10 items-center mb-10">
              <div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3">Feito para o seu tipo de loja</h2>
                <p className="text-lg text-gray-700">Se você vende no balcão, o Venddi serve para você.</p>
              </div>
              <CounterIllustration />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
              {niches.map(({ icon: Icon, title, text, note }) => (
                <div key={title} className="bg-white rounded-2xl p-4 sm:p-6 border-2 border-gray-950 shadow-[4px_4px_0_#0EA572]">
                  <div className="w-11 h-11 bg-[#0EA572] rounded-xl flex items-center justify-center mb-3">
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-base sm:text-lg font-extrabold mb-1">{title}</h3>
                  <p className="text-sm text-gray-700">{text}</p>
                  {note && <p className="text-xs text-[#B45309] font-semibold mt-2">{note}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Dores */}
        <section id="dores" className="py-14 sm:py-20 bg-gray-950 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-10 text-center">Isso acontece na sua loja?</h2>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {pains.map(({ q, a, icon: Icon }) => (
                <div key={q} className="rounded-2xl bg-white/5 border border-white/15 p-6">
                  <Icon className="h-8 w-8 text-[#F97316] mb-4" aria-hidden="true" />
                  <h3 className="text-2xl font-black mb-3">{q}</h3>
                  <p className="text-lg text-emerald-200 flex gap-2">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-[#34D399]" aria-hidden="true" />
                    {a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefícios */}
        <section id="beneficios" className="py-14 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 sm:mb-14 max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3">Tudo que você precisa para vender melhor</h2>
              <p className="text-lg text-gray-700">Sem complicação. Feito para quem está no balcão.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {benefits.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl bg-[#ECFDF5] p-6">
                  <div className="w-14 h-14 bg-[#0EA572] rounded-2xl flex items-center justify-center mb-4">
                    <Icon className="h-7 w-7 text-white" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-extrabold mb-2">{title}</h3>
                  <p className="text-gray-700">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="py-14 sm:py-20 bg-[#0EA572] text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2">Comece a vender em 3 passos</h2>
            <p className="text-lg text-emerald-50 mb-10">Simples assim.</p>
            <ol className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {steps.map((s, i) => (
                <li key={s.title} className="bg-white text-gray-950 rounded-2xl p-6 sm:p-8">
                  <div className="w-14 h-14 bg-[#FBBF24] rounded-full flex items-center justify-center mb-4 text-2xl font-black">{i + 1}</div>
                  <h3 className="text-xl font-extrabold mb-2">{s.title}</h3>
                  <p className="text-gray-700">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Demo do painel */}
        <section id="painel" className="py-14 sm:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3">Seu painel, na palma da mão</h2>
              <p className="text-lg text-gray-700">Veja como está a loja hoje, sem fazer conta.</p>
            </div>
            <div className="rounded-3xl bg-gray-100 p-4 sm:p-8 border-2 border-gray-950">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
                <div className="bg-white rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Vendas do dia</span>
                    <TrendingUp className="h-5 w-5 text-[#0EA572]" aria-hidden="true" />
                  </div>
                  <p className="text-3xl font-black">R$ —</p>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Ticket médio</span>
                    <ShoppingCart className="h-5 w-5 text-[#0EA572]" aria-hidden="true" />
                  </div>
                  <p className="text-3xl font-black">R$ —</p>
                </div>
                <div className="bg-white rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-700">Estoque baixo</span>
                    <AlertTriangle className="h-5 w-5 text-[#F97316]" aria-hidden="true" />
                  </div>
                  <p className="text-3xl font-black">— <span className="text-base font-semibold text-gray-600">produtos</span></p>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-5 sm:p-6">
                <h3 className="text-lg font-extrabold mb-4">Mais vendidos</h3>
                <ol className="space-y-3">
                  {topSellers.map((p, i) => (
                    <li key={p.name} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 bg-[#FEF3C7] rounded-lg flex items-center justify-center font-black text-[#B45309]">{i + 1}</span>
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs text-gray-600">{p.niche}</p>
                        </div>
                      </div>
                      <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    </li>
                  ))}
                </ol>
              </div>
              <p className="text-xs text-gray-600 mt-3">Exemplo ilustrativo. Os números aparecem com as vendas da sua loja.</p>
            </div>
          </div>
        </section>

        {/* Preço */}
        <section id="precos" className="py-14 sm:py-20 bg-[#FFFBEB]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-3">Preço justo para loja pequena</h2>
              <p className="text-lg text-gray-700">Teste 30 dias grátis. Sem cartão de crédito.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {plans.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-3xl p-6 sm:p-8 border-2 ${p.highlight ? 'bg-[#065F46] text-white border-[#065F46] md:-translate-y-2 shadow-xl' : 'bg-white border-gray-950'}`}
                >
                  <h3 className="text-lg font-extrabold mb-2">{p.name}</h3>
                  <p className="text-4xl font-black mb-1">{p.price}</p>
                  <p className={`text-sm mb-6 ${p.highlight ? 'text-emerald-100' : 'text-gray-600'}`}>por mês</p>
                  <Link
                    to="/cadastro"
                    className={`inline-flex w-full items-center justify-center rounded-xl h-12 font-extrabold ${p.highlight ? 'bg-[#FBBF24] text-gray-950 hover:bg-[#F59E0B]' : 'bg-gray-950 text-white hover:bg-gray-800'}`}
                  >
                    Testar 30 dias grátis
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center mt-6">
              <Link to="/precos" className="font-bold text-[#087A54] underline underline-offset-4">Ver todos os detalhes dos planos</Link>
            </p>
          </div>
        </section>

        {/* Prova social: só aparece com depoimentos reais */}
        {testimonials.length > 0 && (
          <section id="depoimentos" className="py-14 sm:py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <figure key={t.name} className="rounded-2xl border-2 border-gray-200 p-6">
                  <blockquote className="text-gray-800">“{t.text}”</blockquote>
                  <figcaption className="mt-4 font-bold">{t.name} · {t.store}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="py-14 sm:py-20 bg-gray-100">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-8 text-center">Perguntas frequentes</h2>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <FaqItem key={f.q} q={f.q} a={f.a} id={`faq-${i}`} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-14 sm:py-20 bg-gradient-to-br from-[#0EA572] to-[#065F46]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">Pronto para vender mais?</h2>
            <p className="text-lg sm:text-xl text-emerald-50 mb-8">Comece agora com 30 dias grátis. Sem cartão de crédito.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/cadastro" className={ctaPrimary}>
                Criar minha conta grátis
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <a href={wa} {...waExternal} className={ctaWhatsApp}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Falar no WhatsApp
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-emerald-50 text-sm">
              {['30 dias grátis', 'Sem cartão', 'Cancele quando quiser'].map((t) => (
                <span key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contato" className="bg-gray-950 text-white pt-12 pb-28 sm:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4"><Logo light /></div>
              <p className="text-sm text-gray-300 mb-4">O caixa da sua loja, rápido e sem confusão.</p>
              <Link to="/login" className="inline-flex items-center gap-2 rounded-xl bg-white text-gray-950 px-4 h-11 font-extrabold hover:bg-gray-200">
                Entrar no sistema
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div>
              <h4 className="font-bold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#beneficios" className="hover:text-white">Benefícios</a></li>
                <li><Link to="/precos" className="hover:text-white">Preços</Link></li>
                <li><a href="#como-funciona" className="hover:text-white">Como funciona</a></li>
                <li><a href="#faq" className="hover:text-white">Perguntas frequentes</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                {/* Páginas ainda não existem: mantidas como itens, sem link quebrado. [CONFIRMAR: páginas institucionais] */}
                <li><span title="Em breve">Sobre nós</span></li>
                <li><a href={wa} {...waExternal} className="hover:text-white inline-flex items-center gap-1"><MessageCircle className="h-4 w-4" aria-hidden="true" />Contato</a></li>
                <li><span title="Em breve">Blog</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                {/* [CONFIRMAR: páginas de Termos, Privacidade e LGPD] */}
                <li><span title="Em breve">Termos de uso</span></li>
                <li><span title="Em breve">Privacidade</span></li>
                <li><span title="Em breve">LGPD</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4" aria-hidden="true" />[CONFIRMAR: e-mail de contato do Venddi]</span>
            <p>© 2026 Venddi. Um produto Mature Code. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Botão flutuante de WhatsApp */}
      <a
        href={wa}
        {...waExternal}
        aria-label={hasWhatsApp ? 'Falar no WhatsApp' : 'Contato (WhatsApp em breve)'}
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] text-gray-950 font-extrabold h-14 px-5 shadow-xl hover:bg-[#1EBE5B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/50"
      >
        <MessageCircle className="h-6 w-6" aria-hidden="true" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    </div>
  )
}
