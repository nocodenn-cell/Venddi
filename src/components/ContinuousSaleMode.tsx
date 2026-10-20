import { useState } from 'react'
import { Button } from '@/components/ui'
import { ShoppingCart, CheckCircle } from 'lucide-react'

interface ContinuousSaleModeProps {
  isActive: boolean
  onToggle: () => void
  salesCount: number
}

export function ContinuousSaleMode({
  isActive,
  onToggle,
  salesCount,
}: ContinuousSaleModeProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
          isActive
            ? 'bg-[#0EA572] text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {isActive ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <ShoppingCart className="h-5 w-5" />
        )}
        <span className="text-sm font-medium">
          {isActive ? 'Modo Contínuo Ativo' : 'Modo Contínuo'}
        </span>
      </button>
      {isActive && salesCount > 0 && (
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-[#0EA572]">{salesCount}</span>{' '}
          {salesCount === 1 ? 'venda' : 'vendas'} realizada{salesCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  )
}

interface QuickSaleButtonProps {
  onClick: () => void
  disabled?: boolean
}

export function QuickSaleButton({ onClick, disabled = false }: QuickSaleButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-full h-16 text-lg font-semibold"
    >
      <ShoppingCart className="h-6 w-6 mr-2" />
      Venda Rápida
    </Button>
  )
}
