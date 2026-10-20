import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal, Select } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'
import {
  createFinancialAccount,
  payFinancialAccount,
  getFinancialAccounts,
  getFinancialCategories,
} from '@/lib/api/financial'
import type { FinancialAccount, FinancialCategory } from '@/lib/schemas/sales'
import { DollarSign, TrendingUp, TrendingDown, Calendar, CheckCircle } from 'lucide-react'

export function FinancialPage() {
  const { user } = useAuthStore()
  const [accounts, setAccounts] = useState<FinancialAccount[]>([])
  const [categories, setCategories] = useState<FinancialCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'payable' | 'receivable'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null)

  // Form states
  const [newAccount, setNewAccount] = useState({
    type: 'payable' as 'payable' | 'receivable',
    description: '',
    amount: '',
    dueDate: '',
    category: '',
  })
  const [payAmount, setPayAmount] = useState('')

  useEffect(() => {
    loadData()
  }, [filter, statusFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const accountsData = await getFinancialAccounts({
        type: filter === 'all' ? undefined : filter,
        status: statusFilter === 'all' ? undefined : statusFilter,
      })
      setAccounts(accountsData)

      const categoriesData = await getFinancialCategories()
      setCategories(categoriesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const amount = parseFloat(newAccount.amount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Valor inválido')
      }

      if (!newAccount.description.trim()) {
        throw new Error('Descrição obrigatória')
      }

      if (!newAccount.dueDate) {
        throw new Error('Data de vencimento obrigatória')
      }

      if (!newAccount.category) {
        throw new Error('Categoria obrigatória')
      }

      await createFinancialAccount({
        type: newAccount.type,
        description: newAccount.description,
        amount,
        dueDate: newAccount.dueDate,
        category: newAccount.category,
      })

      setShowCreateModal(false)
      setNewAccount({
        type: 'payable',
        description: '',
        amount: '',
        dueDate: '',
        category: '',
      })
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    }
  }

  const handlePay = async () => {
    if (!selectedAccount) return

    try {
      const amount = parseFloat(payAmount)
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Valor inválido')
      }

      await payFinancialAccount({
        accountId: selectedAccount.id,
        paidAmount: amount,
        paidAt: new Date().toISOString(),
      })

      setShowPayModal(false)
      setSelectedAccount(null)
      setPayAmount('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pagar conta')
    }
  }

  const totalPayable = accounts
    .filter(a => a.type === 'payable' && a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0)

  const totalReceivable = accounts
    .filter(a => a.type === 'receivable' && a.status === 'pending')
    .reduce((sum, a) => sum + a.amount, 0)

  const totalOverdue = accounts
    .filter(a => a.status === 'overdue')
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
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gerencie contas a pagar e receber
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <DollarSign className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Contas a Pagar</p>
                <p className="text-2xl font-bold text-red-600">
                  R$ {totalPayable.toFixed(2)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Contas a Receber</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {totalReceivable.toFixed(2)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vencidas</p>
                <p className="text-2xl font-bold text-amber-600">
                  R$ {totalOverdue.toFixed(2)}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Select
                label="Tipo"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'Todas' },
                  { value: 'payable', label: 'Contas a Pagar' },
                  { value: 'receivable', label: 'Contas a Receber' },
                ]}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'pending', label: 'Pendente' },
                  { value: 'paid', label: 'Pago' },
                  { value: 'overdue', label: 'Vencido' },
                ]}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>Contas Financeiras ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhuma conta encontrada
            </p>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        account.type === 'payable' ? 'bg-red-100' : 'bg-green-100'
                      }`}
                    >
                      {account.type === 'payable' ? (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      ) : (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{account.description}</p>
                      <p className="text-xs text-gray-500">
                        {account.category} • Vence em{' '}
                        {new Date(account.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        R$ {account.amount.toFixed(2)}
                      </p>
                      <Badge
                        variant={
                          account.status === 'paid'
                            ? 'success'
                            : account.status === 'overdue'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {account.status === 'paid' && 'Pago'}
                        {account.status === 'pending' && 'Pendente'}
                        {account.status === 'overdue' && 'Vencido'}
                      </Badge>
                    </div>
                    {account.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedAccount(account)
                          setShowPayModal(true)
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Pagar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Nova Conta Financeira"
        description="Cadastre uma conta a pagar ou receber"
      >
        <div className="space-y-4">
          <Select
            label="Tipo"
            value={newAccount.type}
            onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
            options={[
              { value: 'payable', label: 'Conta a Pagar' },
              { value: 'receivable', label: 'Conta a Receber' },
            ]}
          />
          <Input
            label="Descrição"
            placeholder="Ex: Aluguel, Venda para cliente X"
            value={newAccount.description}
            onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
          />
          <Input
            label="Valor"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={newAccount.amount}
            onChange={(e) => setNewAccount({ ...newAccount, amount: e.target.value })}
          />
          <Input
            label="Data de Vencimento"
            type="date"
            value={newAccount.dueDate}
            onChange={(e) => setNewAccount({ ...newAccount, dueDate: e.target.value })}
          />
          <Select
            label="Categoria"
            value={newAccount.category}
            onChange={(e) => setNewAccount({ ...newAccount, category: e.target.value })}
            options={categories.map(c => ({ value: c.name, label: c.name }))}
            placeholder="Selecione uma categoria"
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>Criar Conta</Button>
          </div>
        </div>
      </Modal>

      {/* Pay Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setSelectedAccount(null)
          setPayAmount('')
        }}
        title="Pagar Conta"
        description={selectedAccount?.description}
      >
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Valor Total</p>
            <p className="text-2xl font-bold text-gray-900">
              R$ {selectedAccount?.amount.toFixed(2)}
            </p>
          </div>
          <Input
            label="Valor a Pagar"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setShowPayModal(false)
                setSelectedAccount(null)
                setPayAmount('')
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handlePay}>Confirmar Pagamento</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
