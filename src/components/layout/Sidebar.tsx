import { NavLink, useLocation, Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui'
import {
  LayoutDashboard, Users, Wrench, FileText, ClipboardList,
  DollarSign, Package, FileBarChart2, Settings, X,
  LogOut, ChevronRight, Zap, UserCircle
} from 'lucide-react'

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
  roles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         icon: LayoutDashboard, to: '/dashboard'    },
  { label: 'Clientes',          icon: Users,           to: '/clientes'     },
  { label: 'Serviços',          icon: Wrench,          to: '/servicos'     },
  { label: 'Orçamentos',        icon: FileText,        to: '/orcamentos'   },
  { label: 'Ordens de Serviço', icon: ClipboardList,   to: '/os'           },
  { label: 'Financeiro',        icon: DollarSign,      to: '/financeiro',  roles: ['admin','financeiro'] },
  { label: 'Estoque',           icon: Package,         to: '/estoque',     roles: ['admin','financeiro','tecnico'] },
  { label: 'Relatórios',        icon: FileBarChart2,   to: '/relatorios',  roles: ['admin','financeiro'] },
  { label: 'Configurações',     icon: Settings,        to: '/configuracoes', roles: ['admin'] },
]

interface SidebarProps { open: boolean; onClose: () => void }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, signOut, hasRole } = useAuthStore()
  const location = useLocation()

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || hasRole(item.roles as any)
  )

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed top-0 left-0 h-full z-40 w-[260px] flex flex-col bg-surface-900',
        'transition-transform duration-300 ease-out',
        'lg:translate-x-0 lg:static lg:z-auto',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-surface-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-sm tracking-wide">TecchTI</span>
              <p className="text-[10px] text-surface-500 leading-none mt-0.5">Sistema de Gestão</p>
            </div>
          </div>
          <button onClick={onClose}
            className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleItems.map(item => {
            const isActive = location.pathname.startsWith(item.to)
            return (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                className={cn('sidebar-link group', isActive ? 'sidebar-link-active' : 'sidebar-link-inactive')}>
                <item.icon className={cn('w-4 h-4 flex-shrink-0 transition-colors',
                  isActive ? 'text-white' : 'text-surface-600 group-hover:text-surface-700')} />
                <span className="flex-1 text-sm">{item.label}</span>
                {!isActive && (
                  <ChevronRight className="w-3 h-3 text-surface-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* User footer */}
        {user && (
          <div className="px-3 pb-4 pt-2 border-t border-surface-800">
            <Link to="/perfil" onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-800 transition-colors group cursor-pointer">
              <Avatar name={user.nome} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-200 truncate leading-tight">{user.nome}</p>
                <p className="text-[11px] text-surface-500 truncate leading-tight capitalize">{user.role}</p>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div title="Meu perfil" className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-500 hover:text-surface-300 hover:bg-surface-700 transition-colors">
                  <UserCircle className="w-3.5 h-3.5" />
                </div>
                <button onClick={e => { e.preventDefault(); signOut() }} title="Sair"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-600 hover:text-red-400 hover:bg-surface-700 transition-colors">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
