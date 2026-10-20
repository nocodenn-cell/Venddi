import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui'
import { Search, Package, X } from 'lucide-react'
import { getProducts } from '@/lib/api/products'
import type { Product } from '@/lib/api/products'

interface QuickProductSearchProps {
  onProductSelect: (product: Product) => void
  placeholder?: string
  autoFocus?: boolean
}

export function QuickProductSearch({
  onProductSelect,
  placeholder = 'Buscar produto (nome, SKU ou código de barras)...',
  autoFocus = true,
}: QuickProductSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showResults, setShowResults] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  useEffect(() => {
    const searchProducts = async () => {
      if (query.length < 2) {
        setResults([])
        setShowResults(false)
        return
      }

      setIsSearching(true)
      try {
        const result = await getProducts({ search: query })
        setResults(result.data)
        setShowResults(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Error searching products:', error)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }

    const timeoutId = setTimeout(searchProducts, 300)
    return () => clearTimeout(timeoutId)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return

    // Seta para baixo
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
    }

    // Seta para cima
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    }

    // Enter para selecionar
    if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(results[selectedIndex])
    }

    // ESC para fechar
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowResults(false)
      setQuery('')
    }
  }

  const handleSelect = (product: Product) => {
    onProductSelect(product)
    setQuery('')
    setShowResults(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  const handleClear = () => {
    setQuery('')
    setShowResults(false)
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="pl-10 pr-10 h-12 text-base"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Resultados da busca */}
      {showResults && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50"
        >
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0EA572] mx-auto mb-2"></div>
              Buscando produtos...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              Nenhum produto encontrado
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left ${
                    index === selectedIndex ? 'bg-[#D1FAE5]' : ''
                  }`}
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>SKU: {product.sku}</span>
                      {product.barcode && <span>• {product.barcode}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-[#0EA572]">
                      R$ {product.sellPrice.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Estoque: {product.stockQuantity}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
