import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { HomePage } from '@/pages/HomePage'
import { PricingPage } from '@/pages/PricingPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignUpPage } from '@/pages/SignUpPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PDVPage } from '@/pages/PDVPage'
import { CashRegisterPage } from '@/pages/CashRegisterPage'
import { FinancialPage } from '@/pages/FinancialPage'
import { ManagementDashboardPage } from '@/pages/ManagementDashboardPage'
import { HelpCenterPage } from '@/pages/HelpCenterPage'
import { HardwareSettingsPage } from '@/pages/HardwareSettingsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// Bloqueia a rota se o papel do usuário não tiver a permissão (ex.: cashier em /financeiro).
// Sem permissão, redireciona para o PDV, que todos os papéis acessam.
function PermissionRoute({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { checkPermission } = useAuthStore()

  if (!checkPermission(permission)) {
    return <Navigate to="/app/pdv" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  
  if (isAuthenticated) {
    return <Navigate to="/app/pdv" replace />
  }
  
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes - Site Comercial */}
        <Route path="/" element={<HomePage />} />
        <Route path="/precos" element={<PricingPage />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/cadastro" element={<PublicRoute><SignUpPage /></PublicRoute>} />
        
        {/* App Routes - PDV e Gestão */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/pdv" replace />} />
          
          {/* PDV - Ponto de Venda */}
          <Route path="pdv" element={<PDVPage />} />
          
          {/* Gestão e Administração */}
          <Route path="gestao" element={<PermissionRoute permission="reports.read"><ManagementDashboardPage /></PermissionRoute>} />
          <Route path="produtos" element={<PermissionRoute permission="products.read"><ProductsPage /></PermissionRoute>} />
          <Route path="estoque" element={<PermissionRoute permission="stock.read"><PlaceholderPage title="Estoque" description="Controle de estoque e movimentações" /></PermissionRoute>} />
          <Route path="vendas" element={<PermissionRoute permission="sales.read"><PlaceholderPage title="Vendas" description="Histórico de vendas" /></PermissionRoute>} />
          <Route path="caixas" element={<PermissionRoute permission="cashier.read"><CashRegisterPage /></PermissionRoute>} />
          <Route path="financeiro" element={<PermissionRoute permission="financial.read"><FinancialPage /></PermissionRoute>} />
          <Route path="funcionarios" element={<PermissionRoute permission="users.read"><PlaceholderPage title="Funcionários" description="Gestão de equipe e permissões" /></PermissionRoute>} />
          <Route path="relatorios" element={<PermissionRoute permission="reports.read"><ManagementDashboardPage /></PermissionRoute>} />
          <Route path="ajuda" element={<HelpCenterPage />} />
          <Route path="hardware" element={<PermissionRoute permission="settings.read"><HardwareSettingsPage /></PermissionRoute>} />
          <Route path="configuracoes" element={<PermissionRoute permission="settings.read"><PlaceholderPage title="Configurações" description="Configurações da loja" /></PermissionRoute>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
