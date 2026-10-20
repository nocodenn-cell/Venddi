import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge } from '@/components/ui'
import { Plus, Trash2, Package, TrendingDown } from 'lucide-react'
import {
  getWholesaleTiers,
  createWholesaleTier,
  updateWholesaleTier,
  deleteWholesaleTier,
} from '@/lib/api/pricing'
import type { WholesaleTier } from '@/lib/schemas/wholesale'
import { formatBRL } from '@/lib/schemas/wholesale'
import { useAuthStore } from '@/lib/store/auth'

interface WholesaleTiersManagerProps {
  productId: string
  retailPrice: number
  costPrice: number | null
}

export function WholesaleTiersManager({
  productId,
  retailPrice,
  costPrice,
}: WholesaleTiersManagerProps) {
  const { company } = useAuthStore()
  const [tiers, setTiers] = useState<WholesaleTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTier, setEditingTier] = useState<WholesaleTier | null>(null)
  const [newMinQty, setNewMinQty] = useState('')
  const [newPrice, setNewPrice] = useState('')

  useEffect(() => {
    loadTiers()
  }, [productId])

  const loadTiers = async () => {
    try {
      setLoading(true)
      const data = await getWholesaleTiers(productId)
      setTiers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar faixas')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!company?.id) return

    const minQty = parseInt(newMinQty)
    const price = parseFloat(newPrice)

    if (isNaN(minQty) || minQty <= 0) {
      setError('Quantidade mínima deve ser positiva')
      return
    }

    if (isNaN(price) || price <= 0) {
      setError('Preço deve ser positivo')
      return
    }

    if (price > retailPrice) {
      setError('Preço de atacado não pode ser maior que o preço de varejo')
      return
    }

    try {
      setError(null)
      await createWholesaleTier(company.id, {
        productId,
        minQuantity: minQty,
        unitPrice: price,
      })
      setNewMinQty('')
      setNewPrice('')
      setShowAddForm(false)
      await loadTiers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar faixa')
    }
  }

  const handleUpdate = async () => {
    if (!company?.id || !editingTier?.id) return

    try {
      setError(null)
      await updateWholesaleTier(company.id, editingTier.id, {
        minQuantity: editingTier.minQuantity,
        unitPrice: editingTier.unitPrice,
      })
      setEditingTier(null)
      await loadTiers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar faixa')
    }
  }

  const handleDelete = async (tierId: string | undefined) => {
    if (!tierId) return
    if (!confirm('Excluir esta faixa de atacado?')) return

    try {
      setError(null)
      await deleteWholesaleTier(tierId)
      await loadTiers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir faixa')
    }
  }

  const calculateMargin = (price: number): number | null => {
    if (costPrice === null || costPrice === undefined || price <= 0) return null
    return ((price - costPrice) / price) * 100
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-[#0EA572]" />
          Preço de Atacado
          <Badge variant="outline" className="ml-2">
            Opcional
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 font-bold">
              ×
            </button>
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
          <p className="font-medium mb-1">Como funciona:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Defina faixas de quantidade com preços especiais</li>
            <li>O sistema aplica automaticamente o melhor preço</li>
            <li>Preço de atacado deve ser menor que o varejo ({formatBRL(retailPrice)})</li>
            <li>Preços devem diminuir conforme a quantidade aumenta</li>
          </ul>
        </div>

        {tiers.length === 0 ? (
          <div className="text-center py-6">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhuma faixa de atacado configurada</p>
            <p className="text-gray-400 text-xs mt-1">
              Este produto será vendido apenas no preço de varejo
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {tiers.map((tier, index) => {
              const nextTier = tiers[index + 1]
              const margin = calculateMargin(tier.unitPrice)
              const nextMinQty = nextTier ? nextTier.minQuantity : null

              return (
                <div
                  key={tier.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  {editingTier && editingTier.id === tier.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="number"
                        value={editingTier.minQuantity}
                        onChange={(e) =>
                          setEditingTier({ ...editingTier, minQuantity: parseInt(e.target.value) || 0 })
                        }
                        className="w-24"
                        min="1"
                      />
                      <span className="text-sm text-gray-600">un. por</span>
                      <Input
                        type="number"
                        value={editingTier.unitPrice}
                        onChange={(e) =>
                          setEditingTier({ ...editingTier, unitPrice: parseFloat(e.target.value) || 0 })
                        }
                        className="w-32"
                        step="0.01"
                        min="0.01"
                      />
                      <Button
                        size="sm"
                        onClick={handleUpdate}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingTier(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {tier.minQuantity}+ unidades
                          {nextMinQty && (
                            <span className="text-sm text-gray-500 ml-2">
                              (até {nextMinQty - 1} un.)
                            </span>
                          )}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-lg font-bold text-[#0EA572]">
                            {formatBRL(tier.unitPrice)}
                          </p>
                          <span className="text-xs text-gray-500">/unidade</span>
                          {margin !== null && (
                            <Badge variant={margin >= 0 ? 'success' : 'danger'} className="text-xs">
                              Margem: {margin.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTier(tier)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(tier.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {showAddForm ? (
          <div className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantidade Mínima
                </label>
                <Input
                  type="number"
                  value={newMinQty}
                  onChange={(e) => setNewMinQty(e.target.value)}
                  placeholder="Ex: 6"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preço por Unidade
                </label>
                <Input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder={`Ex: ${(retailPrice * 0.9).toFixed(2)}`}
                  step="0.01"
                  min="0.01"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} size="sm">
                Adicionar Faixa
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false)
                  setNewMinQty('')
                  setNewPrice('')
                  setError(null)
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Faixa de Atacado
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
