import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Package, Plus, Search, Filter } from 'lucide-react'
import { Button, Input, Badge } from '@/components/ui'

// Mock data
const mockProducts = [
  { id: 1, name: 'Camiseta Básica', sku: 'CAM-001', barcode: '7891234567890', price: 49.9, stock: 25, minStock: 10, category: 'Vestuário', status: 'active' },
  { id: 2, name: 'Calça Jeans', sku: 'CAL-002', barcode: '7891234567891', price: 129.9, stock: 8, minStock: 10, category: 'Vestuário', status: 'active' },
  { id: 3, name: 'Tênis Esportivo', sku: 'TEN-003', barcode: '7891234567892', price: 199.9, stock: 15, minStock: 5, category: 'Calçados', status: 'active' },
  { id: 4, name: 'Boné Trucker', sku: 'BON-004', barcode: '7891234567893', price: 39.9, stock: 3, minStock: 10, category: 'Acessórios', status: 'active' },
  { id: 5, name: 'Meia Esportiva', sku: 'MEI-005', barcode: '7891234567894', price: 19.9, stock: 50, minStock: 20, category: 'Acessórios', status: 'active' },
]

export function ProductsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seu catálogo de produtos</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button variant="outline">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo ({mockProducts.length} produtos)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Produto</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Categoria</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Preço</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estoque</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockProducts.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.barcode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{product.sku}</td>
                    <td className="py-3 px-4 text-sm text-gray-700">{product.category}</td>
                    <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                      R$ {product.price.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-sm font-medium ${product.stock <= product.minStock ? 'text-red-600' : 'text-gray-900'}`}>
                        {product.stock}
                      </span>
                      {product.stock <= product.minStock && (
                        <Badge variant="danger" className="ml-2 text-xs">Baixo</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={product.status === 'active' ? 'success' : 'default'}>
                        {product.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
