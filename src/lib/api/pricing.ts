import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  WholesaleTier,
  CreateWholesaleTierInput,
  PriceResolution,
  MarginPolicy,
  MarginPolicyMode,
} from '@/lib/schemas/wholesale'

// ============================================
// Wholesale Tiers API
// ============================================

/**
 * Get wholesale tiers for a product
 */
export async function getWholesaleTiers(productId: string): Promise<WholesaleTier[]> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    return []
  }

  try {
    const { data, error } = await supabase
      .from('product_wholesale_tiers')
      .select('*')
      .eq('product_id', productId)
      .order('min_quantity', { ascending: true })

    if (error) throw error

    return (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      productId: row.product_id,
      minQuantity: row.min_quantity,
      unitPrice: row.unit_price,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  } catch (error) {
    console.error('Error fetching wholesale tiers:', error)
    throw new Error('Erro ao carregar faixas de atacado')
  }
}

/**
 * Create a wholesale tier
 */
export async function createWholesaleTier(
  companyId: string,
  input: CreateWholesaleTierInput
): Promise<WholesaleTier> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    // Validate tier before inserting
    const { error: validationError } = await supabase.rpc('validate_wholesale_tier', {
      p_company_id: companyId,
      p_product_id: input.productId,
      p_min_quantity: input.minQuantity,
      p_unit_price: input.unitPrice,
    })

    if (validationError) {
      throw new Error(validationError.message)
    }

    const { data, error } = await supabase
      .from('product_wholesale_tiers')
      .insert({
        company_id: companyId,
        product_id: input.productId,
        min_quantity: input.minQuantity,
        unit_price: input.unitPrice,
      })
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      minQuantity: data.min_quantity,
      unitPrice: data.unit_price,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error creating wholesale tier:', error)
    throw error instanceof Error ? error : new Error('Erro ao criar faixa de atacado')
  }
}

/**
 * Update a wholesale tier
 */
export async function updateWholesaleTier(
  companyId: string,
  tierId: string,
  input: { minQuantity?: number; unitPrice?: number }
): Promise<WholesaleTier> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    // Get existing tier
    const { data: existing, error: fetchError } = await supabase
      .from('product_wholesale_tiers')
      .select('*')
      .eq('id', tierId)
      .single()

    if (fetchError) throw fetchError

    const newMinQty = input.minQuantity ?? existing.min_quantity
    const newPrice = input.unitPrice ?? existing.unit_price

    // Validate
    const { error: validationError } = await supabase.rpc('validate_wholesale_tier', {
      p_company_id: companyId,
      p_product_id: existing.product_id,
      p_min_quantity: newMinQty,
      p_unit_price: newPrice,
    })

    if (validationError) {
      throw new Error(validationError.message)
    }

    const { data, error } = await supabase
      .from('product_wholesale_tiers')
      .update({
        min_quantity: newMinQty,
        unit_price: newPrice,
      })
      .eq('id', tierId)
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      minQuantity: data.min_quantity,
      unitPrice: data.unit_price,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error updating wholesale tier:', error)
    throw error instanceof Error ? error : new Error('Erro ao atualizar faixa de atacado')
  }
}

/**
 * Delete a wholesale tier
 */
export async function deleteWholesaleTier(tierId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { error } = await supabase
      .from('product_wholesale_tiers')
      .delete()
      .eq('id', tierId)

    if (error) throw error
  } catch (error) {
    console.error('Error deleting wholesale tier:', error)
    throw new Error('Erro ao excluir faixa de atacado')
  }
}

// ============================================
// Price Resolution API
// ============================================

/**
 * Resolve product price based on quantity (server-side authority)
 */
export async function resolveProductPrice(
  companyId: string,
  productId: string,
  quantity: number
): Promise<PriceResolution> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode - simulate wholesale logic locally
    return mockResolvePrice(productId, quantity)
  }

  try {
    const { data, error } = await supabase.rpc('resolve_product_price', {
      p_company_id: companyId,
      p_product_id: productId,
      p_quantity: quantity,
    })

    if (error) throw error

    return {
      productId: data.productId,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      retailPrice: data.retailPrice,
      costPrice: data.costPrice,
      origin: data.origin,
      wholesaleTierId: data.wholesaleTierId,
      wholesaleTierMinQty: data.wholesaleTierMinQty,
      grossProfit: data.grossProfit,
      grossMarginPercent: data.grossMarginPercent,
      markupPercent: data.markupPercent,
    }
  } catch (error) {
    console.error('Error resolving price:', error)
    throw error instanceof Error ? error : new Error('Erro ao resolver preço')
  }
}

/**
 * Resolve prices for multiple items (batch)
 */
export async function resolveMultiplePrices(
  companyId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<PriceResolution[]> {
  // Use Promise.all for parallel resolution
  const results = await Promise.all(
    items.map((item) => resolveProductPrice(companyId, item.productId, item.quantity))
  )
  return results
}

/**
 * Mock price resolution for development
 */
async function mockResolvePrice(
  productId: string,
  quantity: number
): Promise<PriceResolution> {
  // Simulate price resolution
  const retailPrice = 20.0
  const costPrice = 10.0
  
  let unitPrice = retailPrice
  let origin: 'retail' | 'wholesale' = 'retail'
  let tierId: string | null = null
  let tierMinQty: number | null = null

  // Mock wholesale tiers
  if (quantity >= 12) {
    unitPrice = 16.0
    origin = 'wholesale'
    tierId = 'mock-tier-3'
    tierMinQty = 12
  } else if (quantity >= 6) {
    unitPrice = 18.0
    origin = 'wholesale'
    tierId = 'mock-tier-2'
    tierMinQty = 6
  }

  const grossProfit = unitPrice - costPrice
  const grossMarginPercent = (grossProfit / unitPrice) * 100
  const markupPercent = (grossProfit / costPrice) * 100

  return {
    productId,
    quantity,
    unitPrice,
    retailPrice,
    costPrice,
    origin,
    wholesaleTierId: tierId,
    wholesaleTierMinQty: tierMinQty,
    grossProfit,
    grossMarginPercent,
    markupPercent,
  }
}

// ============================================
// Margin Policy API
// ============================================

/**
 * Get margin policy for a company
 */
export async function getMarginPolicy(companyId: string): Promise<MarginPolicy | null> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      id: 'mock-policy',
      companyId,
      mode: 'disabled',
      minMarginPercent: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  try {
    const { data, error } = await supabase
      .from('company_margin_policies')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }

    return {
      id: data.id,
      companyId: data.company_id,
      mode: data.mode,
      minMarginPercent: data.min_margin_percent,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error fetching margin policy:', error)
    return null
  }
}

/**
 * Save margin policy
 */
export async function saveMarginPolicy(
  companyId: string,
  mode: MarginPolicyMode,
  minMarginPercent: number | null
): Promise<MarginPolicy> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase não configurado')
  }

  try {
    const { data, error } = await supabase
      .from('company_margin_policies')
      .upsert(
        {
          company_id: companyId,
          mode,
          min_margin_percent: minMarginPercent,
        },
        { onConflict: 'company_id' }
      )
      .select()
      .single()

    if (error) throw error

    return {
      id: data.id,
      companyId: data.company_id,
      mode: data.mode,
      minMarginPercent: data.min_margin_percent,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error saving margin policy:', error)
    throw new Error('Erro ao salvar política de margem')
  }
}
