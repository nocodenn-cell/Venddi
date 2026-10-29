import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from '@/components/ui'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Página do link de convite: o funcionário define a senha e depois entra pelo login.
export function SetPasswordPage() {
  const navigate = useNavigate()
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setHasSession(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('As senhas não conferem')
      return
    }
    if (!supabase) return

    try {
      setSaving(true)
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      // Sai da sessão do convite: o funcionário entra de novo com e-mail e senha
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível definir a senha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Definir senha</CardTitle>
          <CardDescription>Crie a senha para acessar a Venddi</CardDescription>
        </CardHeader>
        <CardContent>
          {hasSession === null && <p className="text-sm text-gray-500 text-center">Verificando convite...</p>}

          {hasSession === false && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-700">Este link é inválido ou expirou. Peça um novo convite ao administrador.</p>
              <Button variant="outline" onClick={() => navigate('/login')}>Ir para o login</Button>
            </div>
          )}

          {hasSession && (
            <form onSubmit={submit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
              )}
              <Input
                label="Nova senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
              <Input
                label="Confirmar senha"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Salvando...' : 'Definir senha e entrar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
