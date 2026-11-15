import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// API do inventário físico. Toda escrita passa pelas RPCs da migration 019;
// o banco aplica as regras de papel, isolamento e idempotência.

export type InventoryCountStatus = 'counting' | 'completed' | 'cancelled'

export interface InventoryCount {
  id: string
  name: string
  status: InventoryCountStatus
  startedAt: string
  completedAt: string | null
  cancelledAt: string | null
}

export interface InventoryCountItem {
  id: string
  productId: string
  name: string
  sku: string
  barcode: string | null
  /** Saldo atual do produto (ao vivo) */
  liveQuantity: number
  /** Saldo do sistema no momento em que foi contado */
  systemQuantity: number | null
  countedQuantity: number | null
  appliedDifference: number | null
}

export interface CompleteCountResult {
  status: 'completed'
  alreadyCompleted: boolean
  adjustedItems: number
}

const PAGE_SIZE = 1000

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Inventário requer Supabase configurado')
  }
  return supabase
}

function mapCount(row: Record<string, any>): InventoryCount {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
  }
}

/** Lista inventários da empresa, do mais recente para o mais antigo. */
export async function listInventoryCounts(): Promise<InventoryCount[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('inventory_counts')
    .select('id, name, status, started_at, completed_at, cancelled_at')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) throw new Error('Erro ao carregar inventários')
  return (data ?? []).map(mapCount)
}

/** Itens de um inventário, com nome/SKU/código de barras do produto, ordenados por nome. */
export async function getInventoryCountItems(countId: string): Promise<InventoryCountItem[]> {
  const client = requireSupabase()
  const rows: Record<string, any>[] = []

  // A API limita cada resposta (padrão 1000 linhas). Sem paginar, itens além da
  // primeira página ficariam invisíveis e bloqueariam a conclusão para sempre.
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('inventory_count_items')
      .select('id, product_id, system_quantity, counted_quantity, applied_difference, products(name, sku, barcode, stock_quantity)')
      .eq('count_id', countId)
      .order('id')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error('Erro ao carregar itens do inventário')
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
    .map((row: Record<string, any>) => ({
      id: row.id,
      productId: row.product_id,
      name: row.products?.name ?? '',
      sku: row.products?.sku ?? '',
      barcode: row.products?.barcode ?? null,
      liveQuantity: row.products?.stock_quantity ?? 0,
      systemQuantity: row.system_quantity,
      countedQuantity: row.counted_quantity,
      appliedDifference: row.applied_difference,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/** Inicia um inventário (um por vez por empresa). Retorna o id e o total de produtos. */
export async function startInventoryCount(name?: string): Promise<{ countId: string; totalItems: number }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('iniciar_inventario', { p_name: name?.trim() || null })
  if (error) throw new Error(error.message)
  return { countId: data.count_id, totalItems: data.total_items }
}

/** Registra a contagem de um produto. Pode ser refeita; a última contagem vale. */
export async function saveInventoryCountItem(params: {
  countId: string
  productId: string
  countedQuantity: number
}): Promise<{ systemQuantity: number; difference: number }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('registrar_contagem_item', {
    p_count_id: params.countId,
    p_product_id: params.productId,
    p_counted_quantity: params.countedQuantity,
  })
  if (error) throw new Error(error.message)
  return { systemQuantity: data.system_quantity, difference: data.difference }
}

/** Conclui o inventário e aplica os ajustes. Idempotente. */
export async function completeInventoryCount(countId: string): Promise<CompleteCountResult> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('concluir_inventario', { p_count_id: countId })
  if (error) throw new Error(error.message)
  return {
    status: 'completed',
    alreadyCompleted: Boolean(data.already_completed),
    adjustedItems: data.adjusted_items,
  }
}

/** Cancela um inventário em andamento. Não altera estoque. */
export async function cancelInventoryCount(countId: string): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.rpc('cancelar_inventario', { p_count_id: countId })
  if (error) throw new Error(error.message)
}
