import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Badge } from '@/components/ui'
import { SetupChecklist } from '@/components/SetupChecklist'
import { SalesTrendChart } from '@/components/SalesTrendChart'
import { LowStockAlerts } from '@/components/LowStockAlerts'
import { AdvancedFilters, DashboardFilters } from '@/components/AdvancedFilters'
import { ExportButton } from '@/components/ExportButton'
import { useAuthStore } from '@/lib/store/auth'
import { fetchDashboardData, type DashboardData } from '@/lib/api/dashboard'
import { percentChange } from '@/lib/dashboard/metrics'
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  completed: 'Concluída',
  cancelled: 'Cancelada',
  refunded: 'Estornada',
}

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning'> = {
  completed: 'success',
  cancelled: 'danger',
  refunded: 'warning',
}

function formatMoney(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Variação vs ontem. Sem base (ontem = 0) não mostra porcentagem inventada.
function ChangeLabel({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous)
  if (change === null) {
    return <p className="text-xs text-gray-500 mt-1">sem vendas ontem para comparar</p>
  }
  const up = change >= 0
  return (
    <div className={`flex items-center text-xs mt-1 ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
      {Math.abs(change).toFixed(1)}% vs ontem
    </div>
  )
}

export function DashboardPage() {
  const { company } = useAuthStore()
  const [filters, setFilters] = useState<DashboardFilters>({
    dateRange: 'today',
  })
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetchDashboardData()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Erro ao carregar o painel')
      })
    return () => {
      active = false
    }
  }, [])

  const exportRows = data
    ? [
        { metric: 'Vendas hoje', value: formatMoney(data.salesToday.total) },
        { metric: 'Pedidos hoje', value: String(data.salesToday.count) },
        { metric: 'Produtos com estoque baixo', value: String(data.lowStockCount) },
        { metric: 'Saldo em caixa', value: formatMoney(data.cashBalance) },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral do seu negócio</p>
        </div>
        <ExportButton
          data={exportRows}
          filename="dashboard-report"
          columns={[
            { key: 'metric', label: 'Métrica' },
            { key: 'value', label: 'Valor' },
          ]}
        />
      </div>

      {/* Setup Checklist */}
      <SetupChecklist />

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={filters}
        onFiltersChange={setFilters}
        operators={[]}
        categories={[]}
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Vendas Hoje</CardTitle>
            <DollarSign className="h-4 w-4 text-[#0EA572]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? formatMoney(data.salesToday.total) : '—'}
            </div>
            {data && <ChangeLabel current={data.salesToday.total} previous={data.salesYesterday.total} />}
          </CardContent>
        </Card>

        {/* Orders Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pedidos Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.salesToday.count : '—'}</div>
            {data && <ChangeLabel current={data.salesToday.count} previous={data.salesYesterday.count} />}
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Estoque Baixo</CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? data.lowStockCount : '—'}</div>
            <p className="text-xs text-gray-500 mt-1">produtos precisam reposição</p>
          </CardContent>
        </Card>

        {/* Cash Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Saldo em Caixa</CardTitle>
            <TrendingUp className="h-4 w-4 text-[#0EA572]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? formatMoney(data.cashBalance) : '—'}</div>
            <p className="text-xs text-gray-500 mt-1">nos caixas abertos</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.recentSales.length === 0 && (
              <p className="text-sm text-gray-500">Nenhuma venda registrada ainda.</p>
            )}
            <div className="space-y-4">
              {data?.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Venda #{sale.saleNumber}</p>
                    <p className="text-xs text-gray-500">{formatTime(sale.saleDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatMoney(sale.total)}</p>
                    <Badge variant={STATUS_VARIANT[sale.status]} className="text-xs">
                      {STATUS_LABEL[sale.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data && data.lowStockCount > 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm font-medium text-amber-900">Estoque baixo</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {data.lowStockCount} produto(s) no mínimo ou abaixo
                  </p>
                </div>
              ) : (
                data && <p className="text-sm text-gray-500">Nenhum produto com estoque baixo.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      {company && <SalesTrendChart companyId={company.id} />}

      {/* Low Stock Alerts */}
      {company && <LowStockAlerts companyId={company.id} />}
    </div>
  )
}
