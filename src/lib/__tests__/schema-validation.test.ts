import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/schemas'

describe('Validações de Schema', () => {
  describe('loginSchema', () => {
    it('deve validar login correto', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('deve rejeitar email inválido', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar senha muito curta', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '123',
      })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar email vazio', () => {
      const result = loginSchema.safeParse({
        email: '',
        password: 'password123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    it('deve validar registro correto', () => {
      const result = registerSchema.safeParse({
        fullName: 'João Silva',
        email: 'joao@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        companyName: 'Loja do João',
        cnpj: '12.345.678/0001-90',
      })
      expect(result.success).toBe(true)
    })

    it('deve rejeitar senhas diferentes', () => {
      const result = registerSchema.safeParse({
        fullName: 'João Silva',
        email: 'joao@example.com',
        password: 'password123',
        confirmPassword: 'different',
        companyName: 'Loja do João',
        cnpj: '12.345.678/0001-90',
      })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar CNPJ inválido', () => {
      const result = registerSchema.safeParse({
        fullName: 'João Silva',
        email: 'joao@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        companyName: 'Loja do João',
        cnpj: '12345678000190', // Sem formatação
      })
      expect(result.success).toBe(false)
    })

    it('deve rejeitar nome muito curto', () => {
      const result = registerSchema.safeParse({
        fullName: 'Jo',
        email: 'joao@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        companyName: 'Loja do João',
        cnpj: '12.345.678/0001-90',
      })
      expect(result.success).toBe(false)
    })

    it('deve validar CNPJ com formatação correta', () => {
      const result = registerSchema.safeParse({
        fullName: 'João Silva',
        email: 'joao@example.com',
        password: 'password123',
        confirmPassword: 'password123',
        companyName: 'Loja do João',
        cnpj: '12.345.678/0001-90',
      })
      expect(result.success).toBe(true)
    })
  })
})
