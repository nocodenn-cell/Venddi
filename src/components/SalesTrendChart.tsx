import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Select } from '@/components/ui'
import { TrendingUp, TrendingDown, Calendar, Download } from 'lucide-react'
import { getSales } from '@/lib/api/sales'
import type { Sale } from '@/lib/schemas/sales'

interface SalesTrendChartProps {
  companyId: string
}

export function SalesTrendChart({ companyId }: SalesTrendChartProps) {
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30')
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSales()
  }, [period])

  const loadSales = async () => {
    try {
      setLoading(true)
      const endDate = new Date().toISOString()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(period))

      const result = await getSales({
        startDate: startDate.toISOString(),
        endDate,
        status: 'completed',
      })

      setSales(result.sales)
    } catch (error) {
      console.error('Error loading sales:', error)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar vendas por dia
  const salesByDay = sales.reduce((acc, sale) => {
    const date = new Date(sale.createdAt).toLocaleDateString('pt-BR')
    if (!acc[date]) {
      acc[date] = { count: 0, total: 0 }
    }
    acc[date].count++
    acc[date].total += sale.total
    return acc
  }, {} as Record<string, { count: number; total: number }>)

  const days = Object.keys(salesByDay).sort((a, b) => {
    const [dayA, monthA, yearA] = a.split('/')
    const [dayB, monthB, yearB] = b.split('/')
    return new Date(`${yearA}-${monthA}-${dayA}`).getTime() - new Date(`${yearB}-${monthB}-${dayB}`).getTime()
  })

  const maxTotal = Math.max(...days.map(day => salesByDay[day].total), 1)

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#0EA572]" />
            Tendência de Vendas
          </CardTitle>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '7' | '30' | '90')}
            options={[
              { value: '7', label: 'Últimos 7 dias' },
              { value: '30', label: 'Últimos 30 dias' },
              { value: '90', label: 'Últimos 90 dias' },
            ]}
          />
        </div>
      </CardHeader>
      <CardContent>
        {days.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Nenhuma venda no período selecionado
          </p>
        ) : (
          <div className="space-y-4">
            {/* Gráfico de barras */}
            <div className="flex items-end gap-1 h-32">
              {days.map((day, index) => {
                const height = (salesByDay[day].total / maxTotal) * 100
                return (
                  <div
                    key={day}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${day}: R$ ${salesByDay[day].total.toFixed(2)}`}
                  >
                    <div
                      className="w-full bg-[#0EA572] rounded-t hover:bg-[#087A54] transition-colors cursor-pointer"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    {days.length <= 15 && (
                      <span className="text-xs text-gray-500 rotate-45 origin-left">
                        {day.slice(0, 5)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-600">Total de Vendas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sales.reduce((sum, s) => sum + s.total, 0).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quantidade</p>
                <p className="text-2xl font-bold text-gray-900">{sales.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ticket Médio</p>
                <p className="text-2xl font-bold text-gray-900">
                  {(sales.reduce((sum, s) => sum + s.total, 0) / sales.length).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
