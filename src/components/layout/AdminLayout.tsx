import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Bell, Search } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth'

export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { company } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isCollapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className={cn('transition-all duration-300', sidebarCollapsed ? 'ml-16' : 'ml-64')}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="w-full h-9 pl-10 pr-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {company && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{company.name}</p>
                <p className="text-xs text-gray-500">{company.cnpj}</p>
              </div>
            )}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
