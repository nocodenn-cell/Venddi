import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  pageSize?: number
  onPageSizeChange?: (pageSize: number) => void
  totalItems?: number
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  
  // Show only a window of pages around current page
  const getPageNumbers = () => {
    const delta = 2
    const range = []
    
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i)
    }
    
    if (currentPage - delta > 2) {
      range.unshift('...')
    }
    if (currentPage + delta < totalPages - 1) {
      range.push('...')
    }
    
    range.unshift(1)
    if (totalPages > 1) {
      range.push(totalPages)
    }
    
    return range
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-2">
        {totalItems !== undefined && (
          <span className="text-sm text-gray-600">
            Total: {totalItems} {totalItems === 1 ? 'item' : 'itens'}
          </span>
        )}
        {pageSize && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        )}
      </div>
      
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentPage === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        {getPageNumbers().map((page, i) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
                ...
              </span>
            )
          }
          
          return (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={cn(
                'min-w-[32px] h-8 px-2 rounded-lg text-sm font-medium transition-colors',
                currentPage === page
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {page}
            </button>
          )
        })}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            'p-2 rounded-lg transition-colors',
            currentPage === totalPages
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
