import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { useAuthStore } from '@/lib/store/auth'

const registerSchema = z.object({
  fullName: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  companyName: z.string().min(2, 'Nome da loja deve ter pelo menos 2 caracteres'),
  cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, 'CNPJ inválido'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
})

type RegisterInput = z.infer<typeof registerSchema>

export function SignUpPage() {
  const navigate = useNavigate()
  const { register: registerUser, isLoading } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError(null)
      await registerUser(data)
      navigate('/app/pdv')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F0FDF4] via-white to-[#ECFDF5] p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#0EA572] rounded-2xl flex items-center justify-center shadow-lg">
              <svg width="36" height="36" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl">Comece seu teste grátis</CardTitle>
          <CardDescription>15 dias grátis. Sem cartão de crédito.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="bg-[#D1FAE5] border border-[#0EA572]/30 rounded-lg p-3 mb-4">
              <p className="text-sm text-[#087A54] font-medium">
                ✨ Você terá acesso completo por 15 dias, sem precisar cadastrar cartão.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Seu nome"
                placeholder="João Silva"
                error={errors.fullName?.message}
                {...register('fullName')}
              />
              <Input
                label="Email"
                type="email"
                placeholder="joao@loja.com"
                error={errors.email?.message}
                {...register('email')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />
              <Input
                label="Confirmar senha"
                type="password"
                placeholder="••••••••"
                error={errors.confirmPassword?.message}
                {...register('confirmPassword')}
              />
            </div>

            <div className="border-t border-gray-200 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Dados da loja</p>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nome da loja"
                  placeholder="Minha Loja"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
                <Input
                  label="CNPJ"
                  placeholder="00.000.000/0001-00"
                  error={errors.cnpj?.message}
                  {...register('cnpj')}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Criar minha conta grátis
            </Button>

            <div className="text-center text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-[#0EA572] font-medium hover:underline">
                Fazer login
              </Link>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Ao criar sua conta, você concorda com nossos{' '}
              <a href="#" className="underline">Termos de Uso</a> e{' '}
              <a href="#" className="underline">Política de Privacidade</a>.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
