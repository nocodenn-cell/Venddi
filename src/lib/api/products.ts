import { supabase, getSupabase, isSupabaseConfigured } from '@/lib/supabase'
import { getCurrentCompanyId } from '@/lib/store/auth'
import { z } from 'zod'

// Product validation schema
export const productSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  sku: z.string().min(1, 'SKU é obrigatório'),
  barcode: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  costPrice: z.number().min(0, 'Preço de custo deve ser >= 0'),
  sellPrice: z.number().min(0.01, 'Preço de venda deve ser > 0'),
  stockQuantity: z.number().int().min(0, 'Estoque deve ser >= 0'),
  minStock: z.number().int().min(0, 'Estoque mínimo deve ser >= 0'),
  isActive: z.boolean().default(true),
})

export type ProductInput = z.infer<typeof productSchema>

export interface Product {
  id: string
  companyId: string
  categoryId: string | null
  sku: string
  barcode: string | null
  name: string
  description: string | null
  costPrice: number
  sellPrice: number
  stockQuantity: number
  minStock: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductFilters {
  search?: string
  categoryId?: string
  isActive?: boolean
  lowStock?: boolean
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Mock products for development
const mockProducts: Product[] = [
  {
    id: 'prod_001',
    companyId: getCurrentCompanyId(),
    categoryId: null,
    sku: 'CAM-001',
    barcode: '7891234567890',
    name: 'Camiseta Básica',
    description: 'Camiseta de algodão',
    costPrice: 25.0,
    sellPrice: 49.9,
    stockQuantity: 25,
    minStock: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_002',
    companyId: getCurrentCompanyId(),
    categoryId: null,
    sku: 'CAL-002',
    barcode: '7891234567891',
    name: 'Calça Jeans',
    description: 'Calça jeans masculina',
    costPrice: 65.0,
    sellPrice: 129.9,
    stockQuantity: 8,
    minStock: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_003',
    companyId: getCurrentCompanyId(),
    categoryId: null,
    sku: 'TEN-003',
    barcode: '7891234567892',
    name: 'Tênis Esportivo',
    description: 'Tênis para corrida',
    costPrice: 100.0,
    sellPrice: 199.9,
    stockQuantity: 15,
    minStock: 5,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_004',
    companyId: getCurrentCompanyId(),
    categoryId: null,
    sku: 'BON-004',
    barcode: '7891234567893',
    name: 'Boné Trucker',
    description: 'Boné estiloso',
    costPrice: 15.0,
    sellPrice: 39.9,
    stockQuantity: 3,
    minStock: 10,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prod_005',
    companyId: getCurrentCompanyId(),
    categoryId: null,
    sku: 'MEI-005',
    barcode: '7891234567894',
    name: 'Meia Esportiva',
    description: 'Par de meias',
    costPrice: 8.0,
    sellPrice: 19.9,
    stockQuantity: 50,
    minStock: 20,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/**
 * Get products with filters and pagination
 */
export async function getProducts(
  filters: ProductFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 20 }
): Promise<PaginatedResponse<Product>> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))
    
    let filtered = [...mockProducts]
    
    // Apply filters
    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.sku.toLowerCase().includes(search) ||
          p.barcode?.toLowerCase().includes(search)
      )
    }
    
    if (filters.isActive !== undefined) {
      filtered = filtered.filter((p) => p.isActive === filters.isActive)
    }
    
    if (filters.lowStock) {
      filtered = filtered.filter((p) => p.stockQuantity <= p.minStock)
    }
    
    // Pagination
    const start = (pagination.page - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    const paginatedData = filtered.slice(start, end)
    
    return {
      data: paginatedData,
      total: filtered.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(filtered.length / pagination.pageSize),
    }
  }
  
  try {
    let query = supabase.from('products').select('*', { count: 'exact' })
    
    // Apply filters
    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%`)
    }
    
    if (filters.categoryId) {
      query = query.eq('category_id', filters.categoryId)
    }
    
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }
    
    if (filters.lowStock) {
      query = query.lte('stock_quantity', supabase.rpc('min_stock')) // This would need a custom RPC
    }
    
    // Pagination
    const from = (pagination.page - 1) * pagination.pageSize
    const to = from + pagination.pageSize - 1
    
    query = query.range(from, to).order('created_at', { ascending: false })
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    const products: Product[] = (data || []).map((row) => ({
      id: row.id,
      companyId: row.company_id,
      categoryId: row.category_id,
      sku: row.sku,
      barcode: row.barcode,
      name: row.name,
      description: row.description,
      costPrice: row.cost_price,
      sellPrice: row.sell_price,
      stockQuantity: row.stock_quantity,
      minStock: row.min_stock,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    
    return {
      data: products,
      total: count || 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil((count || 0) / pagination.pageSize),
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    throw new Error('Erro ao carregar produtos')
  }
}

/**
 * Get a single product by ID
 */
export async function getProduct(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 200))
    return mockProducts.find((p) => p.id === id) || null
  }
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error) throw error
    if (!data) return null
    
    return {
      id: data.id,
      companyId: data.company_id,
      categoryId: data.category_id,
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      costPrice: data.cost_price,
      sellPrice: data.sell_price,
      stockQuantity: data.stock_quantity,
      minStock: data.min_stock,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error fetching product:', error)
    throw new Error('Erro ao carregar produto')
  }
}

/**
 * Create a new product
 */
export async function createProduct(input: ProductInput): Promise<Product> {
  // Validate input
  const validated = productSchema.parse(input)
  
  if (!isSupabaseConfigured || !supabase) {
    // CRITICAL: In production, never allow operations without real database
    if (import.meta.env.PROD) {
      console.error('🚨 CRITICAL: Product creation attempted in production without Supabase')
      throw new Error('Sistema indisponível. Contate o suporte.')
    }
    
    // Mock mode for development only
    console.warn('⚠️  MOCK MODE: Product created in memory (not persisted)')
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    const newProduct: Product = {
      id: `prod_${Date.now()}`,
      companyId: getCurrentCompanyId(), // Would come from auth context
      categoryId: validated.categoryId || null,
      sku: validated.sku,
      barcode: validated.barcode || null,
      name: validated.name,
      description: validated.description || null,
      costPrice: validated.costPrice,
      sellPrice: validated.sellPrice,
      stockQuantity: validated.stockQuantity,
      minStock: validated.minStock,
      isActive: validated.isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    mockProducts.push(newProduct)
    return newProduct
  }
  
  try {
    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: validated.sku,
        barcode: validated.barcode,
        name: validated.name,
        description: validated.description,
        category_id: validated.categoryId,
        cost_price: validated.costPrice,
        sell_price: validated.sellPrice,
        stock_quantity: validated.stockQuantity,
        min_stock: validated.minStock,
        is_active: validated.isActive,
      })
      .select()
      .single()
    
    if (error) throw error
    
    return {
      id: data.id,
      companyId: data.company_id,
      categoryId: data.category_id,
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      costPrice: data.cost_price,
      sellPrice: data.sell_price,
      stockQuantity: data.stock_quantity,
      minStock: data.min_stock,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error creating product:', error)
    throw new Error('Erro ao criar produto')
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 500))
    
    const index = mockProducts.findIndex((p) => p.id === id)
    if (index === -1) throw new Error('Produto não encontrado')
    
    const updated = {
      ...mockProducts[index],
      ...input,
      updatedAt: new Date().toISOString(),
    }
    
    mockProducts[index] = updated
    return updated
  }
  
  try {
    const updateData: any = {}
    
    if (input.name !== undefined) updateData.name = input.name
    if (input.sku !== undefined) updateData.sku = input.sku
    if (input.barcode !== undefined) updateData.barcode = input.barcode
    if (input.description !== undefined) updateData.description = input.description
    if (input.categoryId !== undefined) updateData.category_id = input.categoryId
    if (input.costPrice !== undefined) updateData.cost_price = input.costPrice
    if (input.sellPrice !== undefined) updateData.sell_price = input.sellPrice
    if (input.stockQuantity !== undefined) updateData.stock_quantity = input.stockQuantity
    if (input.minStock !== undefined) updateData.min_stock = input.minStock
    if (input.isActive !== undefined) updateData.is_active = input.isActive
    
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    
    if (error) throw error
    
    return {
      id: data.id,
      companyId: data.company_id,
      categoryId: data.category_id,
      sku: data.sku,
      barcode: data.barcode,
      name: data.name,
      description: data.description,
      costPrice: data.cost_price,
      sellPrice: data.sell_price,
      stockQuantity: data.stock_quantity,
      minStock: data.min_stock,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  } catch (error) {
    console.error('Error updating product:', error)
    throw new Error('Erro ao atualizar produto')
  }
}

/**
 * Delete a product (soft delete - set is_active to false)
 */
export async function deleteProduct(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock mode
    await new Promise((resolve) => setTimeout(resolve, 300))
    
    const index = mockProducts.findIndex((p) => p.id === id)
    if (index === -1) throw new Error('Produto não encontrado')
    
    mockProducts[index].isActive = false
    return
  }
  
  try {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
    
    if (error) throw error
  } catch (error) {
    console.error('Error deleting product:', error)
    throw new Error('Erro ao excluir produto')
  }
}

/**
 * Activate a product
 */
export async function activateProduct(id: string): Promise<Product> {
  return updateProduct(id, { isActive: true })
}

/**
 * Deactivate a product
 */
export async function deactivateProduct(id: string): Promise<Product> {
  return updateProduct(id, { isActive: false })
}
