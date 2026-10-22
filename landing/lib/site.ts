export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://venddi.vercel.app').replace(/\/$/, '')
export const APP_URL = SITE_URL // PDV continua no app atual
const WA = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '') // TODO: definir na Vercel
export function waLink(msg: string): string | null {
  return /^\d{10,15}$/.test(WA) ? `https://wa.me/${WA}?text=${encodeURIComponent(msg)}` : null
}
export const KEYWORDS = ['sistema PDV', 'PDV para loja', 'frente de caixa', 'sistema PDV Camaragibe', 'PDV Recife', 'frente de caixa Pernambuco', 'PDV PE']
