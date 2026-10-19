import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { ExportPage } from '@/pages/ExportPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />
  }
  
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/export" element={<ExportPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="customers" element={<PlaceholderPage title="Clientes" description="Gerencie seus clientes e fornecedores" />} />
          <Route path="inventory" element={<PlaceholderPage title="Estoque" description="Controle de estoque e movimentações" />} />
          <Route path="pos" element={<PlaceholderPage title="PDV" description="Ponto de venda" />} />
          <Route path="cashier" element={<PlaceholderPage title="Caixa" description="Abertura, fechamento e conferência de caixa" />} />
          <Route path="financial" element={<PlaceholderPage title="Financeiro" description="Contas a pagar e receber, fluxo de caixa" />} />
          <Route path="settings" element={<PlaceholderPage title="Configurações" description="Configurações da empresa e usuários" />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
