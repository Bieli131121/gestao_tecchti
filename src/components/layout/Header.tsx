import { useState, useRef, useEffect } from 'react'
import { Menu, Bell, Search } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotificacoes } from '@/hooks/useNotificacoes'
import { Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard':     { title: 'Dashboard',         subtitle: 'Visão geral do negócio'      },
  '/clientes':      { title: 'Clientes',          subtitle: 'Gestão de clientes'          },
  '/servicos':      { title: 'Serviços',          subtitle: 'Catálogo de serviços'        },
  '/orcamentos':    { title: 'Orçamentos',        subtitle: 'Propostas e cotações'        },
  '/os':            { title: 'Ordens de Serviço', subtitle: 'Atendimentos e chamados'     },
  '/financeiro':    { title: 'Financeiro',        subtitle: 'Receitas, despesas e fluxo' },
  '/estoque':       { title: 'Estoque',           subtitle: 'Produtos e materiais'        },
  '/relatorios':    { title: 'Relatórios',        subtitle: 'Análises e exportações'      },
  '/configuracoes': { title: 'Configurações',     subtitle: 'Empresa, usuários e sistema' },
}

const TIPO_ICON: Record<string, string> = {
  estoque_baixo: '📦', vencimento: '💰', os_aberta: '🔧', os_atrasada: '⏰',
}

export function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const location = useLocation()
  const { user }  = useAuthStore()
  const { notificacoes, total, urgentes, loading } = useNotificacoes()
  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const basePath = '/' + location.pathname.split('/')[1]
  const pageInfo = PAGE_TITLES[basePath] || { title: 'TecchTI' }

  useEffect(() => {
    function h(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <header className="sticky top-0 z-20 h-[60px] bg-white/95 backdrop-blur border-b border-surface-100 flex items-center px-4 gap-3">
      <button onClick={onMenuToggle}
        className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center text-surface-500 hover:bg-surface-100 transition-colors">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-display font-bold text-surface-900 truncate leading-tight">{pageInfo.title}</h1>
        {pageInfo.subtitle && (
          <p className="text-[11px] text-surface-400 hidden sm:block leading-tight truncate">{pageInfo.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button className="hidden md:flex w-8 h-8 rounded-xl items-center justify-center text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Notification bell */}
        <div ref={notifRef} className="relative">
          <button onClick={() => setNotifOpen(v => !v)}
            className={cn('relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors',
              notifOpen ? 'bg-brand-50 text-brand-600' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600')}>
            <Bell className="w-4 h-4" />
            {total > 0 && (
              <span className={cn('absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center',
                urgentes > 0 ? 'bg-red-500' : 'bg-brand-500')}>
                {total > 99 ? '99+' : total}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-2xl border border-surface-100 shadow-modal z-50 overflow-hidden animate-slide-in-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-50">
                <span className="text-sm font-display font-semibold text-surface-800">Notificações</span>
                {total > 0 && <span className="text-xs text-surface-400">{total} alerta{total !== 1 ? 's' : ''}</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading && <div className="py-8 text-center text-sm text-surface-400">Carregando...</div>}
                {!loading && notificacoes.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-2xl mb-2">✅</p>
                    <p className="text-sm text-surface-500">Tudo em dia!</p>
                    <p className="text-xs text-surface-400 mt-1">Nenhum alerta pendente</p>
                  </div>
                )}
                {notificacoes.map(n => (
                  <Link key={n.id} to={n.link} onClick={() => setNotifOpen(false)}
                    className={cn('flex items-start gap-3 px-4 py-3 border-b border-surface-50 hover:bg-surface-50 transition-colors',
                      n.urgente ? 'bg-red-50/40' : '')}>
                    <span className="text-lg flex-shrink-0 mt-0.5">{TIPO_ICON[n.tipo]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-surface-700 truncate">{n.titulo}</p>
                        {n.urgente && <span className="flex-shrink-0 text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">URGENTE</span>}
                      </div>
                      <p className="text-xs text-surface-500 mt-0.5 leading-relaxed line-clamp-2">{n.mensagem}</p>
                    </div>
                  </Link>
                ))}
              </div>
              {total > 0 && (
                <div className="px-4 py-2.5 border-t border-surface-50 bg-surface-50/50">
                  <p className="text-xs text-surface-400 text-center">Clique para ir direto ao módulo</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2 ml-1 pl-2 border-l border-surface-100">
            <Avatar name={user.nome} size="sm" />
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-surface-700 leading-tight truncate max-w-[100px]">{user.nome.split(' ')[0]}</p>
              <p className="text-[10px] text-surface-400 leading-tight capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
