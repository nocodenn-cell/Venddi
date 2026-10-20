// Contatos públicos do site comercial.
// O número do WhatsApp vem de VITE_WHATSAPP_NUMBER (somente dígitos, com DDI, ex.: 5511999999999).
// Enquanto não estiver configurado, os botões levam para a seção de contato do rodapé.
// [CONFIRMAR: WhatsApp]
const rawWhatsApp = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '') as string

export const WHATSAPP_NUMBER = rawWhatsApp.replace(/\D/g, '')
export const WHATSAPP_MESSAGE = 'Olá! Quero saber mais sobre o Venddi.'

export function whatsappHref(message: string = WHATSAPP_MESSAGE): string {
  if (!WHATSAPP_NUMBER) return '#contato'
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export const hasWhatsApp = WHATSAPP_NUMBER.length >= 10
