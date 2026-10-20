import { Badge } from '@/components/ui'
import { TrendingDown, Info } from 'lucide-react'
import type { PriceResolution } from '@/lib/schemas/wholesale'
import { formatBRL } from '@/lib/schemas/wholesale'

interface WholesaleIndicatorProps {
  priceResolution: PriceResolution | null
  currentQuantity: number
}

export function WholesaleIndicator({
  priceResolution,
  currentQuantity,
}: WholesaleIndicatorProps) {
  if (!priceResolution) return null

  const { origin, wholesaleTierMinQty, unitPrice, retailPrice, nextTierInfo } = priceResolution

  // Show wholesale badge if applied
  if (origin === 'wholesale' && wholesaleTierMinQty) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="primary" className="flex items-center gap-1">
          <TrendingDown className="h-3 w-3" />
          Atacado: {wholesaleTierMinQty}+ un.
        </Badge>
        {nextTierInfo && (
          <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
            <Info className="h-3 w-3" />
            <span>
              Adicione {nextTierInfo.quantityToAdd} para pagar {formatBRL(nextTierInfo.unitPrice)}/un.
            </span>
          </div>
        )}
      </div>
    )
  }

  // Show next tier info if close to wholesale
  if (origin === 'retail' && nextTierInfo) {
    return (
      <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
        <Info className="h-3 w-3" />
        <span>
          Adicione {nextTierInfo.quantityToAdd} para preço atacado: {formatBRL(nextTierInfo.unitPrice)}/un.
        </span>
      </div>
    )
  }

  return null
}

interface PriceBreakdownProps {
  priceResolution: PriceResolution | null
  quantity: number
  showCost?: boolean
}

export function PriceBreakdown({
  priceResolution,
  quantity,
  showCost = false,
}: PriceBreakdownProps) {
  if (!priceResolution) return null

  const {
    unitPrice,
    retailPrice,
    costPrice,
    origin,
    grossProfit,
    grossMarginPercent,
    markupPercent,
  } = priceResolution

  const total = unitPrice * quantity
  const savings = (retailPrice - unitPrice) * quantity

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-gray-600">Preço unitário:</span>
        <span className="font-medium">{formatBRL(unitPrice)}</span>
      </div>
      
      {origin === 'wholesale' && savings > 0 && (
        <div className="flex items-center justify-between text-green-700">
          <span>Economia (vs varejo):</span>
          <span className="font-medium">-{formatBRL(savings)}</span>
        </div>
      )}
      
      <div className="flex items-center justify-between border-t pt-2">
        <span className="font-semibold">Total:</span>
        <span className="font-bold text-lg">{formatBRL(total)}</span>
      </div>

      {showCost && costPrice !== null && (
        <div className="border-t pt-2 mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Custo:</span>
            <span>{formatBRL(costPrice)}</span>
          </div>
          {grossProfit !== null && (
            <div className="flex items-center justify-between text-xs">
              <span>Lucro bruto:</span>
              <span className={grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                {formatBRL(grossProfit)}
              </span>
            </div>
          )}
          {grossMarginPercent !== null && (
            <div className="flex items-center justify-between text-xs">
              <span>Margem bruta:</span>
              <span className={grossMarginPercent >= 0 ? 'text-green-700' : 'text-red-700'}>
                {grossMarginPercent.toFixed(2)}%
              </span>
            </div>
          )}
          {markupPercent !== null && (
            <div className="flex items-center justify-between text-xs">
              <span>Markup:</span>
              <span className={markupPercent >= 0 ? 'text-green-700' : 'text-red-700'}>
                {markupPercent.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
