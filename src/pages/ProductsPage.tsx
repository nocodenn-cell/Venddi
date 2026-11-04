import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal, Pagination } from '@/components/ui'
import { Package, Plus, Search, Filter, Edit, Trash2, AlertCircle, ArrowDownToLine } from 'lucide-react'
import { getProducts, createProduct, updateProduct, deleteProduct, registerStockEntry, type Product, type ProductInput, type ProductFilters } from '@/lib/api/products'
import { useAuthStore } from '@/lib/store/auth'
import { ProductForm } from '@/components/forms/ProductForm'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Entrada de estoque
  const { checkPermission } = useAuthStore()
  const canWriteProducts = checkPermission('products.write')
  const canDeleteProducts = checkPermission('products.delete')
  const [stockProduct, setStockProduct] = useState<Product | null>(null)
  const [stockQuantity, setStockQuantity] = useState('')
  const [stockReason, setStockReason] = useState('')
  const [stockError, setStockError] = useState<string | null>(null)
  const [isStockSubmitting, setIsStockSubmitting] = useState(false)

  // Load products
  const loadProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const filters: ProductFilters = {
        search: search || undefined,
      }
      
      const response = await getProducts(filters, { page: currentPage, pageSize })
      setProducts(response.data)
      setTotalPages(response.totalPages)
      setTotalItems(response.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [currentPage, pageSize, search])

  // Create product
  const handleCreate = async (data: ProductInput) => {
    try {
      setIsSubmitting(true)
      await createProduct(data)
      setIsModalOpen(false)
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar produto')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update product
  const handleUpdate = async (data: ProductInput) => {
    if (!editingProduct) return
    
    try {
      setIsSubmitting(true)
      await updateProduct(editingProduct.id, data)
      setIsModalOpen(false)
      setEditingProduct(null)
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar produto')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Delete product
  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    
    try {
      await deleteProduct(id)
      await loadProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto')
    }
  }

  // Open edit modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  // Entrada de estoque
  const openStockModal = (product: Product) => {
    setStockProduct(product)
    setStockQuantity('')
    setStockReason('')
    setStockError(null)
  }

  const closeStockModal = () => {
    setStockProduct(null)
  }

  const handleStockEntry = async () => {
    if (!stockProduct) return
    const quantity = Number(stockQuantity)
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setStockError('Informe uma quantidade inteira maior que zero')
      return
    }

    try {
      setIsStockSubmitting(true)
      setStockError(null)
      await registerStockEntry({
        productId: stockProduct.id,
        quantity,
        reason: stockReason.trim() || undefined,
      })
      closeStockModal()
      await loadProducts()
    } catch (err) {
      setStockError(err instanceof Error ? err.message : 'Erro ao registrar entrada de estoque')
    } finally {
      setIsStockSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seu catálogo de produtos</p>
        </div>
        {canWriteProducts && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nome, SKU ou código de barras..."
                icon={<Search className="h-4 w-4" />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1) // Reset to first page on search
                }}
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
          <CardTitle>Catálogo ({totalItems} produtos)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Carregando produtos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum produto encontrado</p>
              <p className="text-sm text-gray-400 mt-1">Tente ajustar os filtros ou cadastre um novo produto</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Preço</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Estoque</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{product.name}</p>
                              {product.barcode && (
                                <p className="text-xs text-gray-500">{product.barcode}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">{product.sku}</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">
                          R$ {product.sellPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`text-sm font-medium ${product.stockQuantity <= product.minStock ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stockQuantity}
                          </span>
                          {product.stockQuantity <= product.minStock && (
                            <Badge variant="danger" className="ml-2 text-xs">Baixo</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant={product.isActive ? 'success' : 'default'}>
                            {product.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canWriteProducts && (
                              <button
                                onClick={() => openStockModal(product)}
                                className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors"
                                title="Entrada de estoque"
                              >
                                <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                              </button>
                            )}
                            {canWriteProducts && (
                              <button
                                onClick={() => openEditModal(product)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Editar"
                              >
                                <Edit className="h-4 w-4 text-gray-600" />
                              </button>
                            )}
                            {canDeleteProducts && (
                              <button
                                onClick={() => handleDelete(product.id)}
                                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  pageSize={pageSize}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  totalItems={totalItems}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduct ? 'Editar Produto' : 'Novo Produto'}
        description={editingProduct ? 'Atualize as informações do produto' : 'Preencha os dados do novo produto'}
        size="lg"
      >
        <ProductForm
          initialData={editingProduct ? {
            name: editingProduct.name,
            sku: editingProduct.sku,
            barcode: editingProduct.barcode || undefined,
            description: editingProduct.description || undefined,
            costPrice: editingProduct.costPrice,
            sellPrice: editingProduct.sellPrice,
            stockQuantity: editingProduct.stockQuantity,
            minStock: editingProduct.minStock,
            isActive: editingProduct.isActive,
          } : undefined}
          onSubmit={editingProduct ? handleUpdate : handleCreate}
          onCancel={closeModal}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Entrada de estoque */}
      <Modal
        isOpen={stockProduct !== null}
        onClose={closeStockModal}
        title="Entrada de estoque"
        description={stockProduct ? `${stockProduct.name} — saldo atual: ${stockProduct.stockQuantity}` : undefined}
      >
        <div className="space-y-4">
          {stockError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {stockError}
            </div>
          )}
          <Input
            label="Quantidade recebida"
            type="number"
            min={1}
            step={1}
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            placeholder="Ex.: 10"
          />
          <Input
            label="Motivo ou nota (opcional)"
            value={stockReason}
            onChange={(e) => setStockReason(e.target.value)}
            placeholder="Ex.: Compra NF 1234"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeStockModal} disabled={isStockSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleStockEntry} disabled={isStockSubmitting}>
              {isStockSubmitting ? 'Registrando...' : 'Registrar entrada'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
