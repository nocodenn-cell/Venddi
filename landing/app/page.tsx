import LeadForm from './LeadForm'
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
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <h1>Gestão simples para vender mais</h1>
        <p>Sistema PDV e frente de caixa para loja em Camaragibe, Recife e todo PE.</p>
        <a className="btn" href="#teste">Teste grátis por 7 dias</a>
      </section>
      <section><h2>Isso acontece na sua loja?</h2><ul>{dores.map((d) => <li key={d}>{d}</li>)}</ul></section>
      <section><h2>O que o Venddi faz</h2><div className="grid">{recursos.map(([t, d]) => <article key={t} className="card"><h3>{t}</h3><p>{d}</p></article>)}</div></section>
      <section><h2>Planos</h2><div className="grid">{planos.map(([n, p]) => <article key={n} className="card"><h3>{n}</h3><p className="price">R$ {p}<small>/mês</small></p><a className="btn" href="#teste">Teste grátis por 7 dias</a></article>)}</div></section>
      {/* PROVA SOCIAL: placeholder. Não publicar depoimentos ou números sem autorização real do cliente. */}
      <section><h2>Quem usa</h2><p className="muted">Em breve: depoimentos de lojistas reais.</p></section>
      <section><h2>Perguntas frequentes</h2>{faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
      <section><LeadForm /></section>
      <footer>© Venddi · Nature Code · Camaragibe/Recife-PE</footer>
    </main>
  )
}
