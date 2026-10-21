import { useState } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { inviteEmployee } from '@/lib/api/employees'

type InvitableRole = 'admin' | 'manager' | 'cashier' | 'salesperson'

const roleOptions: { value: InvitableRole; label: string }[] = [
  { value: 'cashier', label: 'Caixa' },
  { value: 'salesperson', label: 'Vendedor' },
  { value: 'manager', label: 'Gerente' },
  { value: 'admin', label: 'Administrador' },
]

interface InviteEmployeeModalProps {
  isOpen: boolean
  onClose: () => void
  onInvited: () => void
  isOwner: boolean
}

export function InviteEmployeeModal({ isOpen, onClose, onInvited, isOwner }: InviteEmployeeModalProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<InvitableRole>('cashier')
  const [commission, setCommission] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Só o dono pode convidar outro administrador
  const options = isOwner ? roleOptions : roleOptions.filter((o) => o.value !== 'admin')

  const reset = () => {
    setEmail('')
    setFullName('')
    setRole('cashier')
    setCommission('0')
    setError(null)
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const percent = Number(commission)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      setError('A comissão deve estar entre 0% e 100%')
      return
    }

    try {
      setSaving(true)
      await inviteEmployee({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        commissionPercent: percent,
      })
      reset()
      onInvited()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o convite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Novo funcionário"
      description="Enviaremos um e-mail para o funcionário definir a senha"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}
        <Input label="Nome completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Papel</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <Input
          label="Comissão (%)"
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Enviando convite...' : 'Enviar convite'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
