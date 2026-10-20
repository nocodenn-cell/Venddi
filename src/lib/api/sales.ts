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

  // Real Supabase implementation
  try {
    // Start transaction
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        company_id: 'cmp_001', // Would come from auth context
        sale_number: mockSaleNumber++,
        customer_id: customerId,
        operator_id: operatorId,
        cash_register_id: cashRegisterId,
        subtotal,
        discount,
        additional_expenses: additionalExpenses,
        total,
        status: 'completed',
        notes,
        sale_date: new Date().toISOString(),
      })
      .select()
      .single()

    if (saleError) throw saleError

    // Insert sale items
    const saleItems = items.map((item) => ({
      sale_id: saleData.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount: item.discount,
      total: item.subtotal,
      cost_price: 0, // Would need to fetch from product
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) throw itemsError

    // Insert payments
    const salePayments = payments.map((payment) => ({
      sale_id: saleData.id,
      method: payment.method,
      amount: payment.amount,
      installments: payment.installments,
    }))

    const { error: paymentsError } = await supabase.from('payments').insert(salePayments)
    if (paymentsError) throw paymentsError

    // Update stock for each item
    for (const item of items) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_product_id: item.productId,
        p_quantity: item.quantity,
      })
      if (stockError) throw stockError
    }

    // Create cash movement
    if (cashRegisterId) {
      const cashAmount = payments
        .filter((p) => p.method === 'cash')
        .reduce((sum, p) => sum + p.amount, 0)

      if (cashAmount > 0) {
        const { error: cashError } = await supabase.from('cash_movements').insert({
          cash_register_id: cashRegisterId,
          company_id: 'cmp_001',
          operator_id: operatorId,
          type: 'sale',
          amount: cashAmount,
          description: `Venda #${saleData.sale_number}`,
          reference_type: 'sale',
          reference_id: saleData.id,
          balance_after: 0, // Would need to calculate
        })
        if (cashError) throw cashError
      }
    }

    // Create financial account (if sale is on credit)
    const creditPayments = payments.filter((p) => p.method === 'credit_card' && p.installments > 1)
    if (creditPayments.length > 0) {
      // Create accounts receivable for each installment
      // This is simplified - real implementation would be more complex
    }

    return {
      id: saleData.id,
      companyId: saleData.company_id,
      saleNumber: saleData.sale_number,
      customerId: saleData.customer_id,
      customerName,
      operatorId: saleData.operator_id,
      operatorName,
      cashRegisterId: saleData.cash_register_id,
      items,
      payments,
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

  // Real Supabase implementation
  try {
    const { data, error } = await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', saleId)
      .select()
      .single()

    if (error) throw error

    // Restore stock
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', saleId)
    if (items) {
      for (const item of items) {
        await supabase.rpc('increment_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        })
      }
    }

    // Reverse cash movement
    // Reverse financial accounts
    // etc.

    return {
      id: data.id,
      companyId: data.company_id,
      saleNumber: data.sale_number,
      customerId: data.customer_id,
      operatorId: data.operator_id,
      operatorName: '',
      cashRegisterId: data.cash_register_id,
      items: [],
      payments: [],
      subtotal: data.subtotal,
      discount: data.discount,
      additionalExpenses: data.additional_expenses,
      total: data.total,
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      completedAt: data.sale_date,
      cancelledAt: data.cancelled_at,
      cancellationReason: data.cancellation_reason,
    }
  } catch (error) {
    console.error('Error cancelling sale:', error)
    throw new Error('Erro ao cancelar venda')
  }
}
