import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from '@/components/ui'
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, ShoppingBag, AlertCircle } from 'lucide-react'
import { createSale } from '@/lib/api/sales'
import { getOpenCashRegister } from '@/lib/api/cashRegister'
import { useAuthStore } from '@/lib/store/auth'
import { v4 as uuidv4 } from 'uuid'

interface CartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
}

interface Payment {
  method: 'cash' | 'credit_card' | 'debit_card' | 'pix'
  amount: number
  receivedAmount?: number
  changeAmount?: number
}

export function PDVPage() {
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [cashRegisterId, setCashRegisterId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [lastSale, setLastSale] = useState<any>(null)

  // Check if cash register is open
  useEffect(() => {
    const checkCashRegister = async () => {
      if (!user) return
      
      try {
        const openRegister = await getOpenCashRegister(user.id)
        if (openRegister) {
          setCashRegisterId(openRegister.id)
        } else {
          setCashRegisterId(null)
        }
      } catch (err) {
        console.error('Error checking cash register:', err)
      }
    }
    
    checkCashRegister()
  }, [user])

  // Mock products
  const products = [
    { id: '1', name: 'Camiseta Básica', sku: 'CAM-001', price: 49.90 },
    { id: '2', name: 'Calça Jeans', sku: 'CAL-002', price: 129.90 },
    { id: '3', name: 'Tênis Esportivo', sku: 'TEN-003', price: 199.90 },
    { id: '4', name: 'Boné Trucker', sku: 'BON-004', price: 39.90 },
    { id: '5', name: 'Meia Esportiva', sku: 'MEI-005', price: 19.90 },
  ]

  const addToCart = (product: typeof products[0]) => {
    const existingItem = cart.find(item => item.id === product.id)
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQuantity = item.quantity + delta
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
  }

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-4">
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar produto por nome ou SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-10 pr-4 rounded-lg border border-gray-300 text-base focus:outline-none focus:ring-2 focus:ring-[#0EA572] focus:border-[#0EA572]"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#0EA572] hover:shadow-md transition-all text-left"
              >
                <div className="w-full h-20 bg-[#D1FAE5] rounded-lg flex items-center justify-center mb-3">
                  <ShoppingBag className="h-8 w-8 text-[#0EA572]" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-2">{product.sku}</p>
                <p className="text-lg font-bold text-[#0EA572]">
                  R$ {product.price.toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-96 flex flex-col bg-white border-l border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Carrinho</h2>
          <p className="text-sm text-gray-500">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Carrinho vazio</p>
              <p className="text-sm text-gray-400 mt-1">Adicione produtos para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 text-sm">{item.name}</h4>
                      <p className="text-xs text-gray-500">{item.sku}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="font-bold text-[#0EA572]">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-[#0EA572]">
              R$ {total.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="flex flex-col gap-1 h-auto py-3">
              <Banknote className="h-5 w-5" />
              <span className="text-xs">Dinheiro</span>
            </Button>
            <Button variant="outline" className="flex flex-col gap-1 h-auto py-3">
              <CreditCard className="h-5 w-5" />
              <span className="text-xs">Cartão</span>
            </Button>
            <Button variant="outline" className="flex flex-col gap-1 h-auto py-3">
              <QrCode className="h-5 w-5" />
              <span className="text-xs">PIX</span>
            </Button>
          </div>

          <Button 
            size="lg" 
            className="w-full"
            disabled={cart.length === 0 || !cashRegisterId}
            onClick={() => setShowPaymentModal(true)}
          >
            Finalizar Venda
          </Button>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setPayments([])
        }}
        title="Finalizar Venda"
        description={`Total: R$ ${total.toFixed(2)}`}
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!cashRegisterId && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
              <AlertCircle className="h-4 w-4 inline mr-2" />
              Abra o caixa antes de realizar vendas
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Formas de Pagamento</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const remaining = total - payments.reduce((sum, p) => sum + p.amount, 0)
                  if (remaining > 0) {
                    setPayments([...payments, { method: 'cash', amount: remaining, receivedAmount: remaining, changeAmount: 0 }])
                  }
                }}
                disabled={payments.reduce((sum, p) => sum + p.amount, 0) >= total}
              >
                <Banknote className="h-4 w-4 mr-2" />
                Dinheiro
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  const remaining = total - payments.reduce((sum, p) => sum + p.amount, 0)
                  if (remaining > 0) {
                    setPayments([...payments, { method: 'credit_card', amount: remaining }])
                  }
                }}
                disabled={payments.reduce((sum, p) => sum + p.amount, 0) >= total}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Cartão
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  const remaining = total - payments.reduce((sum, p) => sum + p.amount, 0)
                  if (remaining > 0) {
                    setPayments([...payments, { method: 'debit_card', amount: remaining }])
                  }
                }}
                disabled={payments.reduce((sum, p) => sum + p.amount, 0) >= total}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Débito
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  const remaining = total - payments.reduce((sum, p) => sum + p.amount, 0)
                  if (remaining > 0) {
                    setPayments([...payments, { method: 'pix', amount: remaining }])
                  }
                }}
                disabled={payments.reduce((sum, p) => sum + p.amount, 0) >= total}
              >
                <QrCode className="h-4 w-4 mr-2" />
                PIX
              </Button>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Pagamentos Adicionados</h4>
              {payments.map((payment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">
                    {payment.method === 'cash' && 'Dinheiro'}
                    {payment.method === 'credit_card' && 'Cartão de Crédito'}
                    {payment.method === 'debit_card' && 'Cartão de Débito'}
                    {payment.method === 'pix' && 'PIX'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">R$ {payment.amount.toFixed(2)}</span>
                    <button
                      onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="flex justify-between pt-2 border-t">
                <span className="font-semibold">Total Pago:</span>
                <span className="font-semibold text-[#0EA572]">
                  R$ {payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                </span>
              </div>
              
              {payments.reduce((sum, p) => sum + p.amount, 0) < total && (
                <div className="text-sm text-red-600">
                  Faltam R$ {(total - payments.reduce((sum, p) => sum + p.amount, 0)).toFixed(2)}
                </div>
              )}
              
              {payments.reduce((sum, p) => sum + p.amount, 0) > total && (
                <div className="text-sm text-amber-600">
                  Troco: R$ {(payments.reduce((sum, p) => sum + p.amount, 0) - total).toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentModal(false)
                setPayments([])
                setError(null)
              }}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!user || !cashRegisterId) return
                
                const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
                if (Math.abs(totalPaid - total) > 0.01) {
                  setError('Total dos pagamentos não corresponde ao total da venda')
                  return
                }

                setIsProcessing(true)
                setError(null)

                try {
                  const sale = await createSale({
                    idempotencyKey: uuidv4(),
                    items: cart.map(item => ({
                      productId: item.id,
                      productName: item.name,
                      quantity: item.quantity,
                      unitPrice: item.price,
                      discount: 0,
                      subtotal: item.price * item.quantity,
                    })),
                    payments: payments.map(p => ({
                      method: p.method,
                      amount: p.amount,
                      installments: 1,
                      receivedAmount: p.receivedAmount,
                      changeAmount: p.changeAmount || 0,
                    })),
                    operatorId: user.id,
                    operatorName: user.fullName,
                    cashRegisterId,
                    discount: 0,
                    additionalExpenses: 0,
                  })

                  setLastSale(sale)
                  setCart([])
                  setPayments([])
                  setShowPaymentModal(false)
                  
                  // Show success message
                  alert(`Venda #${sale.saleNumber} finalizada com sucesso!\nTotal: R$ ${sale.total.toFixed(2)}`)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Erro ao finalizar venda')
                } finally {
                  setIsProcessing(false)
                }
              }}
              disabled={
                isProcessing ||
                !cashRegisterId ||
                payments.length === 0 ||
                Math.abs(payments.reduce((sum, p) => sum + p.amount, 0) - total) > 0.01
              }
              className="flex-1"
            >
              {isProcessing ? 'Processando...' : 'Confirmar Venda'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
