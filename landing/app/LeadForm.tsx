'use client'
import { useState } from 'react'
import { trackLead } from '@/lib/track'
import { insertLead, leadSchema, readUtm, SEGMENTOS } from '@/lib/lead'

type Errors = Partial<Record<'nome' | 'whatsapp' | 'loja' | 'cidade' | 'segmento', string>>

export default function LeadForm() {
  const [errors, setErrors] = useState<Errors>({})
  const [msg, setMsg] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending) return
    setMsg(null)
    const form = new FormData(e.currentTarget)
    const parsed = leadSchema.safeParse(Object.fromEntries(form))
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors
      setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v?.[0]])) as Errors)
      return
    }
    setErrors({})
    setSending(true)
    try {
      const protocol = await insertLead(parsed.data, readUtm(window.location.search))
      trackLead()
      const q = new URLSearchParams({ p: protocol, n: parsed.data.nome, l: parsed.data.loja })
      window.location.assign(`/obrigado/?${q}`)
    } catch (err) {
      console.error('[venddi-lead] erro no envio:', err instanceof Error ? err.message : err)
      setMsg(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.')
    } finally {
      setSending(false) // o formulário nunca fica travado
    }
  }

  const field = (name: keyof Errors, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={name} aria-invalid={!!errors[name]} {...props} />{errors[name] && <small role="alert">{errors[name]}</small>}</label>
  )

  return (
    <form id="teste" onSubmit={onSubmit} noValidate className="card">
      <h2>Teste grátis por 7 dias</h2>
      {field('nome', 'Seu nome', { autoComplete: 'name' })}
      {field('whatsapp', 'WhatsApp (com DDD)', { inputMode: 'tel', autoComplete: 'tel', placeholder: '81 99999-9999' })}
      {field('loja', 'Nome da loja')}
      {field('cidade', 'Cidade', { placeholder: 'Camaragibe' })}
      <label>Segmento
        <select name="segmento" defaultValue="" aria-invalid={!!errors.segmento}>
          <option value="" disabled>Escolha…</option>
          {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
        </select>{errors.segmento && <small role="alert">{errors.segmento}</small>}
      </label>
      <button type="submit" disabled={sending}>{sending ? 'Enviando…' : 'Quero testar grátis'}</button>
      {msg && <p role="alert" className="err">{msg}</p>}
      <p className="muted"><small>Usamos seus dados só para contato sobre o teste. Podemos usar cookies de medição (Google/Meta) para melhorar nossos anúncios.</small></p>
    </form>
  )
}
