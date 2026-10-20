import { useState } from 'react'
import { Card, CardContent, Button, Input, Select } from '@/components/ui'
import { Filter, X } from 'lucide-react'

export interface DashboardFilters {
  dateRange: 'today' | 'week' | 'month' | 'custom'
  startDate?: string
  endDate?: string
  operator?: string
  paymentMethod?: string
  productCategory?: string
}

interface AdvancedFiltersProps {
  filters: DashboardFilters
  onFiltersChange: (filters: DashboardFilters) => void
  operators?: string[]
  categories?: string[]
}

export function AdvancedFilters({
  filters,
  onFiltersChange,
  operators = [],
  categories = [],
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClearFilters = () => {
    onFiltersChange({
      dateRange: 'today',
    })
  }

  const hasActiveFilters =
    filters.operator ||
    filters.paymentMethod ||
    filters.productCategory ||
    filters.dateRange !== 'today'

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              <Filter className="h-4 w-4" />
              Filtros Avançados
              {hasActiveFilters && (
                <span className="bg-[#0EA572] text-white text-xs px-2 py-0.5 rounded-full">
                  Ativo
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filters */}
          {isOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t">
              {/* Período */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Período
                </label>
                <Select
                  value={filters.dateRange}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      dateRange: e.target.value as DashboardFilters['dateRange'],
                    })
                  }
                  options={[
                    { value: 'today', label: 'Hoje' },
                    { value: 'week', label: 'Últimos 7 dias' },
                    { value: 'month', label: 'Últimos 30 dias' },
                    { value: 'custom', label: 'Personalizado' },
                  ]}
                />
              </div>

              {/* Data Inicial (se personalizado) */}
              {filters.dateRange === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inicial
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {/* Data Final (se personalizado) */}
              {filters.dateRange === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Final
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        endDate: e.target.value,
                      })
                    }
                  />
                </div>
              )}

              {/* Operador */}
              {operators.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Operador
                  </label>
                  <Select
                    value={filters.operator || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        operator: e.target.value || undefined,
                      })
                    }
                    options={[
                      { value: '', label: 'Todos' },
                      ...operators.map(op => ({ value: op, label: op })),
                    ]}
                  />
                </div>
              )}

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Forma de Pagamento
                </label>
                <Select
                  value={filters.paymentMethod || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      paymentMethod: e.target.value || undefined,
                    })
                  }
                  options={[
                    { value: '', label: 'Todas' },
                    { value: 'cash', label: 'Dinheiro' },
                    { value: 'credit_card', label: 'Cartão de Crédito' },
                    { value: 'debit_card', label: 'Cartão de Débito' },
                    { value: 'pix', label: 'PIX' },
                  ]}
                />
              </div>

              {/* Categoria de Produto */}
              {categories.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <Select
                    value={filters.productCategory || ''}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        productCategory: e.target.value || undefined,
                      })
                    }
                    options={[
                      { value: '', label: 'Todas' },
                      ...categories.map(cat => ({ value: cat, label: cat })),
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
