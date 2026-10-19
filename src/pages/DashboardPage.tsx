import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Badge } from '@/components/ui'
import {
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'

// Mock data - will be replaced with real data from API
const mockData = {
  salesToday: 2450.0,
  salesYesterday: 1890.0,
  ordersToday: 12,
  ordersYesterday: 9,
  lowStockProducts: 5,
  pendingBills: 3,
  totalPending: 1250.0,
  cashBalance: 8750.0,
}

export function DashboardPage() {
  const salesChange = ((mockData.salesToday - mockData.salesYesterday) / mockData.salesYesterday) * 100
  const ordersChange = ((mockData.ordersToday - mockData.ordersYesterday) / mockData.ordersYesterday) * 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do seu negócio</p>
      </div>

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
              R$ {mockData.salesToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className={`flex items-center text-xs mt-1 ${salesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {salesChange >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(salesChange).toFixed(1)}% vs ontem
            </div>
          </CardContent>
        </Card>

        {/* Orders Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pedidos Hoje</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.ordersToday}</div>
            <div className={`flex items-center text-xs mt-1 ${ordersChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ordersChange >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(ordersChange).toFixed(1)}% vs ontem
            </div>
          </CardContent>
        </Card>

        {/* Low Stock */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Estoque Baixo</CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockData.lowStockProducts}</div>
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
            <div className="text-2xl font-bold">
              R$ {mockData.cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">disponível hoje</p>
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
            <div className="space-y-4">
              {[
                { id: 1, customer: 'Maria Silva', value: 150.0, time: '10:30', status: 'completed' },
                { id: 2, customer: 'João Santos', value: 89.9, time: '10:15', status: 'completed' },
                { id: 3, customer: 'Ana Costa', value: 234.5, time: '09:45', status: 'completed' },
                { id: 4, customer: 'Pedro Oliveira', value: 67.0, time: '09:30', status: 'completed' },
              ].map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sale.customer}</p>
                    <p className="text-xs text-gray-500">{sale.time}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      R$ {sale.value.toFixed(2)}
                    </p>
                    <Badge variant="success" className="text-xs">Concluída</Badge>
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
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-sm font-medium text-amber-900">Estoque baixo</p>
                <p className="text-xs text-amber-700 mt-1">
                  {mockData.lowStockProducts} produtos abaixo do mínimo
                </p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm font-medium text-red-900">Contas a vencer</p>
                <p className="text-xs text-red-700 mt-1">
                  {mockData.pendingBills} contas vencendo hoje (R$ {mockData.totalPending.toFixed(2)})
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-900">Meta mensal</p>
                <p className="text-xs text-blue-700 mt-1">
                  68% da meta atingida
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
