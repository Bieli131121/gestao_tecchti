import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { osService } from '@/lib/os'
import { clientesService } from '@/lib/clientes'
import { servicosService } from '@/lib/servicos'
import { formatCurrency } from '@/lib/utils'
import { FormField, SectionDivider, Spinner, Modal } from '@/components/ui'
import { ArrowLeft, Plus, Trash2, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Cliente, Servico, OSStatus, OSPrioridade } from '@/types'

interface ItemForm {
  descricao: string
  quantidade: number
  valor_unit: number
  tipo: 'servico' | 'material'
  servico_id?: string
}

const DEFAULT_CHECKLIST_CAMERA = [
  'Verificar posicionamento da câmera','Testar conexão de rede',
  'Configurar resolução e FPS','Testar gravação no DVR/NVR',
  'Verificar visão noturna','Ajustar ângulo de visão','Limpar lente',
]
const DEFAULT_CHECKLIST_REDE = [
  'Verificar cabeamento','Testar conectividade','Configurar switch/roteador',
  'Testar velocidade de internet','Documentar topologia',
]
const DEFAULT_CHECKLIST_PC = [
  'Diagnosticar problema relatado','Fazer backup dos dados',
  'Executar verificação de vírus','Limpar hardware internamente',
  'Testar componentes','Atualizar drivers e sistema',
]

function ClientePickerModal({ open, onClose, onSelect }: {
  open: boolean; onClose: () => void; onSelect: (c: Cliente) => void
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setSearch('')
    setLoading(true)
    clientesService.list().then(r => { setResults(r); setLoading(false) })
  }, [open])

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const filtered = search.trim() ? results.filter(c => norm(c.nome).includes(norm(search))) : results

  return (
    <Modal open={open} onClose={onClose} title="Selecionar Cliente" size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input className="input pl-9" placeholder="Buscar cliente..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-surface-50 rounded-xl border border-surface-100">
          {loading && <p className="p-4 text-center text-sm text-surface-400">Carregando...</p>}
          {filtered.map(c => (
            <button key={c.id} onClick={() => { onSelect(c); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-brand-50 transition-colors text-left">
              <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-xs flex-shrink-0">
                {c.nome[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-surface-800 text-sm">{c.nome}</p>
                <p className="text-xs text-surface-400">{c.cidade || c.telefone || ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

export function OSFormPage() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)

  // Core fields
  const [cliente, setCliente]     = useState<Cliente | null>(null)
  const [titulo, setTitulo]       = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<OSPrioridade>('normal')
  const [tecnicoId, setTecnicoId] = useState('')
  const [dataPrevisao, setDataPrevisao] = useState('')
  const [observacoes, setObservacoes]   = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')

  // Items
  const [itens, setItens] = useState<ItemForm[]>([])

  // Checklist
  const [checklist, setChecklist] = useState<string[]>([])
  const [newCheckItem, setNewCheckItem] = useState('')

  // Support data
  const [tecnicos, setTecnicos]   = useState<{ id: string; nome: string }[]>([])
  const [servicos, setServicos]   = useState<Servico[]>([])
  const [clienteModal, setClienteModal] = useState(false)

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    Promise.all([osService.listTecnicos(), servicosService.list()])
      .then(([tec, srv]) => { setTecnicos(tec); setServicos(srv) })
  }, [])

  const total = itens.reduce((s, i) => s + i.quantidade * i.valor_unit, 0)

  function addItem() {
    setItens(prev => [...prev, { descricao: '', quantidade: 1, valor_unit: 0, tipo: 'servico' }])
  }

  function addServico(s: Servico) {
    setItens(prev => [...prev, { descricao: s.nome, quantidade: 1, valor_unit: s.valor_base, tipo: 'servico', servico_id: s.id }])
  }

  function updateItem(idx: number, field: keyof ItemForm, value: any) {
    setItens(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  function removeItem(idx: number) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setChecklist(prev => [...prev, newCheckItem.trim()])
    setNewCheckItem('')
  }

  function useChecklistTemplate(items: string[]) {
    setChecklist(items)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!cliente) e.cliente = 'Selecione um cliente'
    if (!titulo.trim()) e.titulo = 'Título obrigatório'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) { toast.error('Preencha os campos obrigatórios'); return }
    setSaving(true)
    try {
      const payload = {
        cliente_id: cliente!.id,
        tecnico_id: tecnicoId || null,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prioridade,
        status: 'aberto' as OSStatus,
        data_previsao: dataPrevisao ? new Date(dataPrevisao).toISOString() : null,
        valor_servico: itens.filter(i => i.tipo === 'servico').reduce((s, i) => s + i.quantidade * i.valor_unit, 0),
        valor_materiais: itens.filter(i => i.tipo === 'material').reduce((s, i) => s + i.quantidade * i.valor_unit, 0),
        valor_total: total,
        forma_pagamento: formaPagamento || null,
        observacoes: observacoes.trim() || null,
      } as any

      const osItens = itens.map(i => ({
        tipo: i.tipo, descricao: i.descricao, quantidade: i.quantidade,
        valor_unit: i.valor_unit, servico_id: i.servico_id || undefined,
      }))

      const nova = await osService.create(payload, osItens, checklist)
      toast.success(`OS #${nova.numero} criada!`)
      navigate(`/os/${nova.id}`)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar OS')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/os')} className="btn-ghost btn-sm">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="page-title">Nova Ordem de Serviço</h2>
          <p className="page-subtitle">Preencha os dados do atendimento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">

          {/* Cliente */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-sm text-surface-700 mb-3">
              Cliente <span className="text-red-500">*</span>
            </h3>
            {cliente ? (
              <div className="flex items-center justify-between p-3 bg-brand-50 rounded-xl border border-brand-100">
                <div>
                  <p className="font-semibold text-surface-800">{cliente.nome}</p>
                  <p className="text-xs text-surface-400">{cliente.cidade || cliente.telefone || ''}</p>
                </div>
                <button onClick={() => setClienteModal(true)} className="btn-secondary btn-sm">Trocar</button>
              </div>
            ) : (
              <div>
                <button onClick={() => setClienteModal(true)}
                  className={`w-full border-2 border-dashed rounded-xl p-5 flex items-center justify-center gap-2 transition-colors text-sm
                    ${errors.cliente ? 'border-red-300 text-red-400 hover:border-red-400' : 'border-surface-200 text-surface-400 hover:border-brand-400 hover:text-brand-500'}`}>
                  <Search className="w-4 h-4" /> Selecionar cliente
                </button>
                {errors.cliente && <p className="field-error mt-1">{errors.cliente}</p>}
              </div>
            )}
          </div>

          {/* Core info */}
          <div className="card p-5 space-y-4">
            <h3 className="font-display font-semibold text-sm text-surface-700">Dados da OS</h3>

            <FormField label="Título do serviço" required error={errors.titulo}>
              <input className={`input ${errors.titulo ? 'input-error' : ''}`}
                placeholder="Ex: Instalação câmera externa portão"
                value={titulo} onChange={e => { setTitulo(e.target.value); setErrors(p => ({...p, titulo: ''})) }}
                autoFocus />
            </FormField>

            <FormField label="Descrição / Problema relatado">
              <textarea className="input resize-none" rows={3}
                placeholder="Descreva o problema ou o serviço a ser realizado..."
                value={descricao} onChange={e => setDescricao(e.target.value)} />
            </FormField>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Prioridade">
                <select className="select" value={prioridade} onChange={e => setPrioridade(e.target.value as OSPrioridade)}>
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </FormField>
              <FormField label="Técnico responsável">
                <select className="select" value={tecnicoId} onChange={e => setTecnicoId(e.target.value)}>
                  <option value="">A definir</option>
                  {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </FormField>
              <FormField label="Data prevista">
                <input type="date" className="input" value={dataPrevisao} onChange={e => setDataPrevisao(e.target.value)} />
              </FormField>
              <FormField label="Forma de pagamento">
                <select className="select" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                  <option value="">A definir</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="cartao_debito">Cartão Débito</option>
                  <option value="cartao_credito">Cartão Crédito</option>
                  <option value="transferencia">Transferência</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* Itens */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm text-surface-700">Itens e Materiais</h3>
              <div className="flex gap-2">
                <select className="select text-xs py-1.5 w-40"
                  onChange={e => { const s = servicos.find(x => x.id === e.target.value); if(s) addServico(s); e.target.value = '' }}
                  defaultValue="">
                  <option value="" disabled>+ Do catálogo</option>
                  {servicos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <button onClick={addItem} className="btn-secondary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Manual
                </button>
              </div>
            </div>

            {itens.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-6 border-2 border-dashed border-surface-100 rounded-xl">
                Nenhum item adicionado (opcional)
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 px-1 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                  <span className="col-span-1">Tipo</span>
                  <span className="col-span-5">Descrição</span>
                  <span className="col-span-2 text-center">Qtd</span>
                  <span className="col-span-2 text-right">Valor</span>
                  <span className="col-span-1 text-right">Total</span>
                  <span className="col-span-1"/>
                </div>
                {itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-1">
                      <select className="select text-xs py-1.5 px-1" value={item.tipo}
                        onChange={e => updateItem(idx, 'tipo', e.target.value)}>
                        <option value="servico">🔧</option>
                        <option value="material">📦</option>
                      </select>
                    </div>
                    <div className="col-span-5">
                      <input className="input text-sm" placeholder="Descrição..."
                        value={item.descricao} onChange={e => updateItem(idx, 'descricao', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0.01" step="0.01" className="input text-sm text-center"
                        value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', parseFloat(e.target.value) || 1)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" min="0" step="0.01" className="input text-sm text-right"
                        value={item.valor_unit} onChange={e => updateItem(idx, 'valor_unit', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-1 text-right text-xs font-semibold text-surface-600">
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

          {/* Checklist */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-surface-700">Checklist de Tarefas</h3>
              <div className="flex gap-1.5">
                {[
                  { label: '📷 Câmera', items: DEFAULT_CHECKLIST_CAMERA },
                  { label: '🌐 Rede',   items: DEFAULT_CHECKLIST_REDE   },
                  { label: '💻 PC',     items: DEFAULT_CHECKLIST_PC     },
                ].map(t => (
                  <button key={t.label} onClick={() => useChecklistTemplate(t.items)}
                    className="btn-secondary btn-sm text-xs">{t.label}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <input className="input flex-1 text-sm" placeholder="Nova tarefa..."
                value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCheckItem()} />
              <button onClick={addCheckItem} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5"/></button>
            </div>

            {checklist.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">Nenhuma tarefa. Use os templates acima ou adicione manualmente.</p>
            ) : (
              <div className="space-y-1.5">
                {checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-surface-50 group">
                    <span className="w-5 h-5 rounded border-2 border-surface-300 flex-shrink-0" />
                    <span className="flex-1 text-sm text-surface-700">{item}</span>
                    <button onClick={() => setChecklist(prev => prev.filter((_, i) => i !== idx))}
                      className="opacity-0 group-hover:opacity-100 btn-icon btn-ghost btn-sm text-surface-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <FormField label="Observações internas">
            <textarea className="input resize-none" rows={3}
              placeholder="Notas para o técnico, condições especiais..."
              value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </FormField>
        </div>

        {/* RIGHT — Summary */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4 sticky top-4">
            <h3 className="font-display font-semibold text-sm text-surface-700">Resumo</h3>

            {itens.length > 0 && (
              <div className="space-y-1.5 text-sm">
                {itens.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-surface-600">
                    <span className="truncate flex-1 mr-2">{item.descricao || `Item ${idx + 1}`}</span>
                    <span className="flex-shrink-0">{formatCurrency(item.quantidade * item.valor_unit)}</span>
                  </div>
                ))}
                <div className="border-t border-surface-100 pt-2 flex justify-between font-bold text-surface-800">
                  <span>Total</span>
                  <span className="text-brand-600">{formatCurrency(total)}</span>
                </div>
              </div>
            )}

            {checklist.length > 0 && (
              <p className="text-xs text-surface-400">{checklist.length} tarefa{checklist.length !== 1 ? 's' : ''} no checklist</p>
            )}

            <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
              {saving ? <Spinner /> : <Plus className="w-4 h-4" />}
              Abrir Ordem de Serviço
            </button>
          </div>
        </div>
      </div>

      <ClientePickerModal open={clienteModal} onClose={() => setClienteModal(false)} onSelect={setCliente} />
    </div>
  )
}
