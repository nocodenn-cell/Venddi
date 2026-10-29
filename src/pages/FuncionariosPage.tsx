import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui'
import { Users, RefreshCw, UserPlus } from 'lucide-react'
import {
  listEmployees,
  setCommissionPercent,
  getCommissionReport,
  type Employee,
  type CommissionRow,
} from '@/lib/api/employees'
import { useAuthStore } from '@/lib/store/auth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { InviteEmployeeModal } from '@/components/employees/InviteEmployeeModal'

const roleLabels: Record<Employee['role'], string> = {
  owner: 'Dono',
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Caixa',
  salesperson: 'Vendedor',
}

function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function FuncionariosPage() {
  const { checkPermission, user } = useAuthStore()
  const canEditCommission = checkPermission('users.write')

  const now = new Date()
  const [startDate, setStartDate] = useState(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [endDate, setEndDate] = useState(toDateInput(now))

  const [employees, setEmployees] = useState<Employee[]>([])
  const [report, setReport] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const isOwner = user?.role === 'owner'

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [list, rows] = await Promise.all([
        listEmployees(),
        getCommissionReport(
          new Date(`${startDate}T00:00:00`),
          new Date(new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000)
        ),
      ])
      setEmployees(list)
      setReport(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar funcionários')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo(() => {
    const byUser = new Map(report.map((r) => [r.userId, r]))
    return employees.map((e) => ({
      employee: e,
      sales: byUser.get(e.id),
    }))
  }, [employees, report])

  const totals = useMemo(
    () =>
      report.reduce(
        (acc, r) => ({
          sales: acc.sales + r.salesTotal,
          commission: acc.commission + r.commissionValue,
          count: acc.count + r.salesCount,
        }),
        { sales: 0, commission: 0, count: 0 }
      ),
    [report]
  )

  const saveCommission = async (employee: Employee) => {
    const raw = drafts[employee.id] ?? String(employee.commissionPercent)
    const percent = Number(raw)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError('A comissão deve estar entre 0% e 100%')
      return
    }
    try {
      setSavingId(employee.id)
      setError(null)
      await setCommissionPercent(employee.id, percent)
      setDrafts((d) => {
        const next = { ...d }
        delete next[employee.id]
        return next
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar comissão')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-6 w-6 text-[#0EA572]" />
          Central de Funcionários
        </h1>
        <p className="text-sm text-gray-600 mt-1">Equipe, comissões e vendas por período</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Configure o Supabase para ver funcionários e comissões reais.
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

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
            {canEditCommission && (
              <Button onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo funcionário
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Vendas no período</p>
            <p className="text-2xl font-bold text-gray-900">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total vendido</p>
            <p className="text-2xl font-bold text-gray-900">R$ {totals.sales.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Comissões a pagar</p>
            <p className="text-2xl font-bold text-[#0EA572]">R$ {totals.commission.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum funcionário encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">Papel</th>
                    <th className="py-2 pr-4">Comissão</th>
                    <th className="py-2 pr-4 text-right">Vendas</th>
                    <th className="py-2 pr-4 text-right">Total vendido</th>
                    <th className="py-2 text-right">Comissão (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ employee, sales }) => (
                    <tr key={employee.id} className="border-b border-gray-100">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-gray-900">{employee.fullName}</div>
                        <div className="text-xs text-gray-500">{employee.email}</div>
                        {!employee.isActive && <Badge variant="default" className="mt-1">Inativo</Badge>}
                      </td>
                      <td className="py-3 pr-4">{roleLabels[employee.role]}</td>
                      <td className="py-3 pr-4">
                        {canEditCommission ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              className="w-24"
                              value={drafts[employee.id] ?? String(employee.commissionPercent)}
                              onChange={(e) => setDrafts((d) => ({ ...d, [employee.id]: e.target.value }))}
                            />
                            <span>%</span>
                            {drafts[employee.id] !== undefined && (
                              <Button size="sm" onClick={() => saveCommission(employee)} disabled={savingId === employee.id}>
                                {savingId === employee.id ? 'Salvando...' : 'Salvar'}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span>{employee.commissionPercent}%</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right">{sales?.salesCount ?? 0}</td>
                      <td className="py-3 pr-4 text-right">R$ {(sales?.salesTotal ?? 0).toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">R$ {(sales?.commissionValue ?? 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <InviteEmployeeModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        isOwner={isOwner}
        onInvited={() => {
          setIsInviteOpen(false)
          load()
        }}
      />
    </div>
  )
}
