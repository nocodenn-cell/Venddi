import { useState, useEffect } from 'react'
import { Input } from '@/components/ui'
import {
  calcGrossProfit,
  calcGrossMarginPercent,
  calcMarkupPercent,
  calcPriceForMargin,
  formatPercent,
  formatBRL,
} from '@/lib/schemas/wholesale'

interface MarginCalculatorProps {
  costPrice: number | null
  sellPrice: number
  onSellPriceChange: (price: number) => void
  disabled?: boolean
}

export function MarginCalculator({
  costPrice,
  sellPrice,
  onSellPriceChange,
  disabled = false,
}: MarginCalculatorProps) {
  const [desiredMargin, setDesiredMargin] = useState<string>('')
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null)
  const [isCalculatingSuggestion, setIsCalculatingSuggestion] = useState(false)

  const grossProfit = calcGrossProfit(sellPrice, costPrice)
  const grossMarginPercent = calcGrossMarginPercent(sellPrice, costPrice)
  const markupPercent = calcMarkupPercent(sellPrice, costPrice)

  // Calculate suggested price when desired margin changes
  useEffect(() => {
    if (!isCalculatingSuggestion) return

    const margin = parseFloat(desiredMargin)
    if (isNaN(margin) || costPrice === null || costPrice === undefined) {
      setSuggestedPrice(null)
      return
    }

    try {
      const price = calcPriceForMargin(costPrice, margin)
      setSuggestedPrice(price)
    } catch {
      setSuggestedPrice(null)
    }
  }, [desiredMargin, costPrice, isCalculatingSuggestion])

  const handleApplySuggestion = () => {
    if (suggestedPrice !== null) {
      // Round to 2 decimals
      const roundedPrice = Math.round(suggestedPrice * 100) / 100
      onSellPriceChange(roundedPrice)
      setIsCalculatingSuggestion(false)
      setDesiredMargin('')
      setSuggestedPrice(null)
    }
  }

  const handleDesiredMarginChange = (value: string) => {
    setDesiredMargin(value)
    setIsCalculatingSuggestion(true)
  }

  const isPriceBelowCost = costPrice !== null && sellPrice < costPrice
  const isMarginNegative = grossMarginPercent !== null && grossMarginPercent < 0

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
      <h4 className="font-semibold text-gray-900 text-sm">Cálculo de Margem</h4>

      {/* Cost and Sell Price */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Preço de Custo (R$)"
          type="number"
          step="0.01"
          value={costPrice ?? ''}
          disabled
          hint={costPrice === null ? 'Custo não informado' : undefined}
        />
        <Input
          label="Preço de Venda (R$)"
          type="number"
          step="0.01"
          value={sellPrice}
          onChange={(e) => onSellPriceChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
        />
      </div>

      {/* Margin Calculations */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Lucro Bruto</p>
          <p className={`text-lg font-bold ${
            grossProfit === null ? 'text-gray-400' : 
            grossProfit >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {formatBRL(grossProfit)}
          </p>
        </div>
        <div className="p-3 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Margem Bruta</p>
          <p className={`text-lg font-bold ${
            grossMarginPercent === null ? 'text-gray-400' :
            grossMarginPercent >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {formatPercent(grossMarginPercent)}
          </p>
        </div>
        <div className="p-3 bg-white rounded border border-gray-200">
          <p className="text-xs text-gray-600 mb-1">Markup</p>
          <p className={`text-lg font-bold ${
            markupPercent === null ? 'text-gray-400' :
            markupPercent >= 0 ? 'text-green-700' : 'text-red-700'
          }`}>
            {formatPercent(markupPercent)}
          </p>
        </div>
      </div>

      {/* Warnings */}
      {isPriceBelowCost && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          ⚠️ Preço de venda está abaixo do custo. Você terá prejuízo em cada venda.
        </div>
      )}

      {costPrice === null && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          ℹ️ Custo não informado. Margem e markup não podem ser calculados.
        </div>
      )}

      {/* Price Suggestion */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">
          Calcular preço para margem desejada:
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Margem Desejada (%)"
              type="number"
              step="0.01"
              min="0"
              max="99.99"
              value={desiredMargin}
              onChange={(e) => handleDesiredMarginChange(e.target.value)}
              placeholder="Ex: 40"
              disabled={disabled || costPrice === null}
            />
          </div>
          {suggestedPrice !== null && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço Sugerido
              </label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[#0EA572]">
                  {formatBRL(suggestedPrice)}
                </span>
                <button
                  type="button"
                  onClick={handleApplySuggestion}
                  disabled={disabled}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
        {parseFloat(desiredMargin) >= 100 && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Margem deve ser menor que 100%
          </p>
        )}
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 border-t pt-3">
        <p className="font-medium mb-1">Fórmulas utilizadas:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Lucro Bruto = Preço de Venda - Custo</li>
          <li>Margem Bruta = (Lucro Bruto / Preço de Venda) × 100</li>
          <li>Markup = (Lucro Bruto / Custo) × 100</li>
          <li>Preço Sugerido = Custo / (1 - Margem Desejada / 100)</li>
        </ul>
      </div>
    </div>
  )
}
