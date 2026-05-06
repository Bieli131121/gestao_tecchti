import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { orcamentosService, calcularOrcamento, buildWhatsAppMessage, type UrgenciaTipo } from '@/lib/orcamentos'
import { buildOrcamentoPDFHtml, printOrcamento } from '@/lib/pdfOrcamento'
import { clientesService } from '@/lib/clientes'
import { servicosService } from '@/lib/servicos'
import { formatCurrency, whatsappLink, maskPhone } from '@/lib/utils'
import { FormField, SectionDivider, Spinner, Modal } from '@/components/ui'
import {
  ArrowLeft, Plus, Trash2, Calculator, FileText,
  MessageCircle, Save, Search, CheckCircle, Zap, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Cliente, Servico, OrcamentoItem } from '@/types'

interface ItemForm {
  id?: string
  descricao: string
  quantidade: number
  valor_unit: number
  servico_id?: string
  tipo: 'servico' | 'material'
}

const URGENCIA_OPTS: { value: UrgenciaTipo; label: string; desc: string; pct: string }[] = [
  { value: 'normal',     label: 'Normal',     desc: 'Prazo padrão', pct: '+0%'   },
  { value: 'urgente',    label: 'Urgente',    desc: '4–24 horas',   pct: '+50%'  },
  { value: 'emergencia', label: 'Emergência', desc: 'Até 4 horas',  pct: '+100%' },
]

// ---- Client search modal ----
function ClienteSearchModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (c: Cliente) => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch(''); setResults([])
    loadAll()
  }, [open])

  async function loadAll() {
    setLoading(true)
    try { setResults(await clientesService.list()) }
    finally { setLoading(false) }
  }

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filtered = search.trim()
    ? results.filter(c => norm(c.nome).includes(norm(search)) || (c.cpf_cnpj || '').includes(search))
    : results

  return (
    <Modal open={open} onClose={onClose} title="Selecionar Cliente" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-surface-50 rounded-xl border border-surface-100">
          {loading && <div className="p-4 text-center text-surface-400 text-sm">Carregando...</div>}
          {!loading && filtered.length === 0 && <div className="p-4 text-center text-surface-400 text-sm">Nenhum cliente encontrado</div>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors text-left">
              <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-brand-600 font-bold text-xs">
                {c.nome[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-surface-800 text-sm">{c.nome}</p>
                <p className="text-xs text-surface-400">{c.cpf_cnpj || c.cidade || c.email || ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ---- Service picker modal ----
function ServicoPickerModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (s: Servico) => void
}) {
  const [servicos, setServicos] = useState<Servico[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setLoading(true)
    servicosService.list().then(s => { setServicos(s); setLoading(false) })
  }, [open])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filtered = search.trim() ? servicos.filter(s => norm(s.nome).includes(norm(search))) : servicos

  return (
    <Modal open={open} onClose={onClose} title="Adicionar Serviço do Catálogo" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9" placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-surface-50 rounded-xl border border-surface-100">
          {loading && <div className="p-4 text-center text-surface-400 text-sm">Carregando...</div>}
          {filtered.map(s => (
            <button key={s.id} onClick={() => { onSelect(s); onClose() }}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-50 transition-colors text-left">
              <div>
                <p className="font-medium text-surface-800 text-sm">{s.nome}</p>
                <p className="text-xs text-surface-400">{s.categoria?.nome || 'Sem categoria'}</p>
              </div>
              <span className="text-sm font-semibold text-brand-600 whitespace-nowrap">{formatCurrency(s.valor_base)}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ==== MAIN FORM ====
export function OrcamentoFormPage() {
  const navigate  = useNavigate()
  const { id }    = useParams<{ id: string }>()
  const isEditing = !!id

  const [cliente, setCliente]         = useState<Cliente | null>(null)
  const [itens, setItens]             = useState<ItemForm[]>([])
  const [urgencia, setUrgencia]       = useState<UrgenciaTipo>('normal')
  const [deslocamento, setDeslocamento] = useState(0)
  const [descontoPct, setDescontoPct] = useState(0)
  const [descontoValor, setDescontoValor] = useState(0)
  const [validade, setValidade]       = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loadingData, setLoadingData] = useState(isEditing)
  const [saving, setSaving]           = useState(false)

  const [clienteModal, setClienteModal]   = useState(false)
  const [servicoModal, setServicoModal]   = useState(false)
  const [whatsModal, setWhatsModal]       = useState(false)
  const [whatsMsg, setWhatsMsg]           = useState('')

  // Load existing quote for editing
  useEffect(() => {
    if (!isEditing) return
    orcamentosService.getById(id).then(orc => {
      if (orc.cliente) setCliente(orc.cliente)
      if (orc.itens) setItens(orc.itens.map(i => ({
        id: i.id, descricao: i.descricao, quantidade: i.quantidade,
        valor_unit: i.valor_unit, servico_id: i.servico_id, tipo: 'servico'
      })))
      setDescontoPct(orc.desconto_pct)
      setDescontoValor(orc.desconto_valor)
      setDeslocamento(orc.taxa_deslocamento)
      if (orc.data_validade) setValidade(orc.data_validade)
      if (orc.observacoes)   setObservacoes(orc.observacoes)
    }).catch(() => toast.error('Erro ao carregar orçamento'))
    .finally(() => setLoadingData(false))
  }, [id, isEditing])

  // Calc
  const calc = calcularOrcamento({
    itens: itens.map(i => ({ quantidade: i.quantidade, valor_unit: i.valor_unit, tipo: i.tipo })),
    urgencia, deslocamento, desconto_pct: descontoPct, desconto_valor: descontoValor,
  })

  function addItem() {
    setItens(prev => [...prev, { descricao: '', quantidade: 1, valor_unit: 0, tipo: 'servico' }])
  }

  function addFromServico(s: Servico) {
    setItens(prev => [...prev, {
      descricao: s.nome, quantidade: 1, valor_unit: s.valor_base,
      servico_id: s.id, tipo: 'servico',
    }])
  }

  function updateItem(idx: number, field: keyof ItemForm, value: any) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave(asSend = false) {
    if (!cliente) { toast.error('Selecione um cliente'); return }
    if (itens.length === 0) { toast.error('Adicione pelo menos um item'); return }
    if (itens.some(i => !i.descricao.trim())) { toast.error('Preencha a descrição de todos os itens'); return }

    setSaving(true)
    try {
      const payload = {
        cliente_id: cliente.id,
        status: asSend ? 'enviado' : 'rascunho',
        subtotal: calc.subtotalBruto,
        desconto_pct: descontoPct,
        desconto_valor: descontoValor,
        taxa_deslocamento: deslocamento,
        taxa_urgencia: calc.taxaUrgencia,
        total: calc.total,
        data_validade: validade || null,
        observacoes: observacoes || null,
      } as any

      const orcItens = itens.map(i => ({
        descricao: i.descricao, quantidade: i.quantidade,
        valor_unit: i.valor_unit, servico_id: i.servico_id || undefined,
      }))

      if (isEditing) {
        await orcamentosService.update(id, payload, orcItens)
        toast.success('Orçamento atualizado!')
      } else {
        const novo = await orcamentosService.create(payload, orcItens)
        toast.success('Orçamento criado!')
        navigate(`/orcamentos/${novo.id}`, { replace: true })
        return
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  function handlePrint() {
    if (!cliente) { toast.error('Selecione o cliente antes de gerar o PDF'); return }
    const fakeOrc = {
      numero: isEditing ? id! : 'RASCUNHO',
      cliente, itens: itens.map(i => ({ ...i, subtotal: i.quantidade * i.valor_unit })),
      status: 'rascunho', data_validade: validade || null,
      observacoes, created_at: new Date().toISOString(),
    } as any
    printOrcamento(buildOrcamentoPDFHtml(fakeOrc, calc))
  }

  function handleWhatsApp() {
    if (!cliente) { toast.error('Selecione o cliente'); return }
    if (!cliente.whatsapp) { toast.error('Cliente não possui WhatsApp cadastrado'); return }
    const fakeOrc = {
      numero: isEditing ? id! : 'RASCUNHO',
      cliente, itens: itens.map(i => ({ ...i, subtotal: i.quantidade * i.valor_unit })),
      data_validade: validade || null, observacoes,
    } as any
    const msg = buildWhatsAppMessage(fakeOrc, calc)
    setWhatsMsg(msg)
    setWhatsModal(true)
  }

  if (loadingData) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/orcamentos')} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="page-title">{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</h2>
          <p className="page-subtitle">Preencha os dados para gerar o orçamento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* LEFT — Form */}
        <div className="xl:col-span-2 space-y-5">

          {/* Cliente */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-surface-700 text-sm mb-4">Cliente</h3>
            {cliente ? (
              <div className="flex items-center justify-between p-3 bg-brand-50 rounded-xl border border-brand-100">
                <div>
                  <p className="font-semibold text-surface-800">{cliente.nome}</p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {[cliente.telefone && maskPhone(cliente.telefone), cliente.cidade].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button onClick={() => setClienteModal(true)} className="btn-secondary btn-sm">Trocar</button>
              </div>
            ) : (
              <button onClick={() => setClienteModal(true)} className="w-full border-2 border-dashed border-surface-200 rounded-xl p-5 text-surface-400 hover:border-brand-400 hover:text-brand-500 transition-colors flex items-center justify-center gap-2">
                <Search className="w-4 h-4" /> Selecionar cliente
              </button>
            )}
          </div>

          {/* Itens */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-surface-700 text-sm">Itens do Orçamento</h3>
              <div className="flex gap-2">
                <button onClick={() => setServicoModal(true)} className="btn-secondary btn-sm">
                  <Search className="w-3.5 h-3.5" /> Do catálogo
                </button>
                <button onClick={addItem} className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Item manual
                </button>
              </div>
            </div>

            {itens.length === 0 ? (
              <div className="border-2 border-dashed border-surface-150 rounded-xl p-8 text-center text-surface-400 text-sm">
                Nenhum item adicionado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  <span className="col-span-6">Descrição</span>
                  <span className="col-span-2 text-center">Qtd</span>
                  <span className="col-span-2 text-right">Valor Unit.</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1" />
                </div>
                {itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <input
                        className="input text-sm"
                        placeholder="Descrição do serviço/material"
                        value={item.descricao}
                        onChange={e => updateItem(idx, 'descricao', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number" min="0.01" step="0.01"
                        className="input text-sm text-center"
                        value={item.quantidade}
                        onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number" min="0" step="0.01"
                        className="input text-sm text-right"
                        value={item.valor_unit}
                        onChange={e => updateItem(idx, 'valor_unit', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-semibold text-surface-700 pr-1">
                      {formatCurrency(item.quantidade * item.valor_unit)}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button onClick={() => removeItem(idx)} className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Config */}
          <div className="card p-5 space-y-5">
            <h3 className="font-display font-semibold text-surface-700 text-sm">Configurações</h3>

            {/* Urgência */}
            <div>
              <label className="label mb-2">Tipo de atendimento</label>
              <div className="grid grid-cols-3 gap-2">
                {URGENCIA_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setUrgencia(opt.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      urgencia === opt.value
                        ? opt.value === 'normal' ? 'border-brand-500 bg-brand-50'
                          : opt.value === 'urgente' ? 'border-amber-400 bg-amber-50'
                          : 'border-red-400 bg-red-50'
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-surface-700">{opt.label}</span>
                      <span className={`text-xs font-bold ${
                        opt.value === 'normal' ? 'text-surface-400'
                        : opt.value === 'urgente' ? 'text-amber-600'
                        : 'text-red-600'
                      }`}>{opt.pct}</span>
                    </div>
                    <p className="text-xs text-surface-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Deslocamento (R$)">
                <input type="number" min="0" step="0.01" className="input"
                  value={deslocamento} onChange={e => setDeslocamento(parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="Desconto (%)">
                <input type="number" min="0" max="100" step="0.5" className="input"
                  value={descontoPct} onChange={e => { setDescontoPct(parseFloat(e.target.value) || 0); setDescontoValor(0) }} />
              </FormField>
              <FormField label="Desconto (R$)">
                <input type="number" min="0" step="0.01" className="input"
                  value={descontoValor} onChange={e => { setDescontoValor(parseFloat(e.target.value) || 0); setDescontoPct(0) }} />
              </FormField>
              <FormField label="Válido até">
                <input type="date" className="input"
                  value={validade} onChange={e => setValidade(e.target.value)} />
              </FormField>
            </div>

            <FormField label="Observações">
              <textarea className="input resize-none" rows={3}
                placeholder="Condições, garantias, prazo de execução..."
                value={observacoes} onChange={e => setObservacoes(e.target.value)} />
            </FormField>
          </div>
        </div>

        {/* RIGHT — Summary */}
        <div className="space-y-4">
          {/* Totals card */}
          <div className="card p-5 space-y-3 sticky top-4">
            <div className="flex items-center gap-2 mb-1">
              <Calculator className="w-4 h-4 text-brand-500" />
              <h3 className="font-display font-semibold text-surface-700 text-sm">Resumo Financeiro</h3>
            </div>

            <div className="space-y-2 text-sm">
              {calc.subtotalServicos > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Serviços</span>
                  <span>{formatCurrency(calc.subtotalServicos)}</span>
                </div>
              )}
              {calc.subtotalMateriais > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Materiais</span>
                  <span>{formatCurrency(calc.subtotalMateriais)}</span>
                </div>
              )}
              {calc.taxaUrgencia > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3"/>Urgência</span>
                  <span>+{formatCurrency(calc.taxaUrgencia)}</span>
                </div>
              )}
              {calc.deslocamento > 0 && (
                <div className="flex justify-between text-surface-600">
                  <span>Deslocamento</span>
                  <span>{formatCurrency(calc.deslocamento)}</span>
                </div>
              )}
              {calc.descontoAplicado > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Desconto</span>
                  <span>-{formatCurrency(calc.descontoAplicado)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-surface-100 pt-3 flex justify-between items-center">
              <span className="font-bold text-surface-900">Total</span>
              <span className="text-2xl font-display font-bold text-brand-600">{formatCurrency(calc.total)}</span>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-primary w-full">
                {saving ? <Spinner /> : <Save className="w-4 h-4" />}
                {isEditing ? 'Salvar alterações' : 'Salvar rascunho'}
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-secondary w-full">
                <CheckCircle className="w-4 h-4" />
                Salvar e marcar Enviado
              </button>
            </div>

            <SectionDivider label="Gerar / Enviar" />

            <div className="space-y-2">
              <button onClick={handlePrint} className="btn-secondary w-full text-sm">
                <FileText className="w-4 h-4" /> Gerar PDF / Imprimir
              </button>
              <button onClick={handleWhatsApp} className="w-full btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-400">
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </button>
            </div>

            {/* Tip */}
            {itens.length === 0 && (
              <p className="text-xs text-surface-400 text-center pt-1">
                Adicione itens ao orçamento para ver o cálculo
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ClienteSearchModal open={clienteModal} onClose={() => setClienteModal(false)} onSelect={setCliente} />
      <ServicoPickerModal open={servicoModal} onClose={() => setServicoModal(false)} onSelect={addFromServico} />

      {/* WhatsApp preview modal */}
      <Modal
        open={whatsModal}
        onClose={() => setWhatsModal(false)}
        title="Enviar por WhatsApp"
        subtitle={cliente ? `Para: ${maskPhone(cliente.whatsapp || cliente.telefone || '')}` : ''}
        size="md"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setWhatsModal(false)}>Cancelar</button>
            <a
              href={whatsappLink(cliente?.whatsapp || cliente?.telefone || '', whatsMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-400"
              onClick={() => setWhatsModal(false)}
            >
              <MessageCircle className="w-4 h-4" /> Abrir WhatsApp
            </a>
          </>
        }
      >
        <div className="bg-surface-50 rounded-xl p-4 max-h-64 overflow-y-auto">
          <pre className="text-xs text-surface-700 whitespace-pre-wrap font-sans leading-relaxed">{whatsMsg}</pre>
        </div>
        <p className="text-xs text-surface-400 mt-3">Você pode editar a mensagem diretamente no WhatsApp antes de enviar.</p>
      </Modal>
    </div>
  )
}
