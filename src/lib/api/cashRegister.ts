import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentCompanyId } from '@/lib/store/auth'
import type { CashRegister, CashMovement } from '@/lib/schemas/sales'
import { v4 as uuidv4 } from 'uuid'

// Mock data for development
let mockCashRegisters: CashRegister[] = []
let mockCashMovements: CashMovement[] = []

/**
 * Open a new cash register
 */
export async function openCashRegister(params: {
  operatorId: string
  operatorName: string
  initialAmount: number
  notes?: string
}): Promise<CashRegister> {
  const { operatorId, operatorName, initialAmount, notes } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check if there's already an open cash register for this operator
    const existingOpen = mockCashRegisters.find(
      (cr) => cr.operatorId === operatorId && cr.status === 'open'
    )
    if (existingOpen) {
      throw new Error('Já existe um caixa aberto para este operador')
    }

    const newCashRegister: CashRegister = {
      id: uuidv4(),
      companyId: getCurrentCompanyId(),
      operatorId,
      operatorName,
      status: 'open',
      openingDate: new Date().toISOString(),
      initialAmount,
      totalSales: 0,
      totalWithdrawals: 0,
      totalDeposits: 0,
      openingNotes: notes,
    }

    mockCashRegisters.push(newCashRegister)
    return newCashRegister
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_registers')
      .insert({
        company_id: getCurrentCompanyId(),
        operator_id: operatorId,
        status: 'open',
        initial_amount: initialAmount,
        opened_at: new Date().toISOString(),
        opening_notes: notes,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      operatorName,
      status: data.status,
      openingDate: data.opened_at,
      initialAmount: data.initial_amount,
      totalSales: 0,
      totalWithdrawals: 0,
      totalDeposits: 0,
      openingNotes: data.opening_notes,
    }
  } catch (error) {
    console.error('Error opening cash register:', error)
    throw new Error('Erro ao abrir caixa')
  }
}

/**
 * Close a cash register
 */
export async function closeCashRegister(params: {
  cashRegisterId: string
  finalAmount: number
  notes?: string
}): Promise<CashRegister> {
  const { cashRegisterId, finalAmount, notes } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    const cashRegister = mockCashRegisters.find((cr) => cr.id === cashRegisterId)
    if (!cashRegister) throw new Error('Caixa não encontrado')
    if (cashRegister.status === 'closed') throw new Error('Caixa já está fechado')

    cashRegister.status = 'closed'
    cashRegister.closingDate = new Date().toISOString()
    cashRegister.finalAmount = finalAmount
    cashRegister.closingNotes = notes

    return cashRegister
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_registers')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        final_amount: finalAmount,
        closing_notes: notes,
      })
      .eq('id', cashRegisterId)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      operatorName: '',
      status: data.status,
      openingDate: data.opened_at,
      closingDate: data.closed_at,
      initialAmount: data.initial_amount,
      finalAmount: data.final_amount,
      totalSales: data.total_sales,
      totalWithdrawals: data.total_withdrawals,
      totalDeposits: data.total_deposits,
      openingNotes: data.opening_notes,
      closingNotes: data.closing_notes,
    }
  } catch (error) {
    console.error('Error closing cash register:', error)
    throw new Error('Erro ao fechar caixa')
  }
}

/**
 * Register a cash withdrawal (sangria)
 */
export async function registerWithdrawal(params: {
  cashRegisterId: string
  operatorId: string
  amount: number
  description: string
  category?: string
}): Promise<CashMovement> {
  const { cashRegisterId, operatorId, amount, description, category } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    const cashRegister = mockCashRegisters.find((cr) => cr.id === cashRegisterId)
    if (!cashRegister) throw new Error('Caixa não encontrado')
    if (cashRegister.status === 'closed') throw new Error('Caixa está fechado')

    const movement: CashMovement = {
      id: uuidv4(),
      cashRegisterId,
      companyId: getCurrentCompanyId(),
      operatorId,
      type: 'withdrawal',
      amount,
      description,
      category,
      balanceAfter: 0, // Would need to calculate
      createdAt: new Date().toISOString(),
    }

    mockCashMovements.push(movement)
    cashRegister.totalWithdrawals += amount

    return movement
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_movements')
      .insert({
        cash_register_id: cashRegisterId,
        company_id: getCurrentCompanyId(),
        operator_id: operatorId,
        type: 'withdrawal',
        amount,
        description,
        category,
        balance_after: 0,
      })
      .select()
      .single()

    if (error) throw error

    // Update cash register total
    await supabase
      .from('cash_registers')
      .update({
        total_withdrawals: supabase.rpc('increment_total_withdrawals', {
          p_cash_register_id: cashRegisterId,
          p_amount: amount,
        }),
      })
      .eq('id', cashRegisterId)

    return {
      id: data.id,
      cashRegisterId: data.cash_register_id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      balanceAfter: data.balance_after,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error registering withdrawal:', error)
    throw new Error('Erro ao registrar sangria')
  }
}

/**
 * Register a cash deposit (suprimento)
 */
export async function registerDeposit(params: {
  cashRegisterId: string
  operatorId: string
  amount: number
  description: string
  category?: string
}): Promise<CashMovement> {
  const { cashRegisterId, operatorId, amount, description, category } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    const cashRegister = mockCashRegisters.find((cr) => cr.id === cashRegisterId)
    if (!cashRegister) throw new Error('Caixa não encontrado')
    if (cashRegister.status === 'closed') throw new Error('Caixa está fechado')

    const movement: CashMovement = {
      id: uuidv4(),
      cashRegisterId,
      companyId: getCurrentCompanyId(),
      operatorId,
      type: 'deposit',
      amount,
      description,
      category,
      balanceAfter: 0,
      createdAt: new Date().toISOString(),
    }

    mockCashMovements.push(movement)
    cashRegister.totalDeposits += amount

    return movement
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_movements')
      .insert({
        cash_register_id: cashRegisterId,
        company_id: getCurrentCompanyId(),
        operator_id: operatorId,
        type: 'deposit',
        amount,
        description,
        category,
        balance_after: 0,
      })
      .select()
      .single()

    if (error) throw error

    // Update cash register total
    await supabase
      .from('cash_registers')
      .update({
        total_deposits: supabase.rpc('increment_total_deposits', {
          p_cash_register_id: cashRegisterId,
          p_amount: amount,
        }),
      })
      .eq('id', cashRegisterId)

    return {
      id: data.id,
      cashRegisterId: data.cash_register_id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      balanceAfter: data.balance_after,
      createdAt: data.created_at,
    }
  } catch (error) {
    console.error('Error registering deposit:', error)
    throw new Error('Erro ao registrar suprimento')
  }
}

/**
 * Get cash register by ID
 */
export async function getCashRegister(cashRegisterId: string): Promise<CashRegister | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 200))
    return mockCashRegisters.find((cr) => cr.id === cashRegisterId) || null
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('id', cashRegisterId)
      .single()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      operatorName: '',
      status: data.status,
      openingDate: data.opened_at,
      closingDate: data.closed_at,
      initialAmount: data.initial_amount,
      finalAmount: data.final_amount,
      totalSales: data.total_sales,
      totalWithdrawals: data.total_withdrawals,
      totalDeposits: data.total_deposits,
      openingNotes: data.opening_notes,
      closingNotes: data.closing_notes,
    }
  } catch (error) {
    console.error('Error fetching cash register:', error)
    throw new Error('Erro ao carregar caixa')
  }
}

/**
 * Get cash movements for a cash register
 */
export async function getCashMovements(cashRegisterId: string): Promise<CashMovement[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 200))
    return mockCashMovements.filter((m) => m.cashRegisterId === cashRegisterId)
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('cash_register_id', cashRegisterId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      cashRegisterId: row.cash_register_id,
      companyId: row.company_id,
      operatorId: row.operator_id,
      type: row.type,
      amount: row.amount,
      description: row.description,
      category: row.category,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      balanceAfter: row.balance_after,
      createdAt: row.created_at,
    }))
  } catch (error) {
    console.error('Error fetching cash movements:', error)
    throw new Error('Erro ao carregar movimentações')
  }
}

/**
 * Get open cash register for operator
 */
export async function getOpenCashRegister(operatorId: string): Promise<CashRegister | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 200))
    return (
      mockCashRegisters.find((cr) => cr.operatorId === operatorId && cr.status === 'open') || null
    )
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('cash_registers')
      .select('*')
      .eq('operator_id', operatorId)
      .eq('status', 'open')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows returned
      throw error
    }

    if (!data) return null

    return {
      id: data.id,
      companyId: data.company_id,
      operatorId: data.operator_id,
      operatorName: '',
      status: data.status,
      openingDate: data.opened_at,
      initialAmount: data.initial_amount,
      totalSales: data.total_sales,
      totalWithdrawals: data.total_withdrawals,
      totalDeposits: data.total_deposits,
      openingNotes: data.opening_notes,
    }
  } catch (error) {
    console.error('Error fetching open cash register:', error)
    throw new Error('Erro ao carregar caixa aberto')
  }
}

export interface CashClosingReport {
  cashRegisterId: string
  status: 'open' | 'closed'
  openedAt: string
  closedAt: string | null
  operatorName: string
  initialAmount: number
  salesCount: number
  salesTotal: number
  cancelledCount: number
  cancelledTotal: number
  paymentsByMethod: Record<string, number>
  withdrawals: number
  deposits: number
  refunds: number
  expectedCash: number
  informedCash: number | null
  difference: number | null
  cashConsistent: boolean
}

function mapClosing(row: any): CashClosingReport {
  return {
    cashRegisterId: row.cash_register_id,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? null,
    operatorName: row.operator_name ?? '',
    initialAmount: Number(row.initial_amount),
    salesCount: Number(row.sales_count),
    salesTotal: Number(row.sales_total),
    cancelledCount: Number(row.cancelled_count),
    cancelledTotal: Number(row.cancelled_total),
    paymentsByMethod: Object.fromEntries(
      Object.entries(row.payments_by_method ?? {}).map(([k, v]) => [k, Number(v)])
    ),
    withdrawals: Number(row.withdrawals),
    deposits: Number(row.deposits),
    refunds: Number(row.refunds),
    expectedCash: Number(row.expected_cash),
    informedCash: row.informed_cash === null || row.informed_cash === undefined ? null : Number(row.informed_cash),
    difference: row.difference === null || row.difference === undefined ? null : Number(row.difference),
    cashConsistent: row.cash_consistent === true,
  }
}

/**
 * Fechamento de um caixa (RPC relatorio_fechamento_caixa). O próprio operador ou owner/admin/manager.
 */
export async function getCashClosingReport(cashRegisterId: string): Promise<CashClosingReport | null> {
  if (!isSupabaseConfigured || !supabase) return null

  const { data, error } = await supabase.rpc('relatorio_fechamento_caixa', {
    p_cash_register_id: cashRegisterId,
  })
  if (error) throw new Error(error.message)
  return data ? mapClosing(data) : null
}

/**
 * Fechamentos dos caixas abertos no período (RPC relatorio_caixas_periodo).
 * Só owner, admin e manager.
 */
export async function getCashClosingPeriod(start: Date, end: Date): Promise<CashClosingReport[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase.rpc('relatorio_caixas_periodo', {
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  })
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapClosing)
}
