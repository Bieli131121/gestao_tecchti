import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { osService } from '@/lib/os'
import { useRealtime } from '@/hooks/useRealtime'
import {
  formatDate, formatCurrency, searchNormalize,
  OS_STATUS_BADGE, OS_STATUS_LABEL, PRIORIDADE_BADGE, PRIORIDADE_LABEL
} from '@/lib/utils'
import { SearchInput, EmptyState, ErrorState, LoadingPage, Pagination } from '@/components/ui'
import { ClipboardList, Plus, Eye, User, Calendar, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { OrdemServico, OSStatus } from '@/types'

const PAGE_SIZE = 20

const STATUS_TABS: { value: OSStatus | 'todos'; label: string }[] = [
  { value: 'todos',        label: 'Todas'       },
  { value: 'aberto',       label: 'Abertas'     },
  { value: 'em_andamento', label: 'Em andamento'},
  { value: 'pausado',      label: 'Pausadas'    },
  { value: 'concluido',    label: 'Concluídas'  },
  { value: 'cancelado',    label: 'Canceladas'  },
]

export function OSPage() {
  const [ordens, setOrdens]       = useState<OrdemServico[]>([])
  const [filtered, setFiltered]   = useState<OrdemServico[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [statusTab, setStatusTab] = useState<OSStatus | 'todos'>('todos')
  const [page, setPage]           = useState(1)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setOrdens(await osService.list()) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useRealtime(['ordens_servico'], load)

  useEffect(() => {
    const q = searchNormalize(search)
    setFiltered(ordens.filter(o => {
      if (statusTab !== 'todos' && o.status !== statusTab) return false
      if (!q) return true
      return (
        searchNormalize(o.numero).includes(q) ||
        searchNormalize(o.titulo).includes(q) ||
        searchNormalize(o.cliente?.nome || '').includes(q)
      )
    }))
    setPage(1)
  }, [search, statusTab, ordens])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Count per status for badges
  const counts = ordens.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  async function handleStatusChange(os: OrdemServico, status: OSStatus) {
    try {
      await osService.updateStatus(os.id, status)
      setOrdens(prev => prev.map(o => o.id === os.id ? { ...o, status } : o))
      toast.success(`OS #${os.numero} → ${OS_STATUS_LABEL[status]}`)
    } catch { toast.error('Erro ao atualizar status') }
  }

  if (loading) return <LoadingPage />
  if (error)   return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Ordens de Serviço</h2>
          <p className="page-subtitle">{ordens.length} OS no total</p>
        </div>
        <Link to="/os/nova" className="btn-primary">
          <Plus className="w-4 h-4" /> Nova OS
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mb-1">
        {STATUS_TABS.map(tab => {
          const cnt = tab.value === 'todos' ? ordens.length : counts[tab.value] || 0
          return (
            <button
              key={tab.value}
              onClick={() => setStatusTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                statusTab === tab.value
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                statusTab === tab.value ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
              }`}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número, título ou cliente..." />

      {/* Cards list */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title={search ? 'Nenhuma OS encontrada' : 'Nenhuma OS cadastrada'}
            description="Abra a primeira ordem de serviço"
            action={<Link to="/os/nova" className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/>Nova OS</Link>}
          />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map(os => (
              <div key={os.id} className="card hover:shadow-card-hover transition-shadow">
                <div className="flex items-start gap-4 p-4">
                  {/* Priority color strip */}
                  <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                    os.prioridade === 'urgente' ? 'bg-red-400' :
                    os.prioridade === 'alta'    ? 'bg-amber-400' :
                    os.prioridade === 'normal'  ? 'bg-blue-400' : 'bg-surface-200'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-brand-600 text-xs">#{os.numero}</span>
                        <span className={OS_STATUS_BADGE[os.status]}>{OS_STATUS_LABEL[os.status]}</span>
                        <span className={PRIORIDADE_BADGE[os.prioridade]}>{PRIORIDADE_LABEL[os.prioridade]}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Quick status change */}
                        <select
                          value={os.status}
                          onChange={e => handleStatusChange(os, e.target.value as OSStatus)}
                          onClick={e => e.stopPropagation()}
                          className="text-xs border border-surface-200 rounded-lg px-2 py-1 bg-white text-surface-600 cursor-pointer"
                        >
                          {(['aberto','em_andamento','pausado','concluido','cancelado'] as OSStatus[]).map(s => (
                            <option key={s} value={s}>{OS_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                        <Link to={`/os/${os.id}`} className="btn-primary btn-sm">
                          <Eye className="w-3.5 h-3.5" /> Abrir
                        </Link>
                      </div>
                    </div>

                    <p className="font-semibold text-surface-800 mt-1.5 truncate">{os.titulo}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-surface-400">
                      {os.cliente && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />{os.cliente.nome}
                        </span>
                      )}
                      {os.tecnico && (
                        <span className="flex items-center gap-1 text-brand-500">
                          <User className="w-3 h-3" />{os.tecnico.nome}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />{formatDate(os.data_abertura)}
                      </span>
                      {os.data_previsao && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Clock className="w-3 h-3" />Prev: {formatDate(os.data_previsao)}
                        </span>
                      )}
                      {os.valor_total > 0 && (
                        <span className="font-semibold text-surface-600">
                          {formatCurrency(os.valor_total)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
