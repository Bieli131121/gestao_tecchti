import { useEffect, useState, useCallback } from 'react'
import { servicosService } from '@/lib/servicos'
import {
  formatCurrency, formatPercent, searchNormalize
} from '@/lib/utils'
import {
  SearchInput, EmptyState, ErrorState, LoadingPage,
  Modal, FormField, ConfirmDialog, SectionDivider, Spinner
} from '@/components/ui'
import {
  Wrench, Plus, Pencil, Trash2, Tag, Clock,
  TrendingUp, AlertCircle, ChevronDown, ChevronUp, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Servico, CategoriaServico } from '@/types'

const CATEGORIA_CORES = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#6366f1','#14b8a6',
]

const DEFAULT_FORM = {
  nome: '',
  descricao: '',
  categoria_id: '',
  valor_base: 0,
  custo_estimado: 0,
  margem_lucro_pct: 40,
  taxa_urgencia_pct: 50,
  taxa_deslocamento: 0,
  tempo_medio_minutos: 60,
}

type FormData = typeof DEFAULT_FORM

function valorSugerido(custo: number, margem: number) {
  return custo + (custo * margem / 100)
}

// ===== SERVIÇO FORM MODAL =====
function ServicoModal({
  open,
  onClose,
  onSaved,
  initial,
  categorias,
}: {
  open: boolean
  onClose: () => void
  onSaved: (s: Servico) => void
  initial?: Servico | null
  categorias: CategoriaServico[]
}) {
  const [form, setForm] = useState<FormData>(DEFAULT_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        nome: initial.nome,
        descricao: initial.descricao || '',
        categoria_id: initial.categoria_id || '',
        valor_base: initial.valor_base,
        custo_estimado: initial.custo_estimado,
        margem_lucro_pct: initial.margem_lucro_pct,
        taxa_urgencia_pct: initial.taxa_urgencia_pct,
        taxa_deslocamento: initial.taxa_deslocamento,
        tempo_medio_minutos: initial.tempo_medio_minutos || 60,
      } : DEFAULT_FORM)
      setErrors({})
    }
  }, [open, initial])

  function set(field: keyof FormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (form.valor_base < 0) e.valor_base = 'Valor inválido'
    if (form.margem_lucro_pct < 0 || form.margem_lucro_pct > 999) e.margem_lucro_pct = 'Margem inválida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        valor_base: Number(form.valor_base),
        custo_estimado: Number(form.custo_estimado),
        margem_lucro_pct: Number(form.margem_lucro_pct),
        taxa_urgencia_pct: Number(form.taxa_urgencia_pct),
        taxa_deslocamento: Number(form.taxa_deslocamento),
        tempo_medio_minutos: Number(form.tempo_medio_minutos),
        categoria_id: form.categoria_id || undefined,
      }
      const saved = initial
        ? await servicosService.update(initial.id, payload)
        : await servicosService.create(payload)
      toast.success(initial ? 'Serviço atualizado!' : 'Serviço cadastrado!')
      onSaved(saved)
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar serviço')
    } finally {
      setSaving(false)
    }
  }

  const sugerido = valorSugerido(Number(form.custo_estimado), Number(form.margem_lucro_pct))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar Serviço' : 'Novo Serviço'}
      subtitle="Preencha os dados do serviço"
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />}
            {initial ? 'Salvar alterações' : 'Cadastrar serviço'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Nome + Categoria */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome do serviço" required error={errors.nome}>
            <input
              className={`input ${errors.nome ? 'input-error' : ''}`}
              value={form.nome}
              onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Instalação de câmera IP"
              autoFocus
            />
          </FormField>
          <FormField label="Categoria">
            <select className="select" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Descrição">
          <textarea
            className="input resize-none"
            rows={2}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Descrição detalhada do serviço..."
          />
        </FormField>

        <SectionDivider label="Precificação" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FormField label="Custo estimado (R$)">
            <input
              type="number" min="0" step="0.01"
              className="input"
              value={form.custo_estimado}
              onChange={e => set('custo_estimado', e.target.value)}
            />
          </FormField>
          <FormField label="Margem de lucro (%)" error={errors.margem_lucro_pct}>
            <input
              type="number" min="0" step="1"
              className={`input ${errors.margem_lucro_pct ? 'input-error' : ''}`}
              value={form.margem_lucro_pct}
              onChange={e => set('margem_lucro_pct', e.target.value)}
            />
          </FormField>
          <FormField label="Valor base (R$)" error={errors.valor_base}>
            <input
              type="number" min="0" step="0.01"
              className={`input ${errors.valor_base ? 'input-error' : ''}`}
              value={form.valor_base}
              onChange={e => set('valor_base', e.target.value)}
            />
          </FormField>
          <FormField label="Taxa urgência (%)">
            <input
              type="number" min="0" step="1"
              className="input"
              value={form.taxa_urgencia_pct}
              onChange={e => set('taxa_urgencia_pct', e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Deslocamento (R$)">
            <input
              type="number" min="0" step="0.01"
              className="input"
              value={form.taxa_deslocamento}
              onChange={e => set('taxa_deslocamento', e.target.value)}
            />
          </FormField>
          <FormField label="Tempo médio (minutos)">
            <input
              type="number" min="0" step="15"
              className="input"
              value={form.tempo_medio_minutos}
              onChange={e => set('tempo_medio_minutos', e.target.value)}
            />
          </FormField>
        </div>

        {/* Price preview */}
        {Number(form.custo_estimado) > 0 && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Previsão de preço com margem de {form.margem_lucro_pct}%
            </p>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-emerald-600 font-bold text-lg">{formatCurrency(sugerido)}</span>
                <span className="text-emerald-500 text-xs ml-1">valor sugerido</span>
              </div>
              <div className="text-emerald-600 text-xs">
                Lucro estimado: <strong>{formatCurrency(sugerido - Number(form.custo_estimado))}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ===== CATEGORIA MODAL =====
function CategoriaModal({
  open, onClose, onSaved,
}: { open: boolean; onClose: () => void; onSaved: (c: CategoriaServico) => void }) {
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CATEGORIA_CORES[0])
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setNome(''); setCor(CATEGORIA_CORES[0]) } }, [open])

  async function handleSave() {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const saved = await servicosService.createCategoria(nome.trim(), cor)
      toast.success('Categoria criada!')
      onSaved(saved)
      onClose()
    } catch { toast.error('Erro ao criar categoria') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova Categoria" size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />} Criar categoria
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Nome da categoria" required>
          <input className="input" value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: Câmeras e CFTV" autoFocus />
        </FormField>
        <FormField label="Cor">
          <div className="flex flex-wrap gap-2">
            {CATEGORIA_CORES.map(c => (
              <button key={c} onClick={() => setCor(c)}
                className={`w-7 h-7 rounded-lg border-2 transition-transform ${cor === c ? 'border-surface-700 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </FormField>
      </div>
    </Modal>
  )
}

// ===== MAIN PAGE =====
export function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [categorias, setCategorias] = useState<CategoriaServico[]>([])
  const [filtered, setFiltered] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState<string>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [editing, setEditing] = useState<Servico | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Servico | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, c] = await Promise.all([servicosService.list(), servicosService.listCategorias()])
      setServicos(s); setCategorias(c)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const q = searchNormalize(search)
    setFiltered(servicos.filter(s => {
      const matchCat = catFiltro === 'todos' || s.categoria_id === catFiltro
      if (!matchCat) return false
      if (!q) return true
      return searchNormalize(s.nome).includes(q) || searchNormalize(s.descricao || '').includes(q)
    }))
  }, [search, catFiltro, servicos])

  function handleSaved(s: Servico) {
    setServicos(prev => {
      const idx = prev.findIndex(x => x.id === s.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = s; return n }
      return [s, ...prev]
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await servicosService.deactivate(deleteTarget.id)
      toast.success('Serviço removido')
      setServicos(prev => prev.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch { toast.error('Erro ao remover') }
    finally { setDeleting(false) }
  }

  if (loading) return <LoadingPage />
  if (error) return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Serviços</h2>
          <p className="page-subtitle">{servicos.length} serviço{servicos.length !== 1 ? 's' : ''} no catálogo</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setCatModalOpen(true)}>
            <Tag className="w-4 h-4" /> Categorias
          </button>
          <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true) }}>
            <Plus className="w-4 h-4" /> Novo Serviço
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar serviço..." className="flex-1" />
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setCatFiltro('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${catFiltro === 'todos' ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'}`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCatFiltro(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${catFiltro === cat.id ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'}`}
            >
              {cat.cor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />}
              {cat.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Service cards */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Wrench}
            title={search ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
            description={search ? 'Tente outros termos' : 'Cadastre os serviços que sua empresa oferece'}
            action={!search ? (
              <button className="btn-primary btn-sm" onClick={() => setModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Novo Serviço
              </button>
            ) : undefined}
          />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const isExpanded = expandedId === s.id
            const sugerido = valorSugerido(s.custo_estimado, s.margem_lucro_pct)
            return (
              <div key={s.id} className="card overflow-hidden">
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-surface-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  {/* Color dot from category */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: s.categoria?.cor ? s.categoria.cor + '20' : '#3b82f620' }}
                  >
                    <Wrench className="w-4 h-4" style={{ color: s.categoria?.cor || '#3b82f6' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-surface-800 text-sm">{s.nome}</span>
                      {s.categoria && (
                        <span className="badge badge-blue text-[10px]" style={{
                          backgroundColor: s.categoria.cor + '20',
                          color: s.categoria.cor,
                        }}>
                          {s.categoria.nome}
                        </span>
                      )}
                    </div>
                    {s.descricao && !isExpanded && (
                      <p className="text-xs text-surface-400 truncate mt-0.5">{s.descricao}</p>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-right flex-shrink-0">
                    <div>
                      <p className="text-xs text-surface-400">Valor base</p>
                      <p className="text-sm font-semibold text-surface-700">{formatCurrency(s.valor_base)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-surface-400">Margem</p>
                      <p className="text-sm font-semibold text-emerald-600">{formatPercent(s.margem_lucro_pct)}</p>
                    </div>
                    {s.tempo_medio_minutos && (
                      <div className="hidden lg:block">
                        <p className="text-xs text-surface-400">Tempo</p>
                        <p className="text-sm text-surface-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {s.tempo_medio_minutos < 60
                            ? `${s.tempo_medio_minutos}min`
                            : `${Math.floor(s.tempo_medio_minutos / 60)}h${s.tempo_medio_minutos % 60 ? (s.tempo_medio_minutos % 60) + 'min' : ''}`
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setEditing(s); setModalOpen(true) }}
                      className="btn-icon btn-ghost btn-sm"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
                      className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4 text-surface-400 ml-1" />
                      : <ChevronDown className="w-4 h-4 text-surface-400 ml-1" />
                    }
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-surface-50 px-5 py-4 bg-surface-50/50 animate-slide-in-up">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-surface-400 mb-0.5">Custo estimado</p>
                        <p className="text-sm font-semibold text-surface-700">{formatCurrency(s.custo_estimado)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-400 mb-0.5">Valor sugerido</p>
                        <p className="text-sm font-bold text-emerald-600">{formatCurrency(sugerido)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-400 mb-0.5">Taxa urgência</p>
                        <p className="text-sm text-surface-700">{formatPercent(s.taxa_urgencia_pct)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-surface-400 mb-0.5">Deslocamento</p>
                        <p className="text-sm text-surface-700">{formatCurrency(s.taxa_deslocamento)}</p>
                      </div>
                    </div>
                    {s.descricao && (
                      <p className="text-sm text-surface-500 mt-3 leading-relaxed">{s.descricao}</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <ServicoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        onSaved={handleSaved}
        initial={editing}
        categorias={categorias}
      />
      <CategoriaModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        onSaved={c => setCategorias(prev => [...prev, c])}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover serviço"
        description={`Deseja remover "${deleteTarget?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  )
}
