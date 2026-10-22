'use client'
import { useEffect, useState } from 'react'
import { waLink } from '@/lib/site'

export default function Thanks() {
  const [q, setQ] = useState<URLSearchParams | null>(null)
  useEffect(() => setQ(new URLSearchParams(window.location.search)), [])
  const p = q?.get('p') ?? ''
  const href = waLink(`Olá! Sou ${q?.get('n') ?? ''}, da loja ${q?.get('l') ?? ''}. Acabei de pedir o teste grátis de 7 dias do Venddi${p ? ` (protocolo ${p})` : ''}.`)
  return (
    <section className="card">
      <h1>Recebemos seu pedido!</h1>
      {p && <p>Protocolo: <strong>{p}</strong></p>}
      <p>Vamos chamar você no WhatsApp para liberar o teste grátis por 7 dias.</p>
      {href ? <a className="btn" href={href} target="_blank" rel="noopener noreferrer">Falar agora no WhatsApp</a> : null}
      <p><a href="/">Voltar</a></p>
    </section>
  )
}
