import { useEffect, useState } from 'react'
import { Card, CardContent, Button, Input, Modal } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import { getSales, cancelSale } from '@/lib/api/sales'
import type { Sale } from '@/lib/schemas/sales'

/**
 * Histórico de vendas. Cancelar exige a permissão sales.cancel (owner, admin, manager),
 * e o banco confere de novo na RPC cancel_sale_with_reversal.
 */
export function SalesPage() {
  const { user, checkPermission } = useAuthStore()
  const canCancel = checkPermission('sales.cancel')

  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [target, setTarget] = useState<Sale | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const result = await getSales({ limit: 100 })
      setSales(result.sales)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vendas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const closeDialog = () => {
    setTarget(null)
    setReason('')
  }

  const confirmCancel = async () => {
    if (!target || submitting) return
    if (!reason.trim()) {
      setError('Informe o motivo do cancelamento')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await cancelSale(target.id, reason.trim(), user?.id ?? '')
      setNotice(`Venda #${target.saleNumber} cancelada. Se houve dinheiro, o estorno foi lançado no caixa.`)
      closeDialog()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cancelar venda')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
        <p className="text-sm text-gray-500 mt-1">Histórico de vendas</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {notice && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <p className="text-center text-gray-500 py-8">Carregando vendas...</p>
          ) : sales.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhuma venda registrada</p>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => {
                const cancelled = sale.status === 'cancelled'
                return (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">Venda #{sale.saleNumber}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(sale.createdAt).toLocaleString('pt-BR')}
                        {cancelled && sale.cancellationReason ? ` · Motivo: ${sale.cancellationReason}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded ${
                          cancelled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {cancelled ? 'Cancelada' : 'Concluída'}
                      </span>
                      <p className="font-semibold text-gray-900">R$ {sale.total.toFixed(2)}</p>
                      {canCancel && !cancelled && (
                        <Button variant="outline" onClick={() => setTarget(sale)}>
                          Cancelar venda
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={target !== null}
        onClose={closeDialog}
        title={target ? `Cancelar venda #${target.saleNumber}` : 'Cancelar venda'}
        description="O estoque volta e, se houve dinheiro, o estorno é lançado no caixa. Não pode ser desfeito."
      >
        <div className="space-y-4">
          <Input
            label="Motivo do cancelamento"
            placeholder="Ex.: cliente desistiu da compra"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeDialog} disabled={submitting}>
              Voltar
            </Button>
            <Button variant="danger" onClick={confirmCancel} disabled={submitting}>
              Confirmar cancelamento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
