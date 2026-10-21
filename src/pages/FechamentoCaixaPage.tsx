import { toLocalDateInput } from '@/lib/date'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui'
import { ClipboardList, RefreshCw, AlertTriangle } from 'lucide-react'
import { getCashClosingPeriod, type CashClosingReport } from '@/lib/api/cashRegister'

const methodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  pix: 'PIX',
  boleto: 'Boleto',
}

function toDateInput(date: Date): string {
  return toLocalDateInput(date)
}

function money(value: number): string {
  return `R$ ${value.toFixed(2)}`
}

export function FechamentoCaixaPage() {
  const today = new Date()
  const [startDate, setStartDate] = useState(toDateInput(today))
  const [endDate, setEndDate] = useState(toDateInput(today))
  const [reports, setReports] = useState<CashClosingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      // Inclui o dia final inteiro
      const end = new Date(`${endDate}T00:00:00`)
      end.setDate(end.getDate() + 1)
      setReports(await getCashClosingPeriod(new Date(`${startDate}T00:00:00`), end))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar fechamentos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-[#0EA572]" />
          Fechamento de Caixa
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Saldo esperado pelos movimentos, comparado com o valor informado no fechamento
        </p>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

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

      {loading ? (
        <p className="text-sm text-gray-500">Carregando...</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum caixa aberto no período.</p>
      ) : (
        reports.map((r) => (
          <Card key={r.cashRegisterId}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3">
                <span>{r.operatorName || 'Operador'}</span>
                {r.status === 'open' ? <Badge variant="success">Aberto</Badge> : <Badge variant="default">Fechado</Badge>}
                <span className="text-sm font-normal text-gray-500">
                  {new Date(r.openedAt).toLocaleString('pt-BR')}
                  {r.closedAt ? ` até ${new Date(r.closedAt).toLocaleString('pt-BR')}` : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!r.cashConsistent && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  Os pagamentos em dinheiro não batem com os movimentos do caixa. Verifique antes de fechar.
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Fundo inicial</p>
                  <p className="font-medium">{money(r.initialAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Vendas ({r.salesCount})</p>
                  <p className="font-medium">{money(r.salesTotal)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Suprimentos</p>
                  <p className="font-medium">{money(r.deposits)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Sangrias</p>
                  <p className="font-medium">{money(r.withdrawals)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Estornos em dinheiro</p>
                  <p className="font-medium">{money(r.refunds)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Vendas canceladas</p>
                  <p className="font-medium">
                    {r.cancelledCount} ({money(r.cancelledTotal)})
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Saldo esperado em dinheiro</p>
                  <p className="font-semibold">{money(r.expectedCash)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Valor informado no fechamento</p>
                  <p className="font-semibold">{r.informedCash === null ? 'Caixa ainda aberto' : money(r.informedCash)}</p>
                </div>
              </div>

              {r.difference !== null && (
                <div
                  className={`p-3 rounded-lg text-sm font-medium ${
                    Math.abs(r.difference) < 0.005
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  Diferença: {money(r.difference)} {Math.abs(r.difference) < 0.005 ? '(caixa batendo)' : r.difference < 0 ? '(falta dinheiro)' : '(sobra dinheiro)'}
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Vendas por forma de pagamento</p>
                {Object.keys(r.paymentsByMethod).length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma venda concluída.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {Object.entries(r.paymentsByMethod).map(([method, value]) => (
                      <li key={method} className="flex justify-between border-b border-gray-100 py-1">
                        <span>{methodLabels[method] ?? method}</span>
                        <span className="font-medium">{money(value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
