import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store/auth'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { TrialGuard } from '@/hooks/useTrialStatus'
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
import { SalesHistoryPage } from '@/pages/SalesHistoryPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, company } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  // TODO: Add trial validation when Supabase is configured
  // For now, allow access to all authenticated users
  // In production, check if trial is active or subscription is paid
  
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
              <TrialGuard>
                <AdminLayout />
              </TrialGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/pdv" replace />} />
          
          {/* PDV - Ponto de Venda */}
          <Route path="pdv" element={<PDVPage />} />
          
          {/* Gestão e Administração */}
          <Route path="gestao" element={<ManagementDashboardPage />} />
          <Route path="produtos" element={<ProductsPage />} />
          <Route path="estoque" element={<PlaceholderPage title="Estoque" description="Controle de estoque e movimentações" />} />
          <Route path="vendas" element={<SalesHistoryPage />} />
          <Route path="caixas" element={<CashRegisterPage />} />
          <Route path="financeiro" element={<FinancialPage />} />
          <Route path="funcionarios" element={<PlaceholderPage title="Funcionários" description="Gestão de equipe e permissões" />} />
          <Route path="relatorios" element={<ManagementDashboardPage />} />
          <Route path="ajuda" element={<HelpCenterPage />} />
          <Route path="hardware" element={<HardwareSettingsPage />} />
          <Route path="configuracoes" element={<PlaceholderPage title="Configurações" description="Configurações da loja" />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
