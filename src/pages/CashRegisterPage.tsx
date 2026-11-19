import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Modal } from '@/components/ui'
import { Badge } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import {
  openCashRegister,
  closeCashRegister,
  registerWithdrawal,
  registerDeposit,
  getOpenCashRegister,
  getCashMovements,
  getSalePaymentTotals,
} from '@/lib/api/cashRegister'
import type { CashRegister, CashMovement } from '@/lib/schemas/sales'
import { v4 as uuidv4 } from 'uuid'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lock,
  Unlock,
  Plus,
  Minus,
  History,
} from 'lucide-react'

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Cartão de crédito',
  debit_card: 'Cartão de débito',
  pix: 'PIX',
}

export function CashRegisterPage() {
  const { user } = useAuthStore()
  const [cashRegister, setCashRegister] = useState<CashRegister | null>(null)
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [paymentTotals, setPaymentTotals] = useState<Array<{ method: string; total: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [showDepositModal, setShowDepositModal] = useState(false)

  // Form states
  const [initialAmount, setInitialAmount] = useState('')
  const [finalAmount, setFinalAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [withdrawalDescription, setWithdrawalDescription] = useState('')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDescription, setDepositDescription] = useState('')

  // Chave de idempotência por operação. Nova tentativa com os mesmos dados reaproveita a chave
  // (o servidor devolve o resultado original); mudou o dado, gera outra. Limpa ao concluir.
  const operationKeys = useRef<Record<string, { signature: string; key: string }>>({})

  const keyFor = (operation: string, signature: string): string => {
    const current = operationKeys.current[operation]
    if (current && current.signature === signature) return current.key
    const key = uuidv4()
    operationKeys.current[operation] = { signature, key }
    return key
  }

  const clearKey = (operation: string) => {
    delete operationKeys.current[operation]
  }

  useEffect(() => {
    loadCashRegister()
  }, [])

  const loadCashRegister = async () => {
    if (!user) return

    try {
      setLoading(true)
      const openRegister = await getOpenCashRegister(user.id)
      setCashRegister(openRegister)

      if (openRegister) {
        const movs = await getCashMovements(openRegister.id)
        setMovements(movs)
        setPaymentTotals(await getSalePaymentTotals(openRegister.id))
      } else {
        setMovements([])
        setPaymentTotals([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar caixa')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCashRegister = async () => {
    if (!user || submitting) return

    try {
      const amount = parseFloat(initialAmount)
      if (isNaN(amount) || amount < 0) {
        throw new Error('Valor inicial inválido')
      }

      setSubmitting(true)
      setError(null)
      await openCashRegister({
        operatorId: user.id,
        operatorName: user.fullName,
        initialAmount: amount,
        idempotencyKey: keyFor('open', String(amount)),
      })
      clearKey('open')

      setShowOpenModal(false)
      setInitialAmount('')
      await loadCashRegister()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir caixa')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseCashRegister = async () => {
    if (!cashRegister || submitting) return

    try {
      const amount = parseFloat(finalAmount)
      if (isNaN(amount) || amount < 0) {
        throw new Error('Valor final inválido')
      }

      setSubmitting(true)
      setError(null)
      const result = await closeCashRegister({
        cashRegisterId: cashRegister.id,
        finalAmount: amount,
        notes: closingNotes.trim() || undefined,
        idempotencyKey: keyFor('close', `${cashRegister.id}|${amount}|${closingNotes.trim()}`),
      })
      clearKey('close')

      setNotice(
        result.difference === 0
          ? 'Caixa fechado sem divergência.'
          : `Caixa fechado com diferença de R$ ${result.difference.toFixed(2)} (observação registrada).`
      )
      setShowCloseModal(false)
      setFinalAmount('')
      setClosingNotes('')
      await loadCashRegister()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar caixa')
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdrawal = async () => {
    if (!cashRegister || submitting) return

    try {
      const amount = parseFloat(withdrawalAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Valor inválido')
      }

      if (!withdrawalDescription.trim()) {
        throw new Error('Descrição obrigatória')
      }

      setSubmitting(true)
      setError(null)
      await registerWithdrawal({
        cashRegisterId: cashRegister.id,
        amount,
        description: withdrawalDescription,
        idempotencyKey: keyFor('withdrawal', `${amount}|${withdrawalDescription}`),
      })
      clearKey('withdrawal')

      setShowWithdrawalModal(false)
      setWithdrawalAmount('')
      setWithdrawalDescription('')
      await loadCashRegister()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar sangria')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeposit = async () => {
    if (!cashRegister || submitting) return

    try {
      const amount = parseFloat(depositAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Valor inválido')
      }

      if (!depositDescription.trim()) {
        throw new Error('Descrição obrigatória')
      }

      setSubmitting(true)
      setError(null)
      await registerDeposit({
        cashRegisterId: cashRegister.id,
        amount,
        description: depositDescription,
        idempotencyKey: keyFor('deposit', `${amount}|${depositDescription}`),
      })
      clearKey('deposit')

      setShowDepositModal(false)
      setDepositAmount('')
      setDepositDescription('')
      await loadCashRegister()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar suprimento')
    } finally {
      setSubmitting(false)
    }
  }

  const calculateExpectedBalance = () => {
    if (!cashRegister) return 0
    return (
      cashRegister.initialAmount +
      cashRegister.totalSales +
      cashRegister.totalDeposits -
      cashRegister.totalWithdrawals
    )
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle de Caixa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie abertura, fechamento e movimentações do caixa
          </p>
        </div>
        {!cashRegister && (
          <Button onClick={() => setShowOpenModal(true)}>
            <Unlock className="h-4 w-4 mr-2" />
            Abrir Caixa
          </Button>
        )}
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

      {/* Notice */}
      {notice && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          {notice}
          <button onClick={() => setNotice(null)} className="ml-2 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Cash Register Status */}
      {cashRegister ? (
        <>
          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                  Caixa Aberto
                </CardTitle>
                <Badge variant="success">Aberto</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Operador</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {cashRegister.operatorName || user?.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Abertura</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {new Date(cashRegister.openingDate).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Valor Inicial</p>
                  <p className="text-lg font-semibold text-gray-900">
                    R$ {cashRegister.initialAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Saldo Esperado</p>
                  <p className="text-lg font-semibold text-[#0EA572]">
                    R$ {calculateExpectedBalance().toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Vendas em dinheiro</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {cashRegister.totalSales.toFixed(2)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-[#0EA572]" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Suprimentos</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {cashRegister.totalDeposits.toFixed(2)}
                    </p>
                  </div>
                  <Plus className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Sangrias</p>
                    <p className="text-2xl font-bold text-gray-900">
                      R$ {cashRegister.totalWithdrawals.toFixed(2)}
                    </p>
                  </div>
                  <Minus className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vendas por meio de pagamento: só o dinheiro entra no saldo do caixa */}
          <Card>
            <CardHeader>
              <CardTitle>Vendas por meio de pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentTotals.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma venda registrada neste caixa</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {paymentTotals.map((item) => (
                    <div key={item.method}>
                      <p className="text-sm text-gray-600">
                        {PAYMENT_LABELS[item.method] ?? item.method}
                      </p>
                      <p className="text-lg font-semibold text-gray-900">R$ {item.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-3">
                Só o dinheiro entra no saldo esperado do caixa. Os demais meios são conferidos à parte.
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => setShowWithdrawalModal(true)}
              className="h-auto py-4"
            >
              <Minus className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Sangria</p>
                <p className="text-xs text-gray-500">Retirar dinheiro do caixa</p>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowDepositModal(true)}
              className="h-auto py-4"
            >
              <Plus className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Suprimento</p>
                <p className="text-xs text-gray-500">Adicionar dinheiro ao caixa</p>
              </div>
            </Button>

            <Button
              variant="danger"
              onClick={() => setShowCloseModal(true)}
              className="h-auto py-4"
            >
              <Lock className="h-5 w-5 mr-2" />
              <div className="text-left">
                <p className="font-semibold">Fechar Caixa</p>
                <p className="text-xs text-white/80">Encerrar operações do dia</p>
              </div>
            </Button>
          </div>

          {/* Movements History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Movimentações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {movements.map((movement) => (
                    <div
                      key={movement.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            movement.type === 'deposit'
                              ? 'bg-blue-100'
                              : movement.type === 'withdrawal'
                              ? 'bg-red-100'
                              : 'bg-green-100'
                          }`}
                        >
                          {movement.type === 'deposit' ? (
                            <Plus className="h-5 w-5 text-blue-600" />
                          ) : movement.type === 'withdrawal' ? (
                            <Minus className="h-5 w-5 text-red-600" />
                          ) : (
                            <DollarSign className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{movement.description}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(movement.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-semibold ${
                          movement.type === 'withdrawal' || movement.type === 'refund'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {movement.type === 'withdrawal' || movement.type === 'refund' ? '-' : '+'}R${' '}
                        {movement.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Lock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Caixa Fechado</h3>
              <p className="text-gray-500 mb-6">
                Abra o caixa para começar a registrar vendas e movimentações
              </p>
              <Button onClick={() => setShowOpenModal(true)}>
                <Unlock className="h-4 w-4 mr-2" />
                Abrir Caixa
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Open Cash Register Modal */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Abrir Caixa"
        description="Informe o valor inicial do caixa"
      >
        <div className="space-y-4">
          <Input
            label="Valor Inicial (Fundo de Troco)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={initialAmount}
            onChange={(e) => setInitialAmount(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowOpenModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleOpenCashRegister} disabled={submitting}>
              Abrir Caixa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Close Cash Register Modal */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Fechar Caixa"
        description="Informe o valor final contado"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Saldo esperado:</strong> R$ {calculateExpectedBalance().toFixed(2)}
            </p>
          </div>
          <Input
            label="Valor Final Contado"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
          <Input
            label="Observação (obrigatória se houver diferença)"
            placeholder="Ex.: diferença conferida com o operador"
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCloseModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleCloseCashRegister} disabled={submitting}>
              Fechar Caixa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Withdrawal Modal */}
      <Modal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        title="Sangria"
        description="Retirar dinheiro do caixa"
      >
        <div className="space-y-4">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={withdrawalAmount}
            onChange={(e) => setWithdrawalAmount(e.target.value)}
          />
          <Input
            label="Descrição"
            placeholder="Motivo da retirada"
            value={withdrawalDescription}
            onChange={(e) => setWithdrawalDescription(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowWithdrawalModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleWithdrawal} disabled={submitting}>
              Registrar Sangria
            </Button>
          </div>
        </div>
      </Modal>

      {/* Deposit Modal */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Suprimento"
        description="Adicionar dinheiro ao caixa"
      >
        <div className="space-y-4">
          <Input
            label="Valor"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
          <Input
            label="Descrição"
            placeholder="Motivo do suprimento"
            value={depositDescription}
            onChange={(e) => setDepositDescription(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDepositModal(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleDeposit} disabled={submitting}>
              Registrar Suprimento
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
