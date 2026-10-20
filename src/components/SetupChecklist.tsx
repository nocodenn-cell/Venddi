import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { CheckCircle, Circle, Settings, Package, CreditCard, Wallet, ShoppingCart } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'

interface SetupTask {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  completed: boolean
  action: string
}

export function SetupChecklist() {
  const { company } = useAuthStore()
  const [tasks, setTasks] = useState<SetupTask[]>([
    {
      id: 'company-data',
      title: 'Dados da Empresa',
      description: 'Verifique se os dados da sua empresa estão corretos',
      icon: <Settings className="h-5 w-5" />,
      completed: false,
      action: '/app/configuracoes',
    },
    {
      id: 'products',
      title: 'Cadastrar Produtos',
      description: 'Adicione seus primeiros produtos ao sistema',
      icon: <Package className="h-5 w-5" />,
      completed: false,
      action: '/app/produtos',
    },
    {
      id: 'payments',
      title: 'Formas de Pagamento',
      description: 'Configure as formas de pagamento aceitas',
      icon: <CreditCard className="h-5 w-5" />,
      completed: false,
      action: '/app/configuracoes#pagamentos',
    },
    {
      id: 'cash-register',
      title: 'Abrir Caixa',
      description: 'Abra seu primeiro caixa para começar a vender',
      icon: <Wallet className="h-5 w-5" />,
      completed: false,
      action: '/app/caixas',
    },
    {
      id: 'first-sale',
      title: 'Primeira Venda',
      description: 'Realize sua primeira venda no PDV',
      icon: <ShoppingCart className="h-5 w-5" />,
      completed: false,
      action: '/app/pdv',
    },
  ])

  useEffect(() => {
    // Carregar status das tarefas do localStorage
    const savedTasks = localStorage.getItem(`venddi_setup_${company?.id}`)
    if (savedTasks) {
      const parsedTasks = JSON.parse(savedTasks)
      setTasks(parsedTasks)
    }
  }, [company])

  const handleTaskClick = (task: SetupTask) => {
    // Marcar como completado
    const newTasks = tasks.map(t => 
      t.id === task.id ? { ...t, completed: true } : t
    )
    setTasks(newTasks)
    localStorage.setItem(`venddi_setup_${company?.id}`, JSON.stringify(newTasks))

    // Redirecionar para a ação
    window.location.href = task.action
  }

  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const progressPercentage = (completedCount / totalCount) * 100

  if (completedCount === totalCount) {
    return null // Não mostrar se tudo estiver completo
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Configuração Inicial</span>
          <Badge variant="primary">
            {completedCount}/{totalCount}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#0EA572] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {Math.round(progressPercentage)}% concluído
          </p>
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => handleTaskClick(task)}
              className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all ${
                task.completed
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-[#0EA572] hover:bg-green-50'
              }`}
            >
              <div className={`mt-0.5 ${task.completed ? 'text-green-500' : 'text-gray-400'}`}>
                {task.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className={`font-medium ${task.completed ? 'text-green-700' : 'text-gray-900'}`}>
                  {task.title}
                </p>
                <p className={`text-sm ${task.completed ? 'text-green-600' : 'text-gray-500'}`}>
                  {task.description}
                </p>
              </div>
              {task.icon}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
