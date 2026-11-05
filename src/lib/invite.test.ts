import { describe, it, expect } from 'vitest'
import { parseInviteLinkError } from './invite'

describe('parseInviteLinkError', () => {
  it('reconhece link expirado', () => {
    expect(parseInviteLinkError('#error=access_denied&error_code=otp_expired&error_description=expired')).toBe('expired')
  })

  it('reconhece outros erros como inválidos', () => {
    expect(parseInviteLinkError('#error=server_error&error_code=unexpected_failure')).toBe('invalid')
  })

  it('retorna null sem erro no fragmento', () => {
    expect(parseInviteLinkError('#access_token=abc&type=invite')).toBeNull()
    expect(parseInviteLinkError('')).toBeNull()
  })
})
