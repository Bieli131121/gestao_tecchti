import { useRealtime } from '@/hooks/useRealtime'
import { useEffect, useState, useCallback } from 'react'
import { estoqueService } from '@/lib/estoque'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency, searchNormalize } from '@/lib/utils'
import {
  SearchInput, EmptyState, ErrorState, LoadingPage,
  StatCard, Modal, FormField, SectionDivider, Spinner, ConfirmDialog
} from '@/components/ui'
import {
  Package, Plus, Pencil, Trash2, ArrowDownToLine,
  ArrowUpFromLine, AlertTriangle, History, X, BarChart3, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Produto, EstoqueMovimento, ProdutoCategoria, MovimentoTipo } from '@/types'

// ─── Produto Form Modal ──────────────────────────────────────
const PROD_DEFAULT = {
  nome: '', descricao: '', categoria: '' as ProdutoCategoria | '',
  codigo: '', unidade: 'un',
  preco_custo: 0, preco_venda: 0,
  estoque_atual: 0, estoque_minimo: 0, localizacao: '',
}

function ProdutoModal({
  open, onClose, onSaved, initial,
}: {
  open: boolean; onClose: () => void
  onSaved: (p: Produto) => void; initial?: Produto | null
}) {
  const [form, setForm] = useState(PROD_DEFAULT)
  const [errors, setErrors] = useState<Partial<Record<keyof typeof PROD_DEFAULT, string>>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial ? {
      nome: initial.nome, descricao: initial.descricao || '',
      categoria: initial.categoria || '', codigo: initial.codigo || '',
      unidade: initial.unidade,
      preco_custo: initial.preco_custo, preco_venda: initial.preco_venda,
      estoque_atual: initial.estoque_atual, estoque_minimo: initial.estoque_minimo,
      localizacao: initial.localizacao || '',
    } : PROD_DEFAULT)
    setErrors({})
  }, [open, initial])

  const set = (f: keyof typeof PROD_DEFAULT, v: any) => {
    setForm(p => ({ ...p, [f]: v }))
    setErrors(p => ({ ...p, [f]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (form.preco_custo < 0) e.preco_custo = 'Valor inválido'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        categoria: form.categoria || null,
        codigo: form.codigo || null,
        preco_custo: Number(form.preco_custo),
        preco_venda: Number(form.preco_venda),
        estoque_atual: Number(form.estoque_atual),
        estoque_minimo: Number(form.estoque_minimo),
      } as Partial<Produto>
      const saved = initial
        ? await estoqueService.updateProduto(initial.id, payload)
        : await estoqueService.createProduto(payload)
      toast.success(initial ? 'Produto atualizado!' : 'Produto cadastrado!')
      onSaved(saved)
      onClose()
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const margem = form.preco_custo > 0
    ? ((Number(form.preco_venda) - Number(form.preco_custo)) / Number(form.preco_custo)) * 100
    : 0

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={initial ? 'Editar Produto' : 'Novo Produto'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />} {initial ? 'Salvar' : 'Cadastrar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome do produto" required error={errors.nome} className="col-span-2">
            <input className={`input ${errors.nome ? 'input-error' : ''}`}
              value={form.nome} onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Câmera IP Intelbras VIP 1220 B" autoFocus />
          </FormField>

          <FormField label="Categoria">
            <select className="select" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Sem categoria</option>
              {estoqueService.CATEGORIAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Código / SKU">
            <input className="input" value={form.codigo}
              onChange={e => set('codigo', e.target.value)} placeholder="Ex: CAM-IP-1220" />
          </FormField>
        </div>

        <FormField label="Descrição">
          <textarea className="input resize-none" rows={2}
            value={form.descricao} onChange={e => set('descricao', e.target.value)}
            placeholder="Especificações, modelo, observações..." />
        </FormField>

        <SectionDivider label="Preços" />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FormField label="Custo (R$)" error={errors.preco_custo}>
            <input type="number" min="0" step="0.01" className="input"
              value={form.preco_custo} onChange={e => set('preco_custo', e.target.value)} />
          </FormField>
          <FormField label="Venda (R$)">
            <input type="number" min="0" step="0.01" className="input"
              value={form.preco_venda} onChange={e => set('preco_venda', e.target.value)} />
          </FormField>
          <div className="flex flex-col justify-end pb-1">
            {form.preco_custo > 0 && (
              <div className={`text-xs font-semibold px-3 py-2 rounded-xl ${margem >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                Margem: {margem.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        <SectionDivider label="Estoque" />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FormField label="Qtd atual">
            <input type="number" min="0" step="0.001" className="input"
              value={form.estoque_atual} onChange={e => set('estoque_atual', e.target.value)} />
          </FormField>
          <FormField label="Estoque mínimo">
            <input type="number" min="0" step="0.001" className="input"
              value={form.estoque_minimo} onChange={e => set('estoque_minimo', e.target.value)} />
          </FormField>
          <FormField label="Unidade">
            <select className="select" value={form.unidade} onChange={e => set('unidade', e.target.value)}>
              {['un','pç','m','mt','kg','cx','par','rolo'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </FormField>
          <FormField label="Localização">
            <input className="input" value={form.localizacao}
              onChange={e => set('localizacao', e.target.value)} placeholder="Ex: Prateleira A3" />
          </FormField>
        </div>
      </div>
    </Modal>
  )
}

// ─── Movimentação Modal ──────────────────────────────────────
function MovimentacaoModal({
  open, onClose, produto, onRegistrado, userId,
}: {
  open: boolean; onClose: () => void
  produto?: Produto | null; onRegistrado: (p: Produto) => void; userId?: string
}) {
  const [tipo, setTipo]         = useState<MovimentoTipo>('entrada')
  const [quantidade, setQtd]    = useState('')
  const [valorUnit, setValor]   = useState('')
  const [observacao, setObs]    = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    if (open) { setTipo('entrada'); setQtd(''); setValor(''); setObs('') }
  }, [open])

  async function handleSave() {
    if (!produto) return
    const qtd = Number(quantidade)
    if (!qtd || qtd <= 0) { toast.error('Informe a quantidade'); return }
    if (tipo === 'saida' && qtd > produto.estoque_atual) {
      toast.error(`Estoque insuficiente (disponível: ${produto.estoque_atual} ${produto.unidade})`)
      return
    }
    setSaving(true)
    try {
      await estoqueService.registrarMovimento({
        produto_id: produto.id,
        tipo, quantidade: qtd,
        valor_unit: valorUnit ? Number(valorUnit) : undefined,
        observacao: observacao || undefined,
        user_id: userId,
      })
      // Refresh product
      const updated = await estoqueService.getProdutoById(produto.id)
      toast.success(`Movimentação registrada! Novo estoque: ${updated.estoque_atual} ${updated.unidade}`)
      onRegistrado(updated)
      onClose()
    } catch (e: any) { toast.error(e.message || 'Erro ao registrar') }
    finally { setSaving(false) }
  }

  if (!produto) return null

  return (
    <Modal open={open} onClose={onClose} size="sm"
      title="Registrar Movimentação"
      subtitle={produto.nome}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />} Registrar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-surface-50 border flex justify-between items-center">
          <span className="text-sm text-surface-500">Estoque atual</span>
          <span className={`font-bold text-lg ${produto.estoque_atual <= produto.estoque_minimo ? 'text-red-600' : 'text-surface-800'}`}>
            {produto.estoque_atual} {produto.unidade}
          </span>
        </div>

        <FormField label="Tipo de movimentação">
          <div className="grid grid-cols-3 gap-2">
            {estoqueService.TIPO_MOVIMENTO.map(t => (
              <button key={t.value} onClick={() => setTipo(t.value)}
                className={`p-2 rounded-xl border-2 text-xs font-semibold transition-all text-center ${
                  tipo === t.value
                    ? t.value === 'entrada'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : t.value === 'saida'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-surface-200 text-surface-500'
                }`}>
                {t.value === 'entrada' ? '↓ Entrada' : t.value === 'saida' ? '↑ Saída' : '⟳ Ajuste'}
              </button>
            ))}
          </div>
        </FormField>

        <FormField label={`Quantidade (${produto.unidade})`}>
          <input type="number" min="0.001" step="0.001" className="input"
            value={quantidade} onChange={e => setQtd(e.target.value)} autoFocus placeholder="0" />
        </FormField>

        {tipo === 'entrada' && (
          <FormField label="Valor unitário (R$)">
            <input type="number" min="0" step="0.01" className="input"
              value={valorUnit} onChange={e => setValor(e.target.value)} placeholder="0,00" />
          </FormField>
        )}

        <FormField label="Observação">
          <input className="input" value={observacao}
            onChange={e => setObs(e.target.value)}
            placeholder="Ex: Nota fiscal 1234 / devolvido pelo cliente..." />
        </FormField>
      </div>
    </Modal>
  )
}

// ─── Histórico Modal ─────────────────────────────────────────
function HistoricoModal({ open, onClose, produto }: {
  open: boolean; onClose: () => void; produto?: Produto | null
}) {
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([])
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!open || !produto) return
    setLoading(true)
    estoqueService.listMovimentos(produto.id, 30)
      .then(setMovimentos).finally(() => setLoading(false))
  }, [open, produto])

  if (!produto) return null

  return (
    <Modal open={open} onClose={onClose} title={`Histórico — ${produto.nome}`} size="md">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner size="md" /></div>
      ) : movimentos.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-8">Nenhuma movimentação registrada</p>
      ) : (
        <div className="divide-y divide-surface-50 max-h-80 overflow-y-auto">
          {movimentos.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                m.tipo === 'entrada' ? 'bg-emerald-100' : m.tipo === 'saida' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {m.tipo === 'entrada'
                  ? <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-600" />
                  : m.tipo === 'saida'
                  ? <ArrowUpFromLine className="w-3.5 h-3.5 text-red-600" />
                  : <span className="text-amber-600 text-xs font-bold">⟳</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-700 capitalize">
                  {m.tipo} — {Math.abs(m.quantidade)} {produto.unidade}
                </p>
                {m.observacao && <p className="text-xs text-surface-400 truncate">{m.observacao}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-surface-400">
                  {new Date(m.created_at).toLocaleDateString('pt-BR')}
                </p>
                {m.valor_unit && (
                  <p className="text-xs text-surface-500">{formatCurrency(m.valor_unit)}/un</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export function EstoquePage() {
  const { user } = useAuthStore()
  const [produtos, setProdutos]         = useState<Produto[]>([])
  const [filtered, setFiltered]         = useState<Produto[]>([])
  const [summary, setSummary]           = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [catFiltro, setCatFiltro]       = useState<ProdutoCategoria | 'todos'>('todos')
  const [apenasAlerta, setApenasAlerta] = useState(false)

  const [prodModal, setProdModal]               = useState(false)
  const [editTarget, setEditTarget]             = useState<Produto | null>(null)
  const [movTarget, setMovTarget]               = useState<Produto | null>(null)
  const [histTarget, setHistTarget]             = useState<Produto | null>(null)
  const [deleteTarget, setDeleteTarget]         = useState<Produto | null>(null)
  const [deleting, setDeleting]                 = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [prods, summ] = await Promise.all([
        estoqueService.listProdutos(), estoqueService.getSummary()
      ])
      setProdutos(prods); setSummary(summ)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useRealtime(['produtos', 'estoque_movimentos'], load)

  useEffect(() => {
    const q = searchNormalize(search)
    setFiltered(produtos.filter(p => {
      if (catFiltro !== 'todos' && p.categoria !== catFiltro) return false
      if (apenasAlerta && p.estoque_atual > p.estoque_minimo) return false
      if (!q) return true
      return searchNormalize(p.nome).includes(q) || searchNormalize(p.codigo || '').includes(q)
    }))
  }, [search, catFiltro, apenasAlerta, produtos])

  function upsert(p: Produto) {
    setProdutos(prev => {
      const idx = prev.findIndex(x => x.id === p.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = p; return n }
      return [p, ...prev]
    })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await estoqueService.deactivateProduto(deleteTarget.id)
      setProdutos(prev => prev.filter(p => p.id !== deleteTarget.id))
      toast.success('Produto removido')
      setDeleteTarget(null)
    } catch { toast.error('Erro ao remover') }
    finally { setDeleting(false) }
  }

  if (loading) return <LoadingPage />
  if (error)   return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Estoque</h2>
          <p className="page-subtitle">{produtos.length} produto{produtos.length !== 1 ? 's' : ''} cadastrado{produtos.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setProdModal(true) }}>
          <Plus className="w-4 h-4" /> Novo Produto
        </button>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total de itens"    value={summary.totalItens}               icon={Package}        accent="blue"   />
          <StatCard label="Estoque baixo"     value={summary.totalBaixo}               icon={AlertTriangle}  accent="red"    />
          <StatCard label="Valor em estoque"  value={formatCurrency(summary.valorEstoque)} icon={BarChart3}  accent="yellow" />
          <StatCard label="Valor de venda"    value={formatCurrency(summary.valorVenda)}   icon={TrendingUp} accent="green"  />
        </div>
      )}

      {/* Alert strip */}
      {summary?.totalBaixo > 0 && (
        <button
          onClick={() => setApenasAlerta(v => !v)}
          className={`w-full flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-colors ${
            apenasAlerta
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {summary.totalBaixo} produto{summary.totalBaixo > 1 ? 's' : ''} com estoque abaixo do mínimo
          <span className="ml-auto text-xs">{apenasAlerta ? 'Mostrar todos' : 'Ver apenas estes'}</span>
        </button>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto ou código..." className="flex-1" />
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          <button
            onClick={() => setCatFiltro('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              catFiltro === 'todos' ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'
            }`}
          >Todos</button>
          {estoqueService.CATEGORIAS.map(c => (
            <button
              key={c.value}
              onClick={() => setCatFiltro(c.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                catFiltro === c.value ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'
              }`}
            >{c.label}</button>
          ))}
        </div>
      </div>

      {/* Product table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search ? 'Nenhum produto encontrado' : 'Nenhum produto no estoque'}
            description="Cadastre câmeras, cabos, conectores e demais materiais"
            action={<button className="btn-primary btn-sm" onClick={() => setProdModal(true)}>
              <Plus className="w-3.5 h-3.5" /> Novo Produto
            </button>}
          />
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th className="hidden md:table-cell">Código</th>
                  <th className="hidden lg:table-cell text-right">Custo</th>
                  <th className="hidden lg:table-cell text-right">Venda</th>
                  <th className="text-right">Estoque</th>
                  <th className="text-right">Mínimo</th>
                  <th className="w-32 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const baixo = p.estoque_atual <= p.estoque_minimo
                  return (
                    <tr key={p.id} className={baixo ? 'bg-red-50/30' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          {baixo && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                          <div>
                            <p className="font-medium text-surface-800 text-sm">{p.nome}</p>
                            {p.categoria && (
                              <p className="text-xs text-surface-400 capitalize">
                                {estoqueService.CATEGORIAS.find(c => c.value === p.categoria)?.label || p.categoria}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-xs font-mono text-surface-500">{p.codigo || '—'}</td>
                      <td className="hidden lg:table-cell text-right text-sm text-surface-600">{formatCurrency(p.preco_custo)}</td>
                      <td className="hidden lg:table-cell text-right text-sm font-semibold text-surface-700">{formatCurrency(p.preco_venda)}</td>
                      <td className="text-right">
                        <span className={`font-bold text-sm ${baixo ? 'text-red-600' : 'text-surface-800'}`}>
                          {p.estoque_atual}
                        </span>
                        <span className="text-xs text-surface-400 ml-1">{p.unidade}</span>
                      </td>
                      <td className="text-right text-xs text-surface-400">{p.estoque_minimo} {p.unidade}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setMovTarget(p) }}
                            className="btn-icon btn-ghost btn-sm text-brand-500 hover:bg-brand-50" title="Movimentar">
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setHistTarget(p)}
                            className="btn-icon btn-ghost btn-sm" title="Histórico">
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setEditTarget(p); setProdModal(true) }}
                            className="btn-icon btn-ghost btn-sm" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)}
                            className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50" title="Remover">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProdutoModal
        open={prodModal}
        onClose={() => { setProdModal(false); setEditTarget(null) }}
        onSaved={p => { upsert(p); estoqueService.getSummary().then(setSummary) }}
        initial={editTarget}
      />
      <MovimentacaoModal
        open={!!movTarget}
        onClose={() => setMovTarget(null)}
        produto={movTarget}
        onRegistrado={p => { upsert(p); estoqueService.getSummary().then(setSummary) }}
        userId={user?.id}
      />
      <HistoricoModal
        open={!!histTarget}
        onClose={() => setHistTarget(null)}
        produto={histTarget}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover produto"
        description={`Remover "${deleteTarget?.nome}" do estoque?`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  )
}
