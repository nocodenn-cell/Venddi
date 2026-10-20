import { useState, useEffect, useCallback } from 'react'

interface KeyboardShortcutsProps {
  onQuickSale: () => void
  onSearch: () => void
  onPayment: () => void
  onFinish: () => void
  onCancel: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({
  onQuickSale,
  onSearch,
  onPayment,
  onFinish,
  onCancel,
  enabled = true,
}: KeyboardShortcutsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Ignorar se estiver digitando em um input
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      // F2 - Venda rápida
      if (event.key === 'F2') {
        event.preventDefault()
        onQuickSale()
      }

      // F3 - Buscar produto
      if (event.key === 'F3') {
        event.preventDefault()
        onSearch()
      }

      // F4 - Pagamento
      if (event.key === 'F4') {
        event.preventDefault()
        onPayment()
      }

      // F5 - Finalizar venda
      if (event.key === 'F5') {
        event.preventDefault()
        onFinish()
      }

      // ESC - Cancelar/Fechar
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }

      // ? - Mostrar atalhos
      if (event.key === '?' && event.shiftKey) {
        event.preventDefault()
        setIsModalOpen(true)
      }
    },
    [enabled, onQuickSale, onSearch, onPayment, onFinish, onCancel]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { isModalOpen, setIsModalOpen }
}

export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  if (!isOpen) return null

  const shortcuts = [
    { key: 'F2', description: 'Venda rápida' },
    { key: 'F3', description: 'Buscar produto' },
    { key: 'F4', description: 'Pagamento' },
    { key: 'F5', description: 'Finalizar venda' },
    { key: 'ESC', description: 'Cancelar/Fechar' },
    { key: 'Shift + ?', description: 'Mostrar atalhos' },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Atalhos de Teclado
        </h2>
        <div className="space-y-3">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <span className="text-sm text-gray-700">{shortcut.description}</span>
              <kbd className="px-3 py-1 bg-gray-100 rounded text-sm font-mono text-gray-900">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        <Button onClick={onClose} className="w-full mt-6">
          Fechar
        </Button>
      </div>
    </div>
  )
}

// Helper component
function Button({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-[#0EA572] text-white rounded-lg hover:bg-[#087A54] transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
