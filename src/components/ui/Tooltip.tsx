import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  visible?: boolean
  onDismiss?: () => void
}

export function Tooltip({ content, children, position = 'top', visible = false, onDismiss }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(visible)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsVisible(visible)
  }, [visible])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent',
  }

  if (!isVisible) return <>{children}</>

  return (
    <div className="relative inline-block">
      {children}
      <div
        ref={tooltipRef}
        className={cn(
          'absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs',
          'animate-in fade-in-0 zoom-in-95',
          positionClasses[position]
        )}
      >
        {content}
        <div
          className={cn(
            'absolute w-0 h-0 border-4',
            arrowClasses[position]
          )}
        />
        <button
          onClick={handleDismiss}
          className="absolute top-1 right-1 text-gray-400 hover:text-white text-xs"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// Hook para gerenciar tooltips de onboarding
export function useOnboardingTooltip(stepId: string) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const hasSeenTooltip = localStorage.getItem(`venddi_tooltip_${stepId}`)
    if (!hasSeenTooltip) {
      setIsVisible(true)
    }
  }, [stepId])

  const dismiss = () => {
    setIsVisible(false)
    localStorage.setItem(`venddi_tooltip_${stepId}`, 'true')
  }

  return { isVisible, dismiss }
}
