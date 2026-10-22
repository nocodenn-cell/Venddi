import { z } from 'zod'

export const SEGMENTOS = ['Moda e acessórios', 'Mercadinho / conveniência', 'Variedades / importados', 'Cosméticos', 'Material de construção', 'Outro'] as const

export const leadSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome').max(80),
  whatsapp: z.string().transform((v) => v.replace(/\D/g, '')).refine((v) => /^\d{10,13}$/.test(v), 'WhatsApp com DDD, ex.: 81 99999-9999'),
  loja: z.string().trim().min(2, 'Informe o nome da loja').max(120),
  cidade: z.string().trim().min(2, 'Informe a cidade').max(80),
  segmento: z.enum(SEGMENTOS, { errorMap: () => ({ message: 'Escolha o segmento' }) }),
})
export type Lead = z.infer<typeof leadSchema>

export type Utm = { utm_source: string | null; utm_medium: string | null; utm_campaign: string | null }
export function readUtm(search: string): Utm {
  const p = new URLSearchParams(search)
  const g = (k: string) => (p.get(k)?.trim().slice(0, 100) || null)
  return { utm_source: g('utm_source'), utm_medium: g('utm_medium'), utm_campaign: g('utm_campaign') }
}

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeProtocol(d = new Date()): string {
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const r = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join('')
  return `VD-${ymd}-${r}`
}

/** Insere no hub comercial (commercial_leads). anon: só INSERT, sem SELECT (return=minimal). */
export async function insertLead(lead: Lead, utm: Utm): Promise<string> {
  const url = process.env.NEXT_PUBLIC_LEADS_SUPABASE_URL?.replace(/\/$/, '')
  const key = process.env.NEXT_PUBLIC_LEADS_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Cadastro indisponível no momento (configuração ausente).')
  const protocol = makeProtocol()
  const res = await fetch(`${url}/rest/v1/commercial_leads`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      protocol, product: 'venddi', name: lead.nome, store: lead.loja, contact: lead.whatsapp,
      channel: 'whatsapp', locale: 'pt-BR', city: lead.cidade, segment: lead.segmento, ...utm,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[venddi-lead] insert falhou', { status: res.status, detail: detail.slice(0, 300) })
    throw new Error('Não conseguimos enviar agora. Tente de novo ou fale no WhatsApp.')
  }
  return protocol
}
