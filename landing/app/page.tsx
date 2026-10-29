import LeadForm from './LeadForm'
import OldHome from '@/components/OldHome'
import { SITE_URL } from '@/lib/site'

const dores = ['Fila no caixa porque o sistema é lento ou complicado', 'Não saber quanto vendeu nem quanto sobrou no fim do dia', 'Produto acabando sem ninguém perceber', 'Fechamento de caixa no caderno, com diferença que ninguém explica']
// Somente funcionalidades existentes no código do Venddi (src/).
const recursos = [
  ['Frente de caixa (PDV)', 'Venda rápida com leitor de código de barras, busca de produtos e modo de venda contínua.'],
  ['Abertura e fechamento de caixa', 'Controle do caixa do turno com conferência no fechamento.'],
  ['Estoque com alerta', 'Aviso de estoque baixo para repor antes de faltar.'],
  ['Financeiro e painel', 'Gráfico de vendas e visão do financeiro da loja.'],
  ['Impressora térmica e gaveta', 'Cupom na impressora térmica e abertura da gaveta de dinheiro.'],
  ['Atalhos e exportação', 'Atalhos de teclado no caixa e exportação dos dados.'],
] as const
const planos = [['Básico', 79], ['Profissional', 149], ['Premium', 249]] as const
const faq = [
  ['Preciso de cartão para testar?', 'Não. Você preenche o formulário e nossa equipe libera o teste grátis por 7 dias.'],
  ['Funciona no computador que já tenho?', 'Sim, o Venddi roda no navegador.'],
  ['Funciona com leitor de código de barras?', 'Sim, o PDV aceita leitor de código de barras.'],
  ['Atendem fora de Camaragibe e Recife?', 'Sim. Começamos em Pernambuco e atendemos lojas de todo o Brasil.'],
] as const

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Venddi',
  applicationCategory: 'BusinessApplication', operatingSystem: 'Web', url: SITE_URL, inLanguage: 'pt-BR',
  description: 'Sistema PDV e frente de caixa para loja em Camaragibe, Recife e Pernambuco.',
  areaServed: ['Camaragibe', 'Recife', 'Pernambuco', 'Brasil'],
  offers: planos.map(([name, price]) => ({ '@type': 'Offer', name, price, priceCurrency: 'BRL' })),
}

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <OldHome middle={<>
        <section className="py-20 bg-white"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 text-center">Isso acontece na sua loja?</h2>
          <ul className="grid md:grid-cols-2 gap-4 mt-8">{dores.map((d) => <li key={d} className="p-4 rounded-xl border border-gray-100 bg-gray-50 text-gray-700">{d}</li>)}</ul>
        </div></section>
        <section className="py-20 bg-gray-50"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-12 text-center">Planos</h2>
          <div className="grid md:grid-cols-3 gap-6">{planos.map(([n, p]) => <article key={n} className="bg-white p-8 rounded-2xl border border-gray-100 text-center">
            <h3 className="text-lg font-semibold text-gray-900">{n}</h3>
            <p className="text-4xl font-bold text-gray-900 my-4">R$ {p}<small className="text-base text-gray-500">/mês</small></p>
            <a href="#teste" className="inline-flex h-12 px-6 items-center rounded-lg bg-[#0EA572] text-white font-medium hover:bg-[#087A54]">Teste grátis por 7 dias</a>
          </article>)}</div>
          <p className="text-center mt-6"><a href="/precos" className="text-[#0EA572] hover:underline">Ver detalhes dos planos</a></p>
        </div></section>
        {/* PROVA SOCIAL: placeholder. Não publicar depoimentos ou números sem autorização real do cliente. */}
        <section className="py-12 bg-white text-center"><h2 className="text-2xl font-bold text-gray-900">Quem usa</h2><p className="text-gray-500 mt-2">Em breve: depoimentos de lojistas reais.</p></section>
        <section className="py-20 bg-gray-50"><div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Perguntas frequentes</h2>
          {faq.map(([q, a]) => <details key={q} className="bg-white border border-gray-100 rounded-xl p-4 mb-3"><summary className="font-medium cursor-pointer">{q}</summary><p className="text-gray-600 mt-2">{a}</p></details>)}
        </div></section>
        <section className="py-20 bg-white"><div className="max-w-xl mx-auto px-4"><LeadForm /></div></section>
      </>} />
    </>
  )
}
