import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { FinancialAccount, FinancialCategory } from '@/lib/schemas/sales'
import { v4 as uuidv4 } from 'uuid'

// Mock data for development
let mockFinancialAccounts: FinancialAccount[] = []
let mockFinancialCategories: FinancialCategory[] = [
  {
    id: 'cat_001',
    companyId: 'cmp_001',
    name: 'Vendas',
    type: 'income',
    color: '#0EA572',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_002',
    companyId: 'cmp_001',
    name: 'Aluguel',
    type: 'expense',
    color: '#EF4444',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'cat_003',
    companyId: 'cmp_001',
    name: 'Fornecedores',
    type: 'expense',
    color: '#F59E0B',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
]

/**
 * Create a financial account (payable or receivable)
 */
export async function createFinancialAccount(params: {
  type: 'payable' | 'receivable'
  description: string
  amount: number
  dueDate: string
  category: string
  personId?: string
  personType?: 'customer' | 'supplier'
  referenceType?: string
  referenceId?: string
  notes?: string
}): Promise<FinancialAccount> {
  const {
    type,
    description,
    amount,
    dueDate,
    category,
    personId,
    personType,
    referenceType,
    referenceId,
    notes,
  } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    const newAccount: FinancialAccount = {
      id: uuidv4(),
      companyId: 'cmp_001',
      type,
      description,
      category,
      amount,
      paidAmount: 0,
      dueDate,
      status: 'pending',
      personId,
      personType,
      referenceType,
      referenceId,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    mockFinancialAccounts.push(newAccount)
    return newAccount
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('financial_accounts')
      .insert({
        company_id: 'cmp_001',
        type,
        description,
        amount,
        due_date: dueDate,
        category,
        status: 'pending',
        person_id: personId,
        person_type: personType,
        reference_type: referenceType,
        reference_id: referenceId,
        notes,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      type: data.type,
      description: data.description,
      category: data.category,
      amount: data.amount,
      paidAmount: data.paid_amount,
      dueDate: data.due_date,
      status: data.status,
      personId: data.person_id,
      personType: data.person_type,
      referenceType: data.reference_type,
      referenceId: data.reference_id,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error creating financial account:', error)
    throw new Error('Erro ao criar conta financeira')
  }
}

/**
 * Pay a financial account (mark as paid)
 */
export async function payFinancialAccount(params: {
  accountId: string
  paidAmount: number
  paidAt: string
  notes?: string
}): Promise<FinancialAccount> {
  const { accountId, paidAmount, paidAt, notes } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    const account = mockFinancialAccounts.find((a) => a.id === accountId)
    if (!account) throw new Error('Conta não encontrada')

    account.paidAmount = paidAmount
    account.paidAt = paidAt
    account.status = paidAmount >= account.amount ? 'paid' : 'pending'
    account.updatedAt = new Date().toISOString()

    return account
  }

  // Real Supabase implementation
  try {
    const account = mockFinancialAccounts.find((a) => a.id === accountId)
    if (!account) throw new Error('Conta não encontrada')

    const newStatus = paidAmount >= account.amount ? 'paid' : 'pending'

    const { data, error } = await supabase
      .from('financial_accounts')
      .update({
        paid_amount: paidAmount,
        paid_at: paidAt,
        status: newStatus,
        notes: notes || account.notes,
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      type: data.type,
      description: data.description,
      category: data.category,
      amount: data.amount,
      paidAmount: data.paid_amount,
      dueDate: data.due_date,
      paidAt: data.paid_at,
      status: data.status,
      personId: data.person_id,
      personType: data.person_type,
      referenceType: data.reference_type,
      referenceId: data.reference_id,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error paying financial account:', error)
    throw new Error('Erro ao pagar conta')
  }
}

/**
 * Get financial accounts with filters
 */
export async function getFinancialAccounts(params: {
  type?: 'payable' | 'receivable'
  status?: string
  startDate?: string
  endDate?: string
  category?: string
}): Promise<FinancialAccount[]> {
  const { type, status, startDate, endDate, category } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    let filtered = [...mockFinancialAccounts]

    if (type) {
      filtered = filtered.filter((a) => a.type === type)
    }

    if (status) {
      filtered = filtered.filter((a) => a.status === status)
    }

    if (startDate) {
      filtered = filtered.filter((a) => a.dueDate >= startDate)
    }

    if (endDate) {
      filtered = filtered.filter((a) => a.dueDate <= endDate)
    }

    if (category) {
      filtered = filtered.filter((a) => a.category === category)
    }

    return filtered
  }

  // Real Supabase implementation
  try {
    let query = supabase.from('financial_accounts').select('*')

    if (type) {
      query = query.eq('type', type)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('due_date', startDate)
    }

    if (endDate) {
      query = query.lte('due_date', endDate)
    }

    if (category) {
      query = query.eq('category', category)
    }

    query = query.order('due_date', { ascending: true })

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      type: row.type,
      description: row.description,
      category: row.category,
      amount: row.amount,
      paidAmount: row.paid_amount,
      dueDate: row.due_date,
      paidAt: row.paid_at,
      status: row.status,
      personId: row.person_id,
      personType: row.person_type,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (error) {
    console.error('Error fetching financial accounts:', error)
    throw new Error('Erro ao carregar contas financeiras')
  }
}

/**
 * Get financial categories
 */
export async function getFinancialCategories(type?: 'income' | 'expense'): Promise<FinancialCategory[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 200))

    let filtered = [...mockFinancialCategories]

    if (type) {
      filtered = filtered.filter((c) => c.type === type)
    }

    return filtered
  }

  // Real Supabase implementation
  try {
    let query = supabase.from('financial_categories').select('*').eq('is_active', true)

    if (type) {
      query = query.eq('type', type)
    }

    query = query.order('name')

    const { data, error } = await query
    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      type: row.type,
      color: row.color,
      isActive: row.is_active,
      createdAt: row.created_at,
    }))
  } catch (error) {
    console.error('Error fetching financial categories:', error)
    throw new Error('Erro ao carregar categorias financeiras')
  }
}

/**
 * Calculate cash flow for a period
 */
export async function calculateCashFlow(params: {
  startDate: string
  endDate: string
}): Promise<{
  initialBalance: number
  totalIncome: number
  totalExpenses: number
  finalBalance: number
  movements: FinancialAccount[]
}> {
  const { startDate, endDate } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 400))

    const accounts = mockFinancialAccounts.filter(
      (a) => a.dueDate >= startDate && a.dueDate <= endDate && a.status === 'paid'
    )

    const income = accounts
      .filter((a) => a.type === 'receivable')
      .reduce((sum, a) => sum + a.paidAmount, 0)

    const expenses = accounts
      .filter((a) => a.type === 'payable')
      .reduce((sum, a) => sum + a.paidAmount, 0)

    return {
      initialBalance: 0,
      totalIncome: income,
      totalExpenses: expenses,
      finalBalance: income - expenses,
      movements: accounts,
    }
  }

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('*')
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .eq('status', 'paid')

    if (error) throw error

    const accounts = data || []

    const income = accounts
      .filter((a) => a.type === 'receivable')
      .reduce((sum, a) => sum + a.paid_amount, 0)

    const expenses = accounts
      .filter((a) => a.type === 'payable')
      .reduce((sum, a) => sum + a.paid_amount, 0)

    return {
      initialBalance: 0,
      totalIncome: income,
      totalExpenses: expenses,
      finalBalance: income - expenses,
      movements: accounts.map((row) => ({
        id: row.id,
        companyId: row.company_id,
        type: row.type,
        description: row.description,
        category: row.category,
        amount: row.amount,
        paidAmount: row.paid_amount,
        dueDate: row.due_date,
        paidAt: row.paid_at,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    }
  } catch (error) {
    console.error('Error calculating cash flow:', error)
    throw new Error('Erro ao calcular fluxo de caixa')
  }
}
