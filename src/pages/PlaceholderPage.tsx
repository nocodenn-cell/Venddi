import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🚧</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Em desenvolvimento</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Este módulo está sendo construído na próxima sprint. 
              Acompanhe o progresso no roadmap do projeto.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
