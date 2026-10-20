import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Modal, Input, Textarea } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import { getSales, cancelSale } from '@/lib/api/sales'
import type { Sale } from '@/lib/schemas/sales'
import { Calendar, DollarSign, XCircle, AlertTriangle } from 'lucide-react'

export function SalesHistoryPage() {
  const { company, user } = useAuthStore()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    loadSales()
  }, [])

  const loadSales = async () => {
    try {
      setLoading(true)
      const result = await getSales({})
      setSales(result.sales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelClick = (sale: Sale) => {
    setSelectedSale(sale)
    setShowCancelModal(true)
  }

  const handleCancelConfirm = async () => {
    if (!selectedSale || !cancellationReason.trim()) {
      setError('Motivo do cancelamento é obrigatório')
      return
    }

    if (cancellationReason.length < 15) {
      setError('Motivo deve ter pelo menos 15 caracteres')
      return
    }

    try {
      setIsCancelling(true)
      setError(null)

      await cancelSale(
        selectedSale.id,
        cancellationReason
      )

      setShowCancelModal(false)
      setSelectedSale(null)
      setCancellationReason('')
      
      // Reload sales
      await loadSales()
      
      alert('Venda cancelada com sucesso!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar venda')
    } finally {
      setIsCancelling(false)
    }
  }

  const canCancelSale = (sale: Sale): boolean => {
    // Only completed sales can be cancelled
    if (sale.status !== 'completed') return false
    
    // Check if within 30 minutes of creation
    const saleTime = new Date(sale.createdAt).getTime()
    const now = Date.now()
    const minutesDiff = (now - saleTime) / (1000 * 60)
    
    return minutesDiff <= 30
  }

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Histórico de Vendas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visualize e gerencie todas as vendas realizadas
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Sales List */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas ({sales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhuma venda encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#D1FAE5] rounded-lg flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-[#0EA572]" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Venda #{sale.saleNumber}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(sale.createdAt).toLocaleString('pt-BR')}
                        </span>
                        <span>•</span>
                        <span>{sale.operatorName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">
                        R$ {sale.total.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          sale.status === 'completed'
                            ? 'success'
                            : sale.status === 'cancelled'
                            ? 'danger'
                            : 'default'
                        }
                      >
                        {sale.status === 'completed' && 'Concluída'}
                        {sale.status === 'cancelled' && 'Cancelada'}
                        {sale.status === 'refunded' && 'Reembolsada'}
                      </Badge>
                    </div>
                    {canCancelSale(sale) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelClick(sale)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false)
          setSelectedSale(null)
          setCancellationReason('')
          setError(null)
        }}
        title="Cancelar Venda"
        description="Esta ação não pode ser desfeita"
      >
        <div className="space-y-4">
          {selectedSale && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Venda #{selectedSale.saleNumber}</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {selectedSale.total.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(selectedSale.createdAt).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Atenção:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>O estoque será restaurado</li>
                  <li>O caixa será estornado</li>
                  <li>O financeiro será ajustado</li>
                  <li>Apenas vendas com menos de 30 minutos podem ser canceladas</li>
                </ul>
              </div>
            </div>
          </div>

          <Textarea
            label="Motivo do Cancelamento"
            placeholder="Informe o motivo do cancelamento (mínimo 15 caracteres)"
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowCancelModal(false)
                setSelectedSale(null)
                setCancellationReason('')
                setError(null)
              }}
            >
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelConfirm}
              disabled={isCancelling || cancellationReason.length < 15}
            >
              {isCancelling ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
