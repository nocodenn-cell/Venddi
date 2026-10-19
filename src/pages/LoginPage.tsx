import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/schemas'
import { useAuthStore } from '@/lib/store/auth'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    try {
      setError(null)
      await login(data.email, data.password)
      navigate('/app/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao Blum</CardTitle>
          <CardDescription>Faça login para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}
            
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Senha"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded border-gray-300" />
                Lembrar de mim
              </label>
              <a href="#" className="text-sm text-emerald-600 hover:underline">
                Esqueci a senha
              </a>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Entrar
            </Button>

            <div className="text-center text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-emerald-600 font-medium hover:underline">
                Criar conta
              </Link>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <strong>Demo:</strong> admin@blum.com / qualquer senha
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
