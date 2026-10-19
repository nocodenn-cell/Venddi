import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/schemas'

describe('loginSchema', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject short password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '123',
    })
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  it('should validate correct register data', () => {
    const result = registerSchema.safeParse({
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      companyName: 'My Company',
      cnpj: '12.345.678/0001-90',
    })
    expect(result.success).toBe(true)
  })

  it('should reject mismatched passwords', () => {
    const result = registerSchema.safeParse({
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'different',
      companyName: 'My Company',
      cnpj: '12.345.678/0001-90',
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid CNPJ format', () => {
    const result = registerSchema.safeParse({
      fullName: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      companyName: 'My Company',
      cnpj: '12345678000190',
    })
    expect(result.success).toBe(false)
  })

  it('should reject short full name', () => {
    const result = registerSchema.safeParse({
      fullName: 'Jo',
      email: 'john@example.com',
      password: 'password123',
      confirmPassword: 'password123',
      companyName: 'My Company',
      cnpj: '12.345.678/0001-90',
    })
    expect(result.success).toBe(false)
  })
})
