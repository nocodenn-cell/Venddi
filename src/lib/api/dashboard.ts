import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  startOfLocalDay,
  sumCompletedBetween,
  countLowStock,
  openCashBalance,
  type SaleRow,
  type CashMovementRow,
} from '@/lib/dashboard/metrics'

// Dados reais do dashboard. Escopo por empresa vem do RLS (cada consulta só enxerga a
// empresa do usuário logado).

const PAGE_SIZE = 1000

// A API devolve no máximo PAGE_SIZE linhas por resposta. Lê todas as páginas para que
// os totais e contagens cubram o período inteiro, não uma amostra.
async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

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

type SaleDbRow = {
  id: string
  sale_number: number
  total: number | string
  status: SaleRow['status']
  sale_date: string
}

export async function fetchDashboardData(now: Date = new Date()): Promise<DashboardData> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Painel requer Supabase configurado')
  }

  const todayStart = startOfLocalDay(now)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  try {
    // Vendas de ontem e hoje, completas (para totais e contagens)
    const periodSales = await fetchAllRows<SaleDbRow>((from, to) =>
      supabase!
        .from('sales')
        .select('id, sale_number, total, status, sale_date')
        .gte('sale_date', yesterdayStart.toISOString())
        .order('sale_date', { ascending: false })
        .order('id')
        .range(from, to)
    )

    // Últimas vendas, sem o corte de data: reflete o histórico real da empresa
    const { data: latest, error: latestError } = await supabase
      .from('sales')
      .select('id, sale_number, total, status, sale_date')
      .order('sale_date', { ascending: false })
      .order('id')
      .limit(5)
    if (latestError) throw latestError

    const products = await fetchAllRows<{ stock_quantity: number; min_stock: number }>((from, to) =>
      supabase!
        .from('products')
        .select('id, stock_quantity, min_stock')
        .eq('is_active', true)
        .order('id')
        .range(from, to)
    )

    const registers = await fetchAllRows<{ id: string; initial_amount: number | string }>((from, to) =>
      supabase!
        .from('cash_registers')
        .select('id, initial_amount')
        .eq('status', 'open')
        .order('id')
        .range(from, to)
    )

    let movements: CashMovementRow[] = []
    if (registers.length > 0) {
      const rows = await fetchAllRows<{ cash_register_id: string; type: CashMovementRow['type']; amount: number | string }>(
        (from, to) =>
          supabase!
            .from('cash_movements')
            .select('cash_register_id, type, amount')
            .in('cash_register_id', registers.map((r) => r.id))
            .order('id')
            .range(from, to)
      )
      movements = rows.map((m) => ({
        cashRegisterId: m.cash_register_id,
        type: m.type,
        amount: Number(m.amount),
      }))
    }

    const saleRows: SaleRow[] = periodSales.map((s) => ({
      total: Number(s.total),
      status: s.status,
      saleDate: s.sale_date,
    }))

    return {
      salesToday: sumCompletedBetween(saleRows, todayStart, tomorrowStart),
      salesYesterday: sumCompletedBetween(saleRows, yesterdayStart, todayStart),
      lowStockCount: countLowStock(
        products.map((p) => ({ stockQuantity: p.stock_quantity, minStock: p.min_stock }))
      ),
      cashBalance: openCashBalance(
        registers.map((r) => ({ id: r.id, initialAmount: Number(r.initial_amount) })),
        movements
      ),
      recentSales: (latest ?? []).map((s: SaleDbRow) => ({
        id: s.id,
        saleNumber: s.sale_number,
        total: Number(s.total),
        saleDate: s.sale_date,
        status: s.status,
      })),
    }
  } catch {
    throw new Error('Erro ao carregar o painel')
  }
}
