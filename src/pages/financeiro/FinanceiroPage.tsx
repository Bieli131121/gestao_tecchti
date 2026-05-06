import { useRealtime } from '@/hooks/useRealtime'
import { useEffect, useState, useCallback } from 'react'
import { financeiroService } from '@/lib/financeiro'
import { clientesService } from '@/lib/clientes'
import { formatCurrency, formatDate, FORMA_PAGAMENTO_LABEL } from '@/lib/utils'
import { StatCard, LoadingPage, ErrorState, Modal, FormField, SectionDivider, Spinner, SearchInput } from '@/components/ui'
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Plus,
  CheckCircle, Trash2, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Calendar, Filter, X, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { FinanceiroLancamento, LancamentoTipo, FormaPagamento, Cliente } from '@/types'

// ── Minimal bar chart using SVG ──────────────────────────────
function FluxoChart({ data }: { data: { mes: string; receitas: number; despesas: number; lucro: number }[] }) {
  if (!data.length) return null
  const max = Math.max(...data.flatMap(d => [d.receitas, d.despesas]), 1)
  const H = 120

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm text-surface-700 mb-4">
        Fluxo de Caixa — Últimos {data.length} meses
      </h3>
      <div className="flex items-end gap-2 justify-between" style={{ height: H + 40 }}>
        {data.map((d, i) => {
          const hR = Math.max(4, (d.receitas / max) * H)
          const hD = Math.max(4, (d.despesas / max) * H)
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: H }}>
                <div
                  className="rounded-t-md bg-emerald-400 transition-all duration-500"
                  style={{ height: hR, width: '42%' }}
                  title={`Receitas: ${formatCurrency(d.receitas)}`}
                />
                <div
                  className="rounded-t-md bg-red-400 transition-all duration-500"
                  style={{ height: hD, width: '42%' }}
                  title={`Despesas: ${formatCurrency(d.despesas)}`}
                />
              </div>
              <span className="text-[10px] text-surface-400 truncate w-full text-center">{d.mes}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1.5 text-xs text-surface-500">
          <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> Receitas
        </span>
        <span className="flex items-center gap-1.5 text-xs text-surface-500">
          <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Despesas
        </span>
      </div>
    </div>
  )
}

// ── Lançamento Form Modal ────────────────────────────────────
const DEFAULT_FORM = {
  tipo: 'receita' as LancamentoTipo,
  descricao: '',
  valor: '',
  data_vencimento: new Date().toISOString().slice(0, 10),
  categoria: '',
  forma_pagamento: '' as FormaPagamento | '',
  cliente_id: '',
  fornecedor: '',
  pago: false,
  data_pagamento: '',
  parcela_atual: 1,
  total_parcelas: 1,
  observacoes: '',
}

type FormType = typeof DEFAULT_FORM

function LancamentoModal({
  open, onClose, onSaved, initial, clientes,
}: {
  open: boolean
  onClose: () => void
  onSaved: (l: FinanceiroLancamento) => void
  initial?: FinanceiroLancamento | null
  clientes: Cliente[]
}) {
  const [form, setForm] = useState<FormType>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof FormType, string>>>({})

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        tipo: initial.tipo,
        descricao: initial.descricao,
        valor: String(initial.valor),
        data_vencimento: initial.data_vencimento,
        categoria: initial.categoria || '',
        forma_pagamento: (initial.forma_pagamento || '') as FormaPagamento | '',
        cliente_id: initial.cliente_id || '',
        fornecedor: initial.fornecedor || '',
        pago: initial.pago,
        data_pagamento: initial.data_pagamento || '',
        parcela_atual: initial.parcela_atual,
        total_parcelas: initial.total_parcelas,
        observacoes: initial.observacoes || '',
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setErrors({})
  }, [open, initial])

  const set = (field: keyof FormType, value: any) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: undefined }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.descricao.trim()) e.descricao = 'Descrição obrigatória'
    if (!form.valor || isNaN(Number(form.valor)) || Number(form.valor) <= 0) e.valor = 'Valor inválido'
    if (!form.data_vencimento) e.data_vencimento = 'Data obrigatória'
    setErrors(e)
    return !Object.keys(e).length
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        tipo: form.tipo,
        descricao: form.descricao.trim(),
        valor: Number(form.valor),
        data_vencimento: form.data_vencimento,
        categoria: form.categoria || undefined,
        forma_pagamento: (form.forma_pagamento || undefined) as FormaPagamento | undefined,
        cliente_id: form.cliente_id || undefined,
        fornecedor: form.fornecedor || undefined,
        pago: form.pago,
        data_pagamento: form.pago ? (form.data_pagamento || form.data_vencimento) : undefined,
        parcela_atual: form.parcela_atual,
        total_parcelas: form.total_parcelas,
        observacoes: form.observacoes || undefined,
      }
      const saved = initial
        ? await financeiroService.update(initial.id, payload)
        : await financeiroService.create(payload)
      toast.success(initial ? 'Lançamento atualizado!' : 'Lançamento criado!')
      onSaved(saved)
      onClose()
    } catch (e: any) { toast.error(e.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const cats = form.tipo === 'receita'
    ? financeiroService.CATEGORIAS_RECEITA
    : financeiroService.CATEGORIAS_DESPESA

  return (
    <Modal
      open={open} onClose={onClose} size="lg"
      title={initial ? 'Editar Lançamento' : 'Novo Lançamento'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />} {initial ? 'Salvar' : 'Lançar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tipo */}
        <div className="grid grid-cols-2 gap-2">
          {(['receita', 'despesa'] as LancamentoTipo[]).map(t => (
            <button
              key={t}
              onClick={() => set('tipo', t)}
              className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all text-sm font-semibold ${
                form.tipo === t
                  ? t === 'receita'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-red-400 bg-red-50 text-red-700'
                  : 'border-surface-200 text-surface-500 hover:border-surface-300'
              }`}
            >
              {t === 'receita'
                ? <ArrowUpRight className="w-4 h-4" />
                : <ArrowDownRight className="w-4 h-4" />}
              {t === 'receita' ? 'Receita' : 'Despesa'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Descrição" required error={errors.descricao} className="col-span-2">
            <input
              className={`input ${errors.descricao ? 'input-error' : ''}`}
              value={form.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder={form.tipo === 'receita' ? 'Ex: OS #00012 — João Silva' : 'Ex: Compra de cabos HDMI'}
              autoFocus
            />
          </FormField>

          <FormField label="Valor (R$)" required error={errors.valor}>
            <input
              type="number" min="0.01" step="0.01"
              className={`input ${errors.valor ? 'input-error' : ''}`}
              value={form.valor}
              onChange={e => set('valor', e.target.value)}
              placeholder="0,00"
            />
          </FormField>

          <FormField label="Vencimento" required error={errors.data_vencimento}>
            <input
              type="date" className="input"
              value={form.data_vencimento}
              onChange={e => set('data_vencimento', e.target.value)}
            />
          </FormField>

          <FormField label="Categoria">
            <select className="select" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              <option value="">Sem categoria</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FormField>

          <FormField label="Forma de pagamento">
            <select className="select" value={form.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)}>
              <option value="">A definir</option>
              {Object.entries(FORMA_PAGAMENTO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </FormField>

          {form.tipo === 'receita' ? (
            <FormField label="Cliente">
              <select className="select" value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                <option value="">Sem vínculo</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </FormField>
          ) : (
            <FormField label="Fornecedor">
              <input className="input" value={form.fornecedor}
                onChange={e => set('fornecedor', e.target.value)}
                placeholder="Nome do fornecedor" />
            </FormField>
          )}

          <FormField label="Parcela">
            <div className="flex items-center gap-2">
              <input type="number" min="1" className="input w-20 text-center"
                value={form.parcela_atual} onChange={e => set('parcela_atual', Number(e.target.value))} />
              <span className="text-surface-400 text-sm">de</span>
              <input type="number" min="1" className="input w-20 text-center"
                value={form.total_parcelas} onChange={e => set('total_parcelas', Number(e.target.value))} />
            </div>
          </FormField>
        </div>

        <SectionDivider label="Pagamento" />

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.pago}
              onChange={e => set('pago', e.target.checked)}
              className="w-4 h-4 rounded text-brand-600" />
            <span className="text-sm font-medium text-surface-700">Já foi pago / recebido</span>
          </label>
          {form.pago && (
            <FormField label="Data do pagamento" className="flex-1">
              <input type="date" className="input"
                value={form.data_pagamento}
                onChange={e => set('data_pagamento', e.target.value)} />
            </FormField>
          )}
        </div>

        <FormField label="Observações">
          <textarea className="input resize-none" rows={2}
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}

// ── Pagar Modal ──────────────────────────────────────────────
function PagarModal({
  open, onClose, lancamento, onPago,
}: {
  open: boolean; onClose: () => void
  lancamento: FinanceiroLancamento | null; onPago: (l: FinanceiroLancamento) => void
}) {
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [data, setData]   = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (open) { setForma('pix'); setData(new Date().toISOString().slice(0, 10)) } }, [open])

  async function handleConfirm() {
    if (!lancamento) return
    setSaving(true)
    try {
      const updated = await financeiroService.marcarPago(lancamento.id, forma, data)
      toast.success(`${lancamento.tipo === 'receita' ? 'Recebimento' : 'Pagamento'} registrado!`)
      onPago(updated)
      onClose()
    } catch { toast.error('Erro ao registrar pagamento') }
    finally { setSaving(false) }
  }

  if (!lancamento) return null
  const isReceita = lancamento.tipo === 'receita'

  return (
    <Modal open={open} onClose={onClose} size="sm"
      title={isReceita ? 'Registrar Recebimento' : 'Registrar Pagamento'}
      subtitle={lancamento.descricao}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving && <Spinner />}
            <CheckCircle className="w-4 h-4" />
            {isReceita ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-surface-50 border">
          <p className="text-xs text-surface-400">Valor</p>
          <p className={`text-xl font-bold ${isReceita ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(lancamento.valor)}
          </p>
        </div>
        <FormField label="Forma de pagamento">
          <select className="select" value={forma} onChange={e => setForma(e.target.value as FormaPagamento)}>
            {Object.entries(FORMA_PAGAMENTO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Data">
          <input type="date" className="input" value={data} onChange={e => setData(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export function FinanceiroPage() {
  const [lancamentos, setLancamentos]   = useState<FinanceiroLancamento[]>([])
  const [fluxo, setFluxo]               = useState<any[]>([])
  const [summary, setSummary]           = useState<any>(null)
  const [clientes, setClientes]         = useState<Cliente[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  // Filters
  const [mesFiltro, setMesFiltro]       = useState<Date>(new Date())
  const [tipoFiltro, setTipoFiltro]     = useState<LancamentoTipo | 'todos'>('todos')
  const [pagoFiltro, setPagoFiltro]     = useState<'todos' | 'pago' | 'pendente'>('todos')
  const [search, setSearch]             = useState('')

  // Modals
  const [modalOpen, setModalOpen]       = useState(false)
  const [editTarget, setEditTarget]     = useState<FinanceiroLancamento | null>(null)
  const [pagarTarget, setPagarTarget]   = useState<FinanceiroLancamento | null>(null)
  const [deleting, setDeleting]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const filtros: Parameters<typeof financeiroService.list>[0] = { mes: mesFiltro }
      if (tipoFiltro !== 'todos') filtros.tipo = tipoFiltro as LancamentoTipo
      if (pagoFiltro === 'pago')     filtros.pago = true
      if (pagoFiltro === 'pendente') filtros.pago = false

      const [lancs, summ, flx, clts] = await Promise.all([
        financeiroService.list(filtros),
        financeiroService.getDashboardSummary(mesFiltro),
        financeiroService.getFluxo(6),
        clientesService.list(),
      ])
      setLancamentos(lancs)
      setSummary(summ)
      setFluxo(flx)
      setClientes(clts)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [mesFiltro, tipoFiltro, pagoFiltro])

  useEffect(() => { load() }, [load])
  useRealtime(['financeiro_lancamentos'], load)

  function upsert(l: FinanceiroLancamento) {
    setLancamentos(prev => {
      const idx = prev.findIndex(x => x.id === l.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = l; return n }
      return [l, ...prev]
    })
    // Refresh summary
    financeiroService.getDashboardSummary(mesFiltro).then(setSummary)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este lançamento? Esta ação não pode ser desfeita.')) return
    setDeleting(id)
    try {
      await financeiroService.delete(id)
      setLancamentos(prev => prev.filter(l => l.id !== id))
      toast.success('Lançamento excluído')
    } catch { toast.error('Erro ao excluir') }
    finally { setDeleting(null) }
  }

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  const filtered = lancamentos.filter(l => {
    if (!search.trim()) return true
    const q = norm(search)
    return norm(l.descricao).includes(q) ||
      norm(l.categoria || '').includes(q) ||
      norm(l.cliente?.nome || '').includes(q)
  })

  // Nav month
  function prevMes() { setMesFiltro(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n }) }
  function nextMes() {
    const now = new Date()
    setMesFiltro(d => {
      const n = new Date(d); n.setMonth(n.getMonth() + 1)
      return n > now ? now : n
    })
  }

  if (loading) return <LoadingPage />
  if (error)   return <ErrorState message={error} onRetry={load} />

  const mesLabel = mesFiltro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Financeiro</h2>
          <p className="page-subtitle capitalize">{mesLabel}</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true) }}>
          <Plus className="w-4 h-4" /> Novo Lançamento
        </button>
      </div>

      {/* KPI row */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Receitas do mês"  value={formatCurrency(summary.totalReceitas)}  icon={ArrowUpRight}   accent="green"  />
          <StatCard label="Despesas do mês"  value={formatCurrency(summary.totalDespesas)}  icon={ArrowDownRight} accent="red"    />
          <StatCard label="Lucro líquido"    value={formatCurrency(summary.lucroMes)}        icon={TrendingUp}     accent={summary.lucroMes >= 0 ? 'green' : 'red'} />
          <StatCard label="A receber no mês" value={formatCurrency(summary.totalAReceber)}   icon={Clock}          accent="yellow" />
        </div>
      )}

      {/* Vencidas alert */}
      {summary?.vencidas?.length > 0 && (
        <div className="card border-red-100 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-700">
              {summary.vencidas.length} lançamento{summary.vencidas.length > 1 ? 's' : ''} vencido{summary.vencidas.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summary.vencidas.slice(0, 4).map((v: any) => (
              <span key={v.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">
                {v.descricao} · {formatCurrency(v.valor)} · venceu {formatDate(v.data_vencimento)}
              </span>
            ))}
            {summary.vencidas.length > 4 && (
              <span className="text-xs text-red-500">+{summary.vencidas.length - 4} mais</span>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <FluxoChart data={fluxo} />

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Month nav */}
        <div className="flex items-center gap-1 bg-white border border-surface-200 rounded-xl overflow-hidden flex-shrink-0">
          <button onClick={prevMes} className="px-3 py-2 text-surface-400 hover:bg-surface-50 transition-colors text-sm">‹</button>
          <span className="px-3 py-2 text-xs font-semibold text-surface-700 capitalize whitespace-nowrap border-x border-surface-100">
            {mesLabel}
          </span>
          <button onClick={nextMes} className="px-3 py-2 text-surface-400 hover:bg-surface-50 transition-colors text-sm">›</button>
        </div>

        {/* Tipo */}
        <div className="flex rounded-xl border border-surface-200 overflow-hidden bg-white text-xs flex-shrink-0">
          {([['todos','Todos'],['receita','Receitas'],['despesa','Despesas']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTipoFiltro(v as any)}
              className={`px-3 py-2 font-medium transition-colors ${tipoFiltro === v ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-50'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Pago */}
        <div className="flex rounded-xl border border-surface-200 overflow-hidden bg-white text-xs flex-shrink-0">
          {([['todos','Todos'],['pendente','Pendentes'],['pago','Pagos']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPagoFiltro(v as any)}
              className={`px-3 py-2 font-medium transition-colors ${pagoFiltro === v ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-50'}`}>
              {l}
            </button>
          ))}
        </div>

        <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." className="flex-1 min-w-32" />
      </div>

      {/* Lancamentos table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <DollarSign className="w-8 h-8 text-surface-200 mx-auto mb-2" />
            <p className="text-sm text-surface-400">Nenhum lançamento no período</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th className="hidden md:table-cell">Categoria</th>
                  <th className="hidden lg:table-cell">Cliente / Fornecedor</th>
                  <th>Vencimento</th>
                  <th className="text-right">Valor</th>
                  <th>Status</th>
                  <th className="w-24 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const isReceita  = l.tipo === 'receita'
                  const isVencida  = !l.pago && l.data_vencimento < hoje
                  const isHoje     = l.data_vencimento === hoje && !l.pago

                  return (
                    <tr key={l.id} className={isVencida ? 'bg-red-50/40' : ''}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isReceita ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <div>
                            <p className="font-medium text-surface-800 text-sm">{l.descricao}</p>
                            {l.total_parcelas > 1 && (
                              <p className="text-xs text-surface-400">{l.parcela_atual}/{l.total_parcelas}x</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell text-xs text-surface-500">{l.categoria || '—'}</td>
                      <td className="hidden lg:table-cell text-xs text-surface-500">
                        {l.cliente?.nome || l.fornecedor || '—'}
                      </td>
                      <td>
                        <span className={`text-xs font-medium ${isVencida ? 'text-red-600' : isHoje ? 'text-amber-600' : 'text-surface-600'}`}>
                          {formatDate(l.data_vencimento)}
                          {isVencida && ' ⚠'}
                          {isHoje && ' (hoje)'}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={`font-semibold ${isReceita ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isReceita ? '+' : '-'}{formatCurrency(l.valor)}
                        </span>
                      </td>
                      <td>
                        {l.pago ? (
                          <span className="badge badge-green">
                            <CheckCircle className="w-3 h-3" />
                            {l.data_pagamento ? formatDate(l.data_pagamento) : 'Pago'}
                          </span>
                        ) : (
                          <span className={`badge ${isVencida ? 'badge-red' : 'badge-yellow'}`}>
                            <Clock className="w-3 h-3" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          {!l.pago && (
                            <button
                              onClick={() => setPagarTarget(l)}
                              className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50"
                              title={isReceita ? 'Registrar recebimento' : 'Registrar pagamento'}
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { setEditTarget(l); setModalOpen(true) }}
                            className="btn-icon btn-ghost btn-sm"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(l.id)}
                            disabled={deleting === l.id}
                            className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50"
                            title="Excluir"
                          >
                            {deleting === l.id ? <Spinner /> : <Trash2 className="w-3.5 h-3.5" />}
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

        {/* Footer totals */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-surface-50 bg-surface-50/50 flex flex-wrap gap-6 text-sm">
            <span className="text-surface-500">
              {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''}
            </span>
            <span className="text-emerald-600 font-semibold">
              Receitas: {formatCurrency(filtered.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0))}
            </span>
            <span className="text-red-600 font-semibold">
              Despesas: {formatCurrency(filtered.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0))}
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      <LancamentoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={upsert}
        initial={editTarget}
        clientes={clientes}
      />
      <PagarModal
        open={!!pagarTarget}
        onClose={() => setPagarTarget(null)}
        lancamento={pagarTarget}
        onPago={upsert}
      />
    </div>
  )
}
