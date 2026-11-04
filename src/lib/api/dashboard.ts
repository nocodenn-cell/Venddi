import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { startOfLocalDay, type SaleRow } from '@/lib/dashboard/metrics'

// Métricas do dashboard calculadas no banco (migration 023, função metricas_dashboard).
// A função roda como o usuário logado: o RLS e o filtro por empresa valem no servidor.

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

interface DashboardRpcResult {
  vendas_hoje: { total: number | string; count: number | string }
  vendas_ontem: { total: number | string; count: number | string }
  estoque_baixo: number | string
  saldo_caixa: number | string
  recentes: {
    id: string
    sale_number: number
    total: number | string
    status: SaleRow['status']
    sale_date: string
  }[]
}

const money = (value: number | string) => Math.round(Number(value) * 100) / 100

export async function fetchDashboardData(now: Date = new Date()): Promise<DashboardData> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Painel requer Supabase configurado')
  }

  const hoje = startOfLocalDay(now)
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)
  const ontem = new Date(hoje)
  ontem.setDate(ontem.getDate() - 1)

  const { data, error } = await supabase.rpc('metricas_dashboard', {
    p_ontem_inicio: ontem.toISOString(),
    p_hoje_inicio: hoje.toISOString(),
    p_amanha_inicio: amanha.toISOString(),
  })

  if (error || !data) throw new Error('Erro ao carregar o painel')

  const result = data as DashboardRpcResult
  return {
    salesToday: { total: money(result.vendas_hoje.total), count: Number(result.vendas_hoje.count) },
    salesYesterday: { total: money(result.vendas_ontem.total), count: Number(result.vendas_ontem.count) },
    lowStockCount: Number(result.estoque_baixo),
    cashBalance: money(result.saldo_caixa),
    recentSales: result.recentes.map((s) => ({
      id: s.id,
      saleNumber: s.sale_number,
      total: money(s.total),
      saleDate: s.sale_date,
      status: s.status,
    })),
  }
}
