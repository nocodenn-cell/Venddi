import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Sale, SaleItem, Payment } from '@/lib/schemas/sales'
import { v4 as uuidv4 } from 'uuid'

// Mock data for development
let mockSales: Sale[] = []
let mockSaleNumber = 1

/**
 * Create a new sale with atomic transaction
 */
export async function createSale(params: {
  idempotencyKey: string
  companyId: string
  items: SaleItem[]
  payments: Payment[]
  customerId?: string
  customerName?: string
  operatorId: string
  operatorName: string
  cashRegisterId?: string
  discount?: number
  additionalExpenses?: number
  notes?: string
}): Promise<Sale> {
  const {
    idempotencyKey,
    companyId,
    items,
    payments,
    customerId,
    customerName,
    operatorId,
    operatorName,
    cashRegisterId,
    discount = 0,
    additionalExpenses = 0,
    notes,
  } = params

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = subtotal - discount + additionalExpenses

  // Validate payments
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
  if (Math.abs(totalPayments - total) > 0.01) {
    throw new Error('Total dos pagamentos não corresponde ao total da venda')
  }

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    const newSale: Sale = {
      id: uuidv4(),
      companyId: 'cmp_001',
      saleNumber: mockSaleNumber++,
      customerId,
      customerName,
      operatorId,
      operatorName,
      cashRegisterId,
      items,
      payments,
      subtotal,
      discount,
      additionalExpenses,
      total,
      status: 'completed',
      notes,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }

    mockSales.push(newSale)
    return newSale
  }

  // Real Supabase implementation - ATOMIC TRANSACTION
  try {
    // Use atomic RPC function that handles everything in a single transaction
    const { data: result, error } = await supabase.rpc('create_atomic_sale', {
      p_company_id: companyId,
      p_operator_id: operatorId,
      p_cash_register_id: cashRegisterId,
      p_customer_id: customerId,
      p_items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      p_payments: payments.map((payment) => ({
        method: payment.method,
        amount: payment.amount,
        installments: payment.installments,
      })),
      p_discount: discount,
      p_additional_expenses: additionalExpenses,
      p_notes: notes,
      p_idempotency_key: idempotencyKey,
    })

    if (error) throw error
    if (!result.success) throw new Error(result.error || 'Erro ao criar venda')

    // Fetch the complete sale data
    const { data: saleData, error: fetchError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*),
        payments (*)
      `)
      .eq('id', result.sale_id)
      .single()

    if (fetchError) throw fetchError

    return {
      id: saleData.id,
      companyId: saleData.company_id,
      saleNumber: saleData.sale_number,
      customerId: saleData.customer_id,
      customerName,
      operatorId: saleData.operator_id,
      operatorName,
      cashRegisterId: saleData.cash_register_id,
      items: saleData.sale_items.map((item: any) => ({
        productId: item.product_id,
        productName: '', // Would need to join with products
        quantity: item.quantity,
        unitPrice: item.unit_price,
        discount: item.discount,
        subtotal: item.total,
      })),
      payments: saleData.payments.map((payment: any) => ({
        method: payment.method,
        amount: payment.amount,
        installments: payment.installments,
        changeAmount: 0,
      })),
      subtotal: saleData.subtotal,
      discount: saleData.discount,
      additionalExpenses: saleData.additional_expenses,
      total: saleData.total,
      status: saleData.status,
      notes: saleData.notes,
      createdAt: saleData.created_at,
      completedAt: saleData.sale_date,
    }
  } catch (error) {
    console.error('Error creating sale:', error)
    throw new Error('Erro ao criar venda')
  }
}

/**
 * Get sales with filters
 */
export async function getSales(params: {
  cashRegisterId?: string
  status?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<{ sales: Sale[]; total: number }> {
  const { cashRegisterId, status, startDate, endDate, limit = 50, offset = 0 } = params

  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))

    let filtered = [...mockSales]

    if (cashRegisterId) {
      filtered = filtered.filter((s) => s.cashRegisterId === cashRegisterId)
    }

    if (status) {
      filtered = filtered.filter((s) => s.status === status)
    }

    if (startDate) {
      filtered = filtered.filter((s) => s.createdAt >= startDate)
    }

    if (endDate) {
      filtered = filtered.filter((s) => s.createdAt <= endDate)
    }

    const paginated = filtered.slice(offset, offset + limit)

    return { sales: paginated, total: filtered.length }
  }

  // Real Supabase implementation
  try {
    let query = supabase.from('sales').select('*', { count: 'exact' })

    if (cashRegisterId) {
      query = query.eq('cash_register_id', cashRegisterId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (startDate) {
      query = query.gte('sale_date', startDate)
    }

    if (endDate) {
      query = query.lte('sale_date', endDate)
    }

    query = query.range(offset, offset + limit - 1).order('sale_date', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error

    const sales: Sale[] = (data || []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      saleNumber: row.sale_number,
      customerId: row.customer_id,
      customerName: '', // Would need to join with customers
      operatorId: row.operator_id,
      operatorName: '', // Would need to join with users
      cashRegisterId: row.cash_register_id,
      items: [], // Would need to join with sale_items
      payments: [], // Would need to join with payments
      subtotal: row.subtotal,
      discount: row.discount,
      additionalExpenses: row.additional_expenses,
      total: row.total,
      status: row.status,
      notes: row.notes,
      createdAt: row.created_at,
      completedAt: row.sale_date,
    }))

    return { sales, total: count || 0 }
  } catch (error) {
    console.error('Error fetching sales:', error)
    throw new Error('Erro ao carregar vendas')
  }
}

/**
 * Cancel a sale
 */
export async function cancelSale(saleId: string, reason: string): Promise<Sale> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))

    const sale = mockSales.find((s) => s.id === saleId)
    if (!sale) throw new Error('Venda não encontrada')

    sale.status = 'cancelled'
    sale.cancelledAt = new Date().toISOString()
    sale.cancellationReason = reason

    return sale
  }

  // Real Supabase implementation - ATOMIC CANCELLATION
  try {
    // Use atomic RPC function that handles full reversal
    const { data: result, error } = await supabase.rpc('cancel_sale_with_reversal', {
      p_sale_id: saleId,
      p_company_id: 'cmp_001', // Would come from auth context
      p_operator_id: 'usr_001', // Would come from auth context
      p_reason: reason,
    })

    if (error) throw error
    if (!result.success) throw new Error(result.error || 'Erro ao cancelar venda')

    // Fetch the updated sale data
    const { data: saleData, error: fetchError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .single()

    if (fetchError) throw fetchError

    return {
      id: saleData.id,
      companyId: saleData.company_id,
      saleNumber: saleData.sale_number,
      customerId: saleData.customer_id,
      operatorId: saleData.operator_id,
      operatorName: '',
      cashRegisterId: saleData.cash_register_id,
      items: [],
      payments: [],
      subtotal: saleData.subtotal,
      discount: saleData.discount,
      additionalExpenses: saleData.additional_expenses,
      total: saleData.total,
      status: saleData.status,
      notes: saleData.notes,
      createdAt: saleData.created_at,
      completedAt: saleData.sale_date,
      cancelledAt: saleData.cancelled_at,
      cancellationReason: saleData.cancellation_reason,
    }
  } catch (error) {
    console.error('Error cancelling sale:', error)
    throw new Error('Erro ao cancelar venda')
  }
}
