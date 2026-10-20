import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { AlertTriangle, Package } from 'lucide-react'
import { getProducts } from '@/lib/api/products'
import type { Product } from '@/lib/api/products'

interface LowStockAlertsProps {
  companyId: string
}

export function LowStockAlerts({ companyId }: LowStockAlertsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLowStockProducts()
  }, [])

  const loadLowStockProducts = async () => {
    try {
      setLoading(true)
      const result = await getProducts({ lowStock: true })
      setProducts(result.data)
    } catch (error) {
      console.error('Error loading low stock products:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
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
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Alertas de Estoque Baixo
          {products.length > 0 && (
            <Badge variant="danger" className="ml-2">
              {products.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum produto com estoque baixo</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => {
              const percentage = (product.stockQuantity / product.minStock) * 100
              const isCritical = percentage <= 50

              return (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isCritical ? 'bg-red-100' : 'bg-amber-100'
                      }`}
                    >
                      <Package
                        className={`h-5 w-5 ${isCritical ? 'text-red-600' : 'text-amber-600'}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        isCritical ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {product.stockQuantity}
                    </p>
                    <p className="text-xs text-gray-500">
                      Mín: {product.minStock}
                    </p>
                  </div>
                </div>
              )
            })}
            {products.length > 5 && (
              <p className="text-sm text-gray-500 text-center pt-2">
                + {products.length - 5} produtos com estoque baixo
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
