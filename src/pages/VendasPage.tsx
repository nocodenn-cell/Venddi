import { toLocalDateInput } from '@/lib/date'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from '@/components/ui'
import { Receipt, RefreshCw } from 'lucide-react'
import { getSales, cancelSale } from '@/lib/api/sales'
import { useAuthStore } from '@/lib/store/auth'
import type { Sale } from '@/lib/schemas/sales'

function toDateInput(date: Date): string {
  return toLocalDateInput(date)
}

export function VendasPage() {
  const { checkPermission } = useAuthStore()
  const canCancel = checkPermission('sales.cancel')

  const today = new Date()
  const [startDate, setStartDate] = useState(toDateInput(today))
  const [endDate, setEndDate] = useState(toDateInput(today))
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null)
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      // Datas locais convertidas para o instante correto; todas as páginas são carregadas
      const start = new Date(`${startDate}T00:00:00`).toISOString()
      const end = new Date(`${endDate}T23:59:59`).toISOString()
      const all: Sale[] = []
      let offset = 0
      for (;;) {
        const { sales: page, total } = await getSales({ startDate: start, endDate: end, limit: 200, offset })
        all.push(...page)
        offset += page.length
        if (page.length === 0 || offset >= total) break
      }
      setSales(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCancel = (sale: Sale) => {
    setSaleToCancel(sale)
    setReason('')
    setCancelError(null)
  }

  const closeCancel = () => {
    if (cancelling) return
    setSaleToCancel(null)
  }

  const confirmCancel = async () => {
    if (!saleToCancel) return
    if (reason.trim().length < 5) {
      setCancelError('Informe o motivo do cancelamento (mínimo 5 caracteres)')
      return
    }
    try {
      setCancelling(true)
      setCancelError(null)
      await cancelSale(saleToCancel.id, reason.trim())
      setSuccess(`Venda #${saleToCancel.saleNumber} cancelada. Estoque e caixa foram ajustados.`)
      setSaleToCancel(null)
      await load()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Não foi possível cancelar a venda')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-[#0EA572]" />
          Vendas
        </h1>
        <p className="text-sm text-gray-600 mt-1">Histórico de vendas do período</p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">{success}</div>}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">De</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Até</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendas ({sales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma venda no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Nº</th>
                    <th className="py-2 pr-4">Data</th>
                    <th className="py-2 pr-4 text-right">Total</th>
                    <th className="py-2 pr-4">Situação</th>
                    <th className="py-2 pr-4">Motivo</th>
                    <th className="py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4 font-medium">#{sale.saleNumber}</td>
                      <td className="py-3 pr-4">{new Date(sale.createdAt).toLocaleString('pt-BR')}</td>
                      <td className="py-3 pr-4 text-right">R$ {sale.total.toFixed(2)}</td>
                      <td className="py-3 pr-4">
                        {sale.status === 'cancelled' ? (
                          <Badge variant="danger">Cancelada</Badge>
                        ) : (
                          <Badge variant="success">Concluída</Badge>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-gray-600">{sale.cancellationReason ?? '—'}</td>
                      <td className="py-3 text-right">
                        {canCancel && sale.status === 'completed' && (
                          <Button size="sm" variant="outline" onClick={() => openCancel(sale)}>
                            Cancelar venda
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={saleToCancel !== null}
        onClose={closeCancel}
        title={saleToCancel ? `Cancelar venda #${saleToCancel.saleNumber}` : 'Cancelar venda'}
        description="O estoque é devolvido e, se houve pagamento em dinheiro, o valor é estornado no caixa aberto. A ação fica registrada."
      >
        <div className="space-y-4">
          {cancelError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{cancelError}</div>
          )}
          <Input
            label="Motivo do cancelamento"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: cliente desistiu da compra"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeCancel} disabled={cancelling}>
              Voltar
            </Button>
            <Button variant="danger" onClick={confirmCancel} disabled={cancelling}>
              {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
