import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import { useAuthStore } from '@/store/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'

// ── Fase 1 ──
import { LoginPage }       from '@/pages/auth/LoginPage'
import { DashboardPage }   from '@/pages/dashboard/DashboardPage'
import { ClientesPage }    from '@/pages/clientes/ClientesPage'
import { ClienteNovoPage } from '@/pages/clientes/ClienteNovoPage'
import { ClienteDetalhe }  from '@/pages/clientes/ClienteDetalhe'
import { ServicosPage }    from '@/pages/servicos/ServicosPage'

// ── Fase 2 ──
import { OrcamentosPage }    from '@/pages/orcamentos/OrcamentosPage'
import { OrcamentoFormPage } from '@/pages/orcamentos/OrcamentoFormPage'
import { OSPage }            from '@/pages/os/OSPage'
import { OSFormPage }        from '@/pages/os/OSFormPage'
import { OSDetalhePage }     from '@/pages/os/OSDetalhePage'

// ── Fase 3 ──
import { FinanceiroPage } from '@/pages/financeiro/FinanceiroPage'
import { EstoquePage }    from '@/pages/estoque/EstoquePage'

// ── Fase 4 ──
import { RelatoriosPage }    from '@/pages/relatorios/RelatoriosPage'
import { ConfiguracoesPage } from '@/pages/configuracoes/ConfiguracoesPage'

// ── Utilitários ──
import { PerfilPage } from '@/pages/perfil/PerfilPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
})

function AppInitializer() {
  const { initialize } = useAuthStore()
  useEffect(() => { initialize() }, [initialize])
  return null
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/"      element={<Navigate to="/dashboard" replace />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/perfil"    element={<PerfilPage />} />

              {/* Fase 1 */}
              <Route path="/clientes"      element={<ClientesPage />} />
              <Route path="/clientes/novo" element={<ClienteNovoPage />} />
              <Route path="/clientes/:id"  element={<ClienteDetalhe />} />
              <Route path="/servicos"      element={<ServicosPage />} />

              {/* Fase 2 */}
              <Route path="/orcamentos"      element={<OrcamentosPage />} />
              <Route path="/orcamentos/novo" element={<OrcamentoFormPage />} />
              <Route path="/orcamentos/:id"  element={<OrcamentoFormPage />} />
              <Route path="/os"              element={<OSPage />} />
              <Route path="/os/nova"         element={<OSFormPage />} />
              <Route path="/os/:id"          element={<OSDetalhePage />} />

              {/* Fase 3 — financeiro + admin */}
              <Route element={<ProtectedRoute roles={['admin','financeiro']} />}>
                <Route path="/financeiro"      element={<FinanceiroPage />} />
                <Route path="/financeiro/novo" element={<FinanceiroPage />} />
                <Route path="/relatorios"      element={<RelatoriosPage />} />
              </Route>

              {/* Fase 3 — estoque */}
              <Route element={<ProtectedRoute roles={['admin','financeiro','tecnico']} />}>
                <Route path="/estoque"              element={<EstoquePage />} />
                <Route path="/estoque/movimentacao" element={<EstoquePage />} />
              </Route>

              {/* Fase 4 — admin */}
              <Route element={<ProtectedRoute roles={['admin']} />}>
                <Route path="/configuracoes" element={<ConfiguracoesPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              fontFamily: '"DM Sans", sans-serif',
              fontSize: '13px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgb(0 0 0 / 0.08)',
              padding: '10px 14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
