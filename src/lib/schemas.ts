import { z } from 'zod'

// ============================================
// Company Schema
// ============================================
export const companySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  tradeName: z.string().optional(),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
  stateRegistration: z.string().optional(),
  municipalRegistration: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional(),
  address: z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    city: z.string().optional(),
    state: z.string().length(2, 'UF deve ter 2 caracteres').optional(),
    zipCode: z.string().optional(),
  }).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('starter'),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Company = z.infer<typeof companySchema>

// ============================================
// User Schema
// ============================================
export const userRoleSchema = z.enum(['owner', 'admin', 'manager', 'cashier', 'salesperson'])
export type UserRole = z.infer<typeof userRoleSchema>

export const userSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  email: z.string().email('Email inválido'),
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  role: userRoleSchema,
  isActive: z.boolean().default(true),
  avatarUrl: z.string().url().optional(),
  lastLoginAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type User = z.infer<typeof userSchema>

// ============================================
// Auth Schemas
// ============================================
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Nome da empresa deve ter pelo menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>

// ============================================
// Permission Schema
// ============================================
export const permissionsByRole: Record<UserRole, string[]> = {
  owner: ['*'],
  admin: [
    'products.read', 'products.write', 'products.delete',
    'customers.read', 'customers.write', 'customers.delete',
    'suppliers.read', 'suppliers.write', 'suppliers.delete',
    'stock.read', 'stock.write', 'stock.adjust',
    'sales.read', 'sales.write', 'sales.cancel',
    'cashier.read', 'cashier.write', 'cashier.open', 'cashier.close',
    'financial.read', 'financial.write',
    'reports.read',
    'users.read', 'users.write',
    'settings.read', 'settings.write',
  ],
  manager: [
    'products.read', 'products.write',
    'customers.read', 'customers.write',
    'suppliers.read', 'suppliers.write',
    'stock.read', 'stock.write', 'stock.adjust',
    'sales.read', 'sales.write', 'sales.cancel',
    'cashier.read', 'cashier.write', 'cashier.open', 'cashier.close',
    'financial.read', 'financial.write',
    'reports.read',
    'users.read',
    'settings.read',
  ],
  cashier: [
    'products.read',
    'customers.read', 'customers.write',
    'stock.read',
    'sales.read', 'sales.write',
    'cashier.read', 'cashier.write', 'cashier.open', 'cashier.close',
  ],
  salesperson: [
    'products.read',
    'customers.read', 'customers.write',
    'sales.read', 'sales.write',
  ],
}

export function hasPermission(role: UserRole, permission: string): boolean {
  const rolePermissions = permissionsByRole[role]
  if (rolePermissions.includes('*')) return true
  return rolePermissions.includes(permission)
}
