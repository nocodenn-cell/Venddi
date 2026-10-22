import type { Metadata } from 'next'
import { KEYWORDS, SITE_URL } from '@/lib/site'
import './globals.css'

const title = 'Venddi · Sistema PDV e frente de caixa para loja em Camaragibe, Recife e PE'
const description = 'Gestão simples para vender mais: PDV para loja com frente de caixa, leitor de código de barras, estoque e financeiro. Teste grátis por 7 dias.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title, description, keywords: KEYWORDS,
  alternates: { canonical: '/' },
  openGraph: { type: 'website', locale: 'pt_BR', url: SITE_URL, siteName: 'Venddi', title, description },
  twitter: { card: 'summary_large_image', title, description },
  robots: { index: true, follow: true },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>
}
