export type InviteLinkError = 'expired' | 'invalid' | null

/**
 * Lê o motivo de erro que o Supabase Auth coloca no fragmento da URL
 * (ex.: #error=access_denied&error_code=otp_expired) quando o link de convite falha.
 */
export function parseInviteLinkError(hash: string): InviteLinkError {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (params.get('error_code') === 'otp_expired') return 'expired'
  if (params.get('error')) return 'invalid'
  return null
}
