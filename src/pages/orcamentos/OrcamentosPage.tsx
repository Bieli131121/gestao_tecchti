import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { orcamentosService } from '@/lib/orcamentos'
import { osService } from '@/lib/os'
import { formatCurrency, formatDate, searchNormalize, ORCAMENTO_STATUS_BADGE, ORCAMENTO_STATUS_LABEL } from '@/lib/utils'
import { SearchInput, EmptyState, ErrorState, LoadingPage, Pagination, ConfirmDialog } from '@/components/ui'
import { FileText, Plus, Eye, Trash2, MessageCircle, Copy, CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Orcamento, OrcamentoStatus } from '@/types'

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: OrcamentoStatus | 'todos'; label: string }[] = [
  { value: 'todos',     label: 'Todos'     },
  { value: 'rascunho',  label: 'Rascunho'  },
  { value: 'enviado',   label: 'Enviados'  },
  { value: 'aprovado',  label: 'Aprovados' },
  { value: 'recusado',  label: 'Recusados' },
  { value: 'expirado',  label: 'Expirados' },
]

export function OrcamentosPage() {
  const navigate = useNavigate()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [filtered, setFiltered]     = useState<Orcamento[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [statusFiltro, setStatusFiltro] = useState<OrcamentoStatus | 'todos'>('todos')
  const [page, setPage]             = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Orcamento | null>(null)
  const [deleting, setDeleting]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await orcamentosService.list()
      setOrcamentos(data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const q = searchNormalize(search)
    setFiltered(orcamentos.filter(o => {
      if (statusFiltro !== 'todos' && o.status !== statusFiltro) return false
      if (!q) return true
      return (
        searchNormalize(o.numero).includes(q) ||
        searchNormalize(o.cliente?.nome || '').includes(q)
      )
    }))
    setPage(1)
  }, [search, statusFiltro, orcamentos])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleGerarOS(o: Orcamento) {
    try {
      const orcamento = await orcamentosService.getById(o.id)
      const itens = (orcamento.itens || []).map((i: any) => ({
        tipo: 'servico' as const,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valor_unit: i.valor_unit,
        servico_id: i.servico_id || undefined,
      }))
      const nova = await osService.create({
        cliente_id: orcamento.cliente_id,
        titulo: orcamento.titulo || `OS - ${orcamento.numero}`,
        descricao: orcamento.descricao || undefined,
        status: 'aberto',
        prioridade: 'normal',
        valor_total: orcamento.total,
        valor_servico: orcamento.total,
        valor_materiais: 0,
        orcamento_id: orcamento.id,
      }, itens, [])
      toast.success(`OS #${nova.numero} criada com sucesso!`)
      navigate(`/os/${nova.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar OS')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await orcamentosService.delete(deleteTarget.id)
      toast.success('Orçamento removido')
      setOrcamentos(prev => prev.filter(o => o.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { toast.error('Erro ao remover') }
    finally { setDeleting(false) }
  }

  async function handleStatusChange(o: Orcamento, status: OrcamentoStatus) {
    try {
      await orcamentosService.updateStatus(o.id, status)
      setOrcamentos(prev => prev.map(x => x.id === o.id ? { ...x, status } : x))
      toast.success(`Status atualizado para "${ORCAMENTO_STATUS_LABEL[status]}"`)
    } catch { toast.error('Erro ao atualizar status') }
  }

  if (loading) return <LoadingPage />
  if (error)   return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Orçamentos</h2>
          <p className="page-subtitle">{orcamentos.length} orçamento{orcamentos.length !== 1 ? 's' : ''} no total</p>
        </div>
        <Link to="/orcamentos/novo" className="btn-primary">
          <Plus className="w-4 h-4" /> Novo Orçamento
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número ou cliente..." className="flex-1" />
        <div className="flex rounded-xl border border-surface-200 overflow-hidden bg-white flex-shrink-0 text-xs">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFiltro(opt.value as any)}
              className={`px-3 py-2 font-medium transition-colors whitespace-nowrap ${
                statusFiltro === opt.value ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-50'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={search ? 'Nenhum orçamento encontrado' : 'Nenhum orçamento cadastrado'}
            description="Crie o primeiro orçamento para um cliente"
            action={<Link to="/orcamentos/novo" className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/>Novo Orçamento</Link>}
          />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Cliente</th>
                    <th className="hidden md:table-cell">Data</th>
                    <th className="hidden lg:table-cell">Validade</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                    <th className="w-28 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(o => (
                    <tr key={o.id}>
                      <td>
                        <span className="font-mono font-semibold text-brand-600 text-xs">{o.numero}</span>
                      </td>
                      <td>
                        <span className="font-medium text-surface-800">{o.cliente?.nome || '—'}</span>
                      </td>
                      <td className="hidden md:table-cell text-surface-500 text-xs">{formatDate(o.created_at)}</td>
                      <td className="hidden lg:table-cell text-surface-500 text-xs">{formatDate(o.data_validade)}</td>
                      <td className="text-right font-semibold text-surface-800">{formatCurrency(o.total)}</td>
                      <td>
                        <select
                          value={o.status}
                          onChange={e => handleStatusChange(o, e.target.value as OrcamentoStatus)}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer ${ORCAMENTO_STATUS_BADGE[o.status]}`}
                          style={{ background: 'transparent' }}
                        >
                          {(['rascunho','enviado','aprovado','recusado','expirado'] as OrcamentoStatus[]).map(s => (
                            <option key={s} value={s}>{ORCAMENTO_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/orcamentos/${o.id}`} className="btn-icon btn-ghost btn-sm" title="Ver / Editar">
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                          <button onClick={() => handleGerarOS(o)} className="btn-icon btn-ghost btn-sm text-brand-600 hover:bg-brand-50" title="Gerar OS">
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>
                          {o.cliente?.whatsapp && (
                            <Link to={`/orcamentos/${o.id}?acao=whatsapp`} className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50" title="Enviar WhatsApp">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </Link>
                          )}
                          <button onClick={() => setDeleteTarget(o)} className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50" title="Excluir">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir orçamento"
        description={`Excluir o orçamento ${deleteTarget?.numero}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
      />
    </div>
  )
}
