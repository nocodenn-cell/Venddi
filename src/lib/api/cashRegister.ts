import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentCompanyId } from '@/lib/store/auth'
import type { CashRegister, CashMovement } from '@/lib/schemas/sales'
import { v4 as uuidv4 } from 'uuid'

// Mock data for development
let mockCashRegisters: CashRegister[] = []
let mockCashMovements: CashMovement[] = []

/**
 * Abertura, sangria, suprimento e fechamento passam pelas RPCs da migration 029.
 * Cada chamada leva uma chave de idempotência: repetir a mesma chave (clique duplo, falha de rede
 * depois do commit) devolve o resultado original, sem gravar outra vez.
 */

export interface CloseCashResult {
  cashRegisterId: string
  expectedBalance: number
  finalAmount: number
  difference: number
  replay: boolean
}

export interface CashMovementResult {
  movementId: string
  balanceAfter: number
  replay: boolean
}

/** As RPCs escrevem mensagens em português para o operador; repassa a mensagem do banco. */
function operationError(error: { message: string }, fallback: string): Error {
  return new Error(error.message || fallback)
}

function mockExpectedBalance(cashRegister: CashRegister): number {
  return (
    cashRegister.initialAmount +
    cashRegister.totalSales +
    cashRegister.totalDeposits -
    cashRegister.totalWithdrawals
  )
}

/**
 * Open a new cash register
 */
export async function openCashRegister(params: {
  operatorId: string
  operatorName: string
  initialAmount: number
  notes?: string
  idempotencyKey: string
}): Promise<CashRegister> {
  const { operatorId, operatorName, initialAmount, notes, idempotencyKey } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check if there's already an open cash register for this operator
    const existingOpen = mockCashRegisters.find(
      (cr) => cr.operatorId === operatorId && cr.status === 'open'
    )
    if (existingOpen) {
      throw new Error('Já existe caixa aberto para este operador')
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

  const { data, error } = await supabase.rpc('abrir_caixa', {
    p_company_id: getCurrentCompanyId(),
    p_initial_amount: initialAmount,
    p_idempotency_key: idempotencyKey,
    p_notes: notes ?? null,
  })
  if (error) throw operationError(error, 'Erro ao abrir caixa')

  const result = data as { cash_register_id: string }
  return {
    id: result.cash_register_id,
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
}

/**
 * Close a cash register. Compara o valor contado com o saldo esperado e grava a diferença.
 * Divergência exige observação (a RPC recusa sem ela).
 */
export async function closeCashRegister(params: {
  cashRegisterId: string
  finalAmount: number
  notes?: string
  idempotencyKey: string
}): Promise<CloseCashResult> {
  const { cashRegisterId, finalAmount, notes, idempotencyKey } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    const cashRegister = mockCashRegisters.find((cr) => cr.id === cashRegisterId)
    if (!cashRegister) throw new Error('Caixa não encontrado')
    if (cashRegister.status === 'closed') throw new Error('Caixa já está fechado')

    const expectedBalance = mockExpectedBalance(cashRegister)
    const difference = finalAmount - expectedBalance
    if (difference !== 0 && !notes?.trim()) {
      throw new Error(`Fechamento com divergência de R$ ${difference} exige observação`)
    }

    cashRegister.status = 'closed'
    cashRegister.closingDate = new Date().toISOString()
    cashRegister.finalAmount = finalAmount
    cashRegister.closingNotes = notes

    return { cashRegisterId, expectedBalance, finalAmount, difference, replay: false }
  }

  const { data, error } = await supabase.rpc('fechar_caixa', {
    p_cash_register_id: cashRegisterId,
    p_final_amount: finalAmount,
    p_idempotency_key: idempotencyKey,
    p_notes: notes ?? null,
  })
  if (error) throw operationError(error, 'Erro ao fechar caixa')

  const result = data as {
    cash_register_id: string
    expected_balance: number
    final_amount: number
    difference: number
    replay: boolean
  }
  return {
    cashRegisterId: result.cash_register_id,
    expectedBalance: Number(result.expected_balance),
    finalAmount: Number(result.final_amount),
    difference: Number(result.difference),
    replay: result.replay,
  }
}

async function registerMovement(params: {
  cashRegisterId: string
  type: 'withdrawal' | 'deposit'
  amount: number
  description: string
  idempotencyKey: string
}): Promise<CashMovementResult> {
  const { cashRegisterId, type, amount, description, idempotencyKey } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    const cashRegister = mockCashRegisters.find((cr) => cr.id === cashRegisterId)
    if (!cashRegister) throw new Error('Caixa não encontrado')
    if (cashRegister.status === 'closed') throw new Error('Caixa fechado: movimento não registrado')

    const movement: CashMovement = {
      id: uuidv4(),
      cashRegisterId,
      companyId: getCurrentCompanyId(),
      operatorId: cashRegister.operatorId,
      type,
      amount,
      description,
      balanceAfter: 0,
      createdAt: new Date().toISOString(),
    }

    mockCashMovements.push(movement)
    if (type === 'withdrawal') cashRegister.totalWithdrawals += amount
    else cashRegister.totalDeposits += amount

    const balanceAfter = mockExpectedBalance(cashRegister)
    movement.balanceAfter = balanceAfter
    return { movementId: movement.id, balanceAfter, replay: false }
  }

  const { data, error } = await supabase.rpc('registrar_movimento_caixa', {
    p_cash_register_id: cashRegisterId,
    p_type: type,
    p_amount: amount,
    p_description: description,
    p_idempotency_key: idempotencyKey,
  })
  if (error) throw operationError(error, type === 'withdrawal' ? 'Erro ao registrar sangria' : 'Erro ao registrar suprimento')

  const result = data as { movement_id: string; balance_after: number; replay: boolean }
  return {
    movementId: result.movement_id,
    balanceAfter: Number(result.balance_after),
    replay: result.replay,
  }
}

/**
 * Register a cash withdrawal (sangria)
 */
export function registerWithdrawal(params: {
  cashRegisterId: string
  amount: number
  description: string
  idempotencyKey: string
}): Promise<CashMovementResult> {
  return registerMovement({ ...params, type: 'withdrawal' })
}

/**
 * Register a cash deposit (suprimento)
 */
export function registerDeposit(params: {
  cashRegisterId: string
  amount: number
  description: string
  idempotencyKey: string
}): Promise<CashMovementResult> {
  return registerMovement({ ...params, type: 'deposit' })
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
      operatorId: data.user_id,
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
      operatorId: row.operator_id ?? row.user_id,
      type: row.type,
      amount: row.amount,
      description: row.description,
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
 * Get open cash register for operator. Um operador tem no máximo um caixa aberto (índice único).
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
      .eq('user_id', operatorId)
      .eq('status', 'open')
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      companyId: data.company_id,
      operatorId: data.user_id,
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
