import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  startOfLocalDay,
  sumCompletedBetween,
  countLowStock,
  openCashBalance,
  type SaleRow,
} from '@/lib/dashboard/metrics'

// Dados reais do dashboard. Escopo por empresa vem do RLS (cada consulta só enxerga a
// empresa do usuário logado).

export interface RecentSale {
  id: string
  saleNumber: number
  total: number
  saleDate: string
  status: SaleRow['status']
}

export interface DashboardData {
  salesToday: { total: number; count: number }
  salesYesterday: { total: number; count: number }
  lowStockCount: number
  cashBalance: number
  recentSales: RecentSale[]
}

export async function fetchDashboardData(now: Date = new Date()): Promise<DashboardData> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Painel requer Supabase configurado')
  }

  const todayStart = startOfLocalDay(now)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  const [salesRes, productsRes, registersRes] = await Promise.all([
    supabase
      .from('sales')
      .select('id, sale_number, total, status, sale_date')
      .gte('sale_date', yesterdayStart.toISOString())
      .order('sale_date', { ascending: false })
      .limit(1000),
    supabase.from('products').select('stock_quantity, min_stock').eq('is_active', true),
    supabase.from('cash_registers').select('id, initial_amount').eq('status', 'open'),
  ])

  if (salesRes.error || productsRes.error || registersRes.error) {
    throw new Error('Erro ao carregar o painel')
  }

  const sales = salesRes.data ?? []
  const registers = registersRes.data ?? []

  let movements: { cash_register_id: string; balance_after: number; created_at: string }[] = []
  if (registers.length > 0) {
    const movementsRes = await supabase
      .from('cash_movements')
      .select('cash_register_id, balance_after, created_at')
      .in('cash_register_id', registers.map((r) => r.id))
    if (movementsRes.error) throw new Error('Erro ao carregar o painel')
    movements = movementsRes.data ?? []
  }

  const saleRows: SaleRow[] = sales.map((s) => ({
    total: Number(s.total),
    status: s.status,
    saleDate: s.sale_date,
  }))

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  return {
    salesToday: sumCompletedBetween(saleRows, todayStart, tomorrowStart),
    salesYesterday: sumCompletedBetween(saleRows, yesterdayStart, todayStart),
    lowStockCount: countLowStock(
      (productsRes.data ?? []).map((p) => ({ stockQuantity: p.stock_quantity, minStock: p.min_stock }))
    ),
    cashBalance: openCashBalance(
      registers.map((r) => ({ id: r.id, initialAmount: Number(r.initial_amount) })),
      movements.map((m) => ({
        cashRegisterId: m.cash_register_id,
        balanceAfter: Number(m.balance_after),
        createdAt: m.created_at,
      }))
    ),
    recentSales: sales.slice(0, 5).map((s) => ({
      id: s.id,
      saleNumber: s.sale_number,
      total: Number(s.total),
      saleDate: s.sale_date,
      status: s.status,
    })),
  }
}
