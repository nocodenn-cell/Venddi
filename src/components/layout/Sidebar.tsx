import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store/auth'
import {
  Home,
  LayoutDashboard,
  Package,
  Users,
  Warehouse,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Receipt,
  BarChart3,
  HelpCircle,
} from 'lucide-react'
import { useState } from 'react'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

const menuItems = [
  {
    section: 'Início',
    items: [
      { icon: Home, label: 'Início', path: '/app/inicio', permission: undefined },
    ]
  },
  { 
    section: 'PDV',
    items: [
      { icon: ShoppingCart, label: 'Frente de Caixa', path: '/app/pdv', permission: 'sales.write' },
    ]
  },
  {
    section: 'Gestão',
    items: [
      { icon: LayoutDashboard, label: 'Painel', path: '/app/gestao', permission: 'dashboard.read' },
      { icon: Package, label: 'Produtos', path: '/app/produtos', permission: 'products.read' },
      { icon: Warehouse, label: 'Estoque', path: '/app/estoque', permission: 'stock.read' },
      { icon: Receipt, label: 'Vendas', path: '/app/vendas', permission: 'sales.read' },
      { icon: DollarSign, label: 'Caixas', path: '/app/caixas', permission: 'cashier.read' },
    ]
  },
  {
    section: 'Administração',
    items: [
      { icon: Users, label: 'Funcionários', path: '/app/funcionarios', permission: 'users.read' },
      { icon: DollarSign, label: 'Financeiro', path: '/app/financeiro', permission: 'financial.read' },
      { icon: BarChart3, label: 'Relatórios', path: '/app/relatorios', permission: 'reports.read' },
      { icon: HelpCircle, label: 'Central de Ajuda', path: '/app/ajuda', permission: 'settings.read' },
      { icon: Settings, label: 'Hardware', path: '/app/hardware', permission: 'settings.read' },
      { icon: Settings, label: 'Configurações', path: '/app/configuracoes', permission: 'settings.read' },
    ]
  },
]

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { user, logout, checkPermission } = useAuthStore()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900">Venddi</span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 bg-[#0EA572] rounded-lg flex items-center justify-center mx-auto">
            <svg width="20" height="20" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <path d="M 18 20 L 30 42 L 42 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <path d="M 24 32 L 28 36 L 36 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
            </svg>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {menuItems.map((section) => (
          <div key={section.section} className="mb-6">
            {!isCollapsed && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                {section.section}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const hasAccess = !item.permission || checkPermission(item.permission)
                if (!hasAccess) return null

                const isActive = location.pathname === item.path
                const Icon = item.icon

                return (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      onMouseEnter={() => setHoveredItem(item.path)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group',
                        isActive
                          ? 'bg-[#D1FAE5] text-[#087A54] font-medium'
                          : 'text-gray-700 hover:bg-gray-50',
                        isCollapsed && 'justify-center'
                      )}
                    >
                      <Icon className={cn('h-5 w-5 flex-shrink-0', isActive && 'text-[#0EA572]')} />
                      {!isCollapsed && <span className="text-sm">{item.label}</span>}
                      
                      {/* Tooltip */}
                      {isCollapsed && hoveredItem === item.path && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                          {item.label}
                        </div>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-2">
        {!isCollapsed && user && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={() => logout().catch((err) => console.error('Falha ao sair:', err))}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-gray-700 hover:bg-red-50 hover:text-red-600 transition-all',
            isCollapsed && 'justify-center'
          )}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  )
}
