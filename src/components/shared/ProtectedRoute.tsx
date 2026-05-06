import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoadingPage } from '@/components/ui'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  roles?: UserRole[]
}

export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { user, loading, initialized } = useAuthStore()
  if (!initialized || loading) return <LoadingPage />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
