import { describe, it, expect } from 'vitest'
import { hasPermission, permissionsByRole } from '@/lib/schemas'

describe('hasPermission', () => {
  it('should grant all permissions to owner', () => {
    expect(hasPermission('owner', 'products.read')).toBe(true)
    expect(hasPermission('owner', 'products.write')).toBe(true)
    expect(hasPermission('owner', 'products.delete')).toBe(true)
    expect(hasPermission('owner', 'settings.write')).toBe(true)
    expect(hasPermission('owner', 'any.permission')).toBe(true)
  })

  it('should grant admin most permissions except company settings', () => {
    expect(hasPermission('admin', 'products.read')).toBe(true)
    expect(hasPermission('admin', 'products.write')).toBe(true)
    expect(hasPermission('admin', 'users.read')).toBe(true)
    expect(hasPermission('admin', 'users.write')).toBe(true)
    expect(hasPermission('admin', 'settings.read')).toBe(true)
    expect(hasPermission('admin', 'settings.write')).toBe(true)
  })

  it('should grant manager operational permissions', () => {
    expect(hasPermission('manager', 'products.read')).toBe(true)
    expect(hasPermission('manager', 'products.write')).toBe(true)
    expect(hasPermission('manager', 'sales.read')).toBe(true)
    expect(hasPermission('manager', 'sales.write')).toBe(true)
    expect(hasPermission('manager', 'financial.read')).toBe(true)
    expect(hasPermission('manager', 'reports.read')).toBe(true)
  })

  it('should restrict manager from user management', () => {
    expect(hasPermission('manager', 'users.write')).toBe(false)
  })

  it('should grant cashier limited permissions', () => {
    expect(hasPermission('cashier', 'products.read')).toBe(true)
    expect(hasPermission('cashier', 'sales.read')).toBe(true)
    expect(hasPermission('cashier', 'sales.write')).toBe(true)
    expect(hasPermission('cashier', 'cashier.read')).toBe(true)
    expect(hasPermission('cashier', 'cashier.write')).toBe(true)
  })

  it('should restrict cashier from financial and settings', () => {
    expect(hasPermission('cashier', 'financial.read')).toBe(false)
    expect(hasPermission('cashier', 'financial.write')).toBe(false)
    expect(hasPermission('cashier', 'settings.read')).toBe(false)
    expect(hasPermission('cashier', 'settings.write')).toBe(false)
  })

  it('should grant salesperson minimal permissions', () => {
    expect(hasPermission('salesperson', 'products.read')).toBe(true)
    expect(hasPermission('salesperson', 'customers.read')).toBe(true)
    expect(hasPermission('salesperson', 'customers.write')).toBe(true)
    expect(hasPermission('salesperson', 'sales.read')).toBe(true)
    expect(hasPermission('salesperson', 'sales.write')).toBe(true)
  })

  it('should restrict salesperson from stock and financial', () => {
    expect(hasPermission('salesperson', 'stock.read')).toBe(false)
    expect(hasPermission('salesperson', 'stock.write')).toBe(false)
    expect(hasPermission('salesperson', 'financial.read')).toBe(false)
    expect(hasPermission('salesperson', 'cashier.read')).toBe(false)
  })
})

describe('permissionsByRole', () => {
  it('should have owner with wildcard permission', () => {
    expect(permissionsByRole.owner).toContain('*')
  })

  it('should have all roles defined', () => {
    expect(permissionsByRole).toHaveProperty('owner')
    expect(permissionsByRole).toHaveProperty('admin')
    expect(permissionsByRole).toHaveProperty('manager')
    expect(permissionsByRole).toHaveProperty('cashier')
    expect(permissionsByRole).toHaveProperty('salesperson')
  })

  it('should have increasing permissions from salesperson to owner', () => {
    const salespersonPerms = permissionsByRole.salesperson.length
    const cashierPerms = permissionsByRole.cashier.length
    const managerPerms = permissionsByRole.manager.length
    const adminPerms = permissionsByRole.admin.length
    
    expect(cashierPerms).toBeGreaterThan(salespersonPerms)
    expect(managerPerms).toBeGreaterThan(cashierPerms)
    expect(adminPerms).toBeGreaterThan(managerPerms)
  })
})
