import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { getSales } from '@/lib/api/sales'
import { getFinancialAccounts } from '@/lib/api/financial'
import type { Sale } from '@/lib/schemas/sales'
import type { FinancialAccount } from '@/lib/schemas/sales'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Calendar,
} from 'lucide-react'

export function ManagementDashboardPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today')

  useEffect(() => {
    loadData()
  }, [period])

  const loadData = async () => {
    try {
      setLoading(true)

      // Calculate date range
      const endDate = new Date().toISOString()
      let startDate: string

      if (period === 'today') {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        startDate = today.toISOString()
      } else if (period === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        startDate = weekAgo.toISOString()
      } else {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        startDate = monthAgo.toISOString()
      }

      const salesData = await getSales({
        startDate,
        endDate,
        status: 'completed',
      })
      setSales(salesData.sales)

      const financialData = await getFinancialAccounts({
        startDate,
        endDate,
      })
      setFinancialAccounts(financialData)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate metrics
  const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0)
  const totalSales = sales.length
  const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
  const cancelledSales = sales.filter(s => s.status === 'cancelled').length

  // Products sold
  const productSales = sales.flatMap(sale => 
    sale.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      total: item.subtotal,
    }))
  )

  const productSummary = productSales.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        total: 0,
      }
    }
    acc[item.productId].quantity += item.quantity
    acc[item.productId].total += item.total
    return acc
  }, {} as Record<string, { productId: string; productName: string; quantity: number; total: number }>)

  const topProducts = Object.values(productSummary)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Payment methods
  const paymentSummary = sales.flatMap(sale => sale.payments).reduce((acc, payment) => {
    if (!acc[payment.method]) {
      acc[payment.method] = 0
    }
    acc[payment.method] += payment.amount
    return acc
  }, {} as Record<string, number>)

  // Financial accounts
  const totalPayable = financialAccounts
    .filter(a => a.type === 'payable' && a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0)

  const totalReceivable = financialAccounts
    .filter(a => a.type === 'receivable' && a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0EA572]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel de Gestão</h1>
          <p className="text-sm text-gray-500 mt-1">
            Indicadores de desempenho da sua loja
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'today'
                ? 'bg-[#0EA572] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'week'
                ? 'bg-[#0EA572] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            7 dias
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === 'month'
                ? 'bg-[#0EA572] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            30 dias
          </button>
        </div>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Faturamento</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {totalRevenue.toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-[#0EA572]" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vendas</p>
                <p className="text-2xl font-bold text-gray-900">{totalSales}</p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ticket Médio</p>
                <p className="text-2xl font-bold text-gray-900">
                  R$ {averageTicket.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Cancelamentos</p>
                <p className="text-2xl font-bold text-gray-900">{cancelledSales}</p>
              </div>
              <Package className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Contas a Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              R$ {totalReceivable.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Pendente de recebimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Contas a Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              R$ {totalPayable.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">Pendente de pagamento</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-[#0EA572]" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhum produto vendido no período
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div
                  key={product.productId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                      <span className="text-sm font-bold text-[#0EA572]">
                        {index + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.productName}</p>
                      <p className="text-xs text-gray-500">
                        {product.quantity} unidades vendidas
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-[#0EA572]">
                    R$ {product.total.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-500" />
            Formas de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(paymentSummary).length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhum pagamento registrado no período
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(paymentSummary).map(([method, amount]) => (
                <div
                  key={method}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {method === 'cash' && 'Dinheiro'}
                        {method === 'credit_card' && 'Cartão de Crédito'}
                        {method === 'debit_card' && 'Cartão de Débito'}
                        {method === 'pix' && 'PIX'}
                        {method === 'check' && 'Cheque'}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    R$ {amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
