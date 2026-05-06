import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { clientesService } from '@/lib/clientes'
import { formatDate, maskPhone, whatsappLink, searchNormalize } from '@/lib/utils'
import {
  SearchInput, EmptyState, ErrorState, LoadingPage,
  Pagination, ConfirmDialog
} from '@/components/ui'
import { Users, Plus, Pencil, Trash2, Phone, MessageCircle, Building2, User } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Cliente } from '@/types'

const PAGE_SIZE = 20

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtered, setFiltered] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'pf' | 'pj'>('todos')
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await clientesService.list()
      setClientes(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const q = searchNormalize(search)
    setFiltered(
      clientes.filter(c => {
        const matchTipo = tipoFiltro === 'todos' || c.tipo === tipoFiltro
        if (!matchTipo) return false
        if (!q) return true
        return (
          searchNormalize(c.nome).includes(q) ||
          searchNormalize(c.cpf_cnpj || '').includes(q) ||
          searchNormalize(c.email || '').includes(q) ||
          searchNormalize(c.telefone || '').includes(q) ||
          searchNormalize(c.cidade || '').includes(q)
        )
      })
    )
    setPage(1)
  }, [search, tipoFiltro, clientes])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await clientesService.deactivate(deleteTarget.id)
      toast.success('Cliente removido com sucesso')
      setClientes(prev => prev.filter(c => c.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Erro ao remover cliente')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Clientes</h2>
          <p className="page-subtitle">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} cadastrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/clientes/novo" className="btn-primary">
          <Plus className="w-4 h-4" />
          Novo Cliente
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, CPF/CNPJ, e-mail, cidade..."
          className="flex-1"
        />
        <div className="flex rounded-xl border border-surface-200 overflow-hidden bg-white flex-shrink-0">
          {(['todos', 'pf', 'pj'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                tipoFiltro === t
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-500 hover:bg-surface-50'
              }`}
            >
              {t === 'todos' ? 'Todos' : t === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={search ? 'Tente outros termos de busca' : 'Comece cadastrando o primeiro cliente'}
            action={
              !search ? (
                <Link to="/clientes/novo" className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Novo Cliente
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="hidden sm:table-cell">Contato</th>
                    <th className="hidden md:table-cell">Cidade</th>
                    <th className="hidden lg:table-cell">Cadastro</th>
                    <th className="w-24 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center flex-shrink-0">
                            {c.tipo === 'pj'
                              ? <Building2 className="w-4 h-4 text-brand-500" />
                              : <User className="w-4 h-4 text-brand-500" />
                            }
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/clientes/${c.id}`}
                              className="font-medium text-surface-800 hover:text-brand-600 transition-colors truncate block"
                            >
                              {c.nome}
                            </Link>
                            {c.cpf_cnpj && (
                              <p className="text-xs text-surface-400 font-mono">{c.cpf_cnpj}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="hidden sm:table-cell">
                        <div className="space-y-0.5">
                          {c.telefone && (
                            <div className="flex items-center gap-1.5 text-xs text-surface-600">
                              <Phone className="w-3 h-3 text-surface-400" />
                              {maskPhone(c.telefone)}
                            </div>
                          )}
                          {c.email && (
                            <div className="text-xs text-surface-400 truncate max-w-[180px]">
                              {c.email}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="hidden md:table-cell">
                        <span className="text-sm text-surface-600">
                          {c.cidade ? `${c.cidade}${c.estado ? ` — ${c.estado}` : ''}` : '—'}
                        </span>
                      </td>

                      <td className="hidden lg:table-cell text-sm text-surface-400">
                        {formatDate(c.created_at)}
                      </td>

                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {c.whatsapp && (
                            <a
                              href={whatsappLink(c.whatsapp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <Link
                            to={`/clientes/${c.id}`}
                            className="btn-icon btn-ghost btn-sm"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50"
                            title="Remover"
                          >
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

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover cliente"
        description={`Tem certeza que deseja remover "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  )
}
