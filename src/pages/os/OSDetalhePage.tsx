import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { osService } from '@/lib/os'
import { formatCurrency, formatDateTime, OS_STATUS_BADGE, OS_STATUS_LABEL, PRIORIDADE_BADGE, PRIORIDADE_LABEL, whatsappLink, maskPhone } from '@/lib/utils'
import { LoadingPage, ErrorState, Modal, SectionDivider, Spinner } from '@/components/ui'
import {
  ArrowLeft, CheckSquare, Square, Plus, Trash2,
  Camera, X, FileText, MessageCircle, CheckCircle2,
  User, Calendar, Clock, Pencil, Save, XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { OrdemServico, OSStatus, OSFoto } from '@/types'

export function OSDetalhePage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const [os, setOs]                   = useState<OrdemServico | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [fotoTipo, setFotoTipo]       = useState<OSFoto['tipo']>('geral')
  const [signModal, setSignModal]     = useState(false)
  const [saving, setSaving]           = useState(false)
  const [editMode, setEditMode]       = useState(false)
  const [editObs, setEditObs]         = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const data = await osService.getById(id)
      setOs(data)
      setEditObs(data.observacoes || '')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleStatusChange(status: OSStatus) {
    if (!os) return
    try {
      await osService.updateStatus(os.id, status)
      setOs(prev => prev ? { ...prev, status } : prev)
      toast.success(`Status → ${OS_STATUS_LABEL[status]}`)
    } catch { toast.error('Erro ao atualizar status') }
  }

  async function handleToggleCheck(itemId: string, current: boolean) {
    if (!os) return
    try {
      await osService.toggleChecklist(itemId, !current)
      setOs(prev => prev ? {
        ...prev,
        checklist: prev.checklist?.map(c => c.id === itemId ? { ...c, concluido: !current } : c)
      } : prev)
    } catch { toast.error('Erro ao atualizar checklist') }
  }

  async function handleAddCheckItem() {
    if (!os || !newCheckItem.trim()) return
    const ordem = (os.checklist?.length || 0)
    try {
      const item = await osService.addChecklistItem(os.id, newCheckItem.trim(), ordem)
      setOs(prev => prev ? { ...prev, checklist: [...(prev.checklist || []), item] } : prev)
      setNewCheckItem('')
    } catch { toast.error('Erro ao adicionar item') }
  }

  async function handleDeleteCheck(itemId: string) {
    if (!os) return
    try {
      await osService.deleteChecklistItem(itemId)
      setOs(prev => prev ? { ...prev, checklist: prev.checklist?.filter(c => c.id !== itemId) } : prev)
    } catch { toast.error('Erro ao remover item') }
  }

  async function handleFotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!os || !e.target.files?.length) return
    const file = e.target.files[0]
    setUploadingFoto(true)
    try {
      const foto = await osService.uploadFoto(os.id, file, fotoTipo)
      setOs(prev => prev ? { ...prev, fotos: [...(prev.fotos || []), foto] } : prev)
      toast.success('Foto adicionada!')
    } catch (err: any) {
      toast.error('Erro ao enviar foto: ' + (err.message || ''))
    } finally {
      setUploadingFoto(false)
      e.target.value = ''
    }
  }

  async function handleDeleteFoto(foto: OSFoto) {
    if (!os) return
    try {
      await osService.deleteFoto(foto)
      setOs(prev => prev ? { ...prev, fotos: prev.fotos?.filter(f => f.id !== foto.id) } : prev)
    } catch { toast.error('Erro ao remover foto') }
  }

  // Canvas signature
  function getCanvasPos(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function setupCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function handleCanvasMouseDown(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawing.current = true
    const ctx = canvas.getContext('2d')!
    const pos = getCanvasPos(e.nativeEvent as any, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function handleCanvasMove(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getCanvasPos(e.nativeEvent as any, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  async function saveSignature() {
    const canvas = canvasRef.current
    if (!canvas || !os) return
    const dataUrl = canvas.toDataURL('image/png')
    setSaving(true)
    try {
      const updated = await osService.saveAssinatura(os.id, dataUrl)
      setOs(prev => prev ? { ...prev, assinatura_url: updated.assinatura_url, assinado_em: updated.assinado_em } : prev)
      toast.success('Assinatura salva!')
      setSignModal(false)
    } catch { toast.error('Erro ao salvar assinatura') }
    finally { setSaving(false) }
  }

  async function handleSaveObs() {
    if (!os) return
    setSaving(true)
    try {
      await osService.update(os.id, { observacoes: editObs })
      setOs(prev => prev ? { ...prev, observacoes: editObs } : prev)
      setEditMode(false)
      toast.success('Observações salvas')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  function handlePrint() {
    if (!os) return
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Permita pop-ups para imprimir'); return }
    win.document.write(osService.buildOSPDFHtml(os))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  if (loading) return <LoadingPage />
  if (error || !os) return <ErrorState message={error || 'OS não encontrada'} onRetry={load} />

  const checkDone = os.checklist?.filter(c => c.concluido).length || 0
  const checkTotal = os.checklist?.length || 0
  const checkPct = checkTotal > 0 ? Math.round((checkDone / checkTotal) * 100) : 0

  const fotosPorTipo = {
    antes:  (os.fotos || []).filter(f => f.tipo === 'antes'),
    depois: (os.fotos || []).filter(f => f.tipo === 'depois'),
    geral:  (os.fotos || []).filter(f => f.tipo === 'geral'),
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/os')} className="btn-ghost btn-sm">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-brand-600">OS #{os.numero}</span>
              <span className={OS_STATUS_BADGE[os.status]}>{OS_STATUS_LABEL[os.status]}</span>
              <span className={PRIORIDADE_BADGE[os.prioridade]}>{PRIORIDADE_LABEL[os.prioridade]}</span>
            </div>
            <p className="text-base font-display font-bold text-surface-900 mt-0.5">{os.titulo}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={handlePrint} className="btn-secondary btn-sm">
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          {os.cliente?.whatsapp && (
            <a href={whatsappLink(os.cliente.whatsapp, `Olá! Referente à OS #${os.numero} — ${os.titulo}. `)}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-sm bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-400">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Status quick change */}
      <div className="card p-4 flex flex-wrap gap-2">
        {(['aberto','em_andamento','pausado','concluido','cancelado'] as OSStatus[]).map(s => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              os.status === s
                ? 'bg-brand-600 text-white shadow-sm scale-[1.02]'
                : 'bg-surface-100 text-surface-500 hover:bg-surface-200'
            }`}
          >{OS_STATUS_LABEL[s]}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-5">

          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-3">
              <p className="text-xs text-surface-400 flex items-center gap-1 mb-1"><User className="w-3 h-3"/>Cliente</p>
              <p className="text-sm font-semibold text-surface-800 truncate">{os.cliente?.nome}</p>
              {os.cliente?.telefone && <p className="text-xs text-surface-400">{maskPhone(os.cliente.telefone)}</p>}
            </div>
            <div className="card p-3">
              <p className="text-xs text-surface-400 flex items-center gap-1 mb-1"><User className="w-3 h-3"/>Técnico</p>
              <p className="text-sm font-semibold text-surface-800">{os.tecnico?.nome || '—'}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-surface-400 flex items-center gap-1 mb-1"><Calendar className="w-3 h-3"/>Abertura</p>
              <p className="text-sm font-semibold text-surface-800">{formatDateTime(os.data_abertura)}</p>
            </div>
            <div className="card p-3">
              <p className="text-xs text-surface-400 flex items-center gap-1 mb-1"><Clock className="w-3 h-3"/>Previsão</p>
              <p className="text-sm font-semibold text-surface-800">{os.data_previsao ? formatDateTime(os.data_previsao) : '—'}</p>
            </div>
          </div>

          {/* Description */}
          {os.descricao && (
            <div className="card p-5">
              <h3 className="font-display font-semibold text-sm text-surface-700 mb-2">Descrição</h3>
              <p className="text-sm text-surface-600 leading-relaxed">{os.descricao}</p>
            </div>
          )}

          {/* Checklist */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-surface-700 flex items-center gap-2">
                Checklist
                {checkTotal > 0 && (
                  <span className="text-xs font-normal text-surface-400">{checkDone}/{checkTotal}</span>
                )}
              </h3>
              {checkTotal > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${checkPct}%` }} />
                  </div>
                  <span className="text-xs text-surface-400">{checkPct}%</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 mb-3">
              {(os.checklist || []).map(item => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-50 group transition-colors">
                  <button onClick={() => handleToggleCheck(item.id, item.concluido)}
                    className={`flex-shrink-0 transition-colors ${item.concluido ? 'text-emerald-500' : 'text-surface-300 hover:text-surface-400'}`}>
                    {item.concluido
                      ? <CheckSquare className="w-5 h-5" />
                      : <Square className="w-5 h-5" />
                    }
                  </button>
                  <span className={`flex-1 text-sm ${item.concluido ? 'text-surface-400 line-through' : 'text-surface-700'}`}>
                    {item.item}
                  </span>
                  <button onClick={() => handleDeleteCheck(item.id)}
                    className="opacity-0 group-hover:opacity-100 btn-icon btn-ghost btn-sm text-surface-300 hover:text-red-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input className="input flex-1 text-sm" placeholder="Nova tarefa..."
                value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCheckItem()} />
              <button onClick={handleAddCheckItem} className="btn-primary btn-sm">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Photos */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-sm text-surface-700">Fotos</h3>
              <div className="flex gap-2 items-center">
                <select className="select text-xs py-1.5 w-28" value={fotoTipo} onChange={e => setFotoTipo(e.target.value as OSFoto['tipo'])}>
                  <option value="antes">Antes</option>
                  <option value="depois">Depois</option>
                  <option value="geral">Geral</option>
                </select>
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={handleFotoUpload} />
                <button onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFoto}
                  className="btn-primary btn-sm">
                  {uploadingFoto ? <Spinner /> : <Camera className="w-3.5 h-3.5" />}
                  Foto
                </button>
              </div>
            </div>

            {Object.entries(fotosPorTipo).map(([tipo, fotos]) => fotos.length > 0 && (
              <div key={tipo} className="mb-4">
                <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  {tipo === 'antes' ? 'Antes' : tipo === 'depois' ? 'Depois' : 'Geral'}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {fotos.map(foto => (
                    <div key={foto.id} className="relative group aspect-square rounded-xl overflow-hidden bg-surface-100">
                      <img src={foto.url} alt={foto.legenda || tipo}
                        className="w-full h-full object-cover" />
                      <button onClick={() => handleDeleteFoto(foto)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {(os.fotos?.length || 0) === 0 && (
              <p className="text-sm text-surface-400 text-center py-6 border-2 border-dashed border-surface-100 rounded-xl">
                Nenhuma foto adicionada ainda
              </p>
            )}
          </div>

          {/* Observations */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-surface-700">Observações</h3>
              {!editMode
                ? <button onClick={() => setEditMode(true)} className="btn-ghost btn-sm"><Pencil className="w-3.5 h-3.5" /></button>
                : <div className="flex gap-1">
                    <button onClick={() => setEditMode(false)} className="btn-ghost btn-sm text-surface-400"><XCircle className="w-3.5 h-3.5"/></button>
                    <button onClick={handleSaveObs} disabled={saving} className="btn-primary btn-sm">
                      {saving ? <Spinner/> : <Save className="w-3.5 h-3.5"/>} Salvar
                    </button>
                  </div>
              }
            </div>
            {editMode
              ? <textarea className="input resize-none" rows={4} value={editObs} onChange={e => setEditObs(e.target.value)} />
              : <p className="text-sm text-surface-600 leading-relaxed whitespace-pre-wrap">
                  {os.observacoes || <span className="text-surface-300">Nenhuma observação</span>}
                </p>
            }
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-4">
          {/* Financial summary */}
          <div className="card p-5">
            <h3 className="font-display font-semibold text-sm text-surface-700 mb-4">Valores</h3>
            {os.itens && os.itens.length > 0 ? (
              <div className="space-y-2 text-sm">
                {os.itens.map(item => (
                  <div key={item.id} className="flex justify-between text-surface-600">
                    <span className="truncate flex-1 mr-2">{item.descricao}</span>
                    <span>{formatCurrency(item.subtotal ?? item.quantidade * item.valor_unit)}</span>
                  </div>
                ))}
                {os.desconto > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Desconto</span>
                    <span>-{formatCurrency(os.desconto)}</span>
                  </div>
                )}
                <div className="border-t border-surface-100 pt-2 flex justify-between font-bold text-surface-800">
                  <span>Total</span>
                  <span className="text-brand-600 text-base">{formatCurrency(os.valor_total)}</span>
                </div>
                {os.forma_pagamento && (
                  <p className="text-xs text-surface-400 capitalize">{os.forma_pagamento.replace('_', ' ')}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-surface-400">Nenhum item cadastrado</p>
            )}
          </div>

          {/* Signature */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-semibold text-sm text-surface-700">Assinatura do Cliente</h3>
              <button onClick={() => { setSignModal(true); setTimeout(setupCanvas, 100) }}
                className="btn-secondary btn-sm">
                <Pencil className="w-3.5 h-3.5" /> {os.assinatura_url ? 'Refazer' : 'Assinar'}
              </button>
            </div>
            {os.assinatura_url ? (
              <div>
                <img src={os.assinatura_url} alt="Assinatura" className="w-full rounded-xl border border-surface-100 bg-white p-2" />
                {os.assinado_em && (
                  <p className="text-xs text-surface-400 mt-1.5 text-center flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Assinado em {formatDateTime(os.assinado_em)}
                  </p>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-surface-200 rounded-xl p-8 text-center text-surface-400 text-sm">
                Sem assinatura
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature modal */}
      <Modal open={signModal} onClose={() => setSignModal(false)} title="Assinatura do Cliente"
        subtitle="Peça ao cliente para assinar na tela abaixo"
        size="md"
        footer={
          <>
            <button className="btn-ghost btn-sm" onClick={clearCanvas}>Limpar</button>
            <button className="btn-secondary" onClick={() => setSignModal(false)}>Cancelar</button>
            <button className="btn-primary" onClick={saveSignature} disabled={saving}>
              {saving && <Spinner />} Confirmar assinatura
            </button>
          </>
        }
      >
        <canvas
          ref={canvasRef}
          width={480}
          height={200}
          className="w-full border-2 border-surface-200 rounded-xl bg-white cursor-crosshair touch-none"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMove}
          onMouseUp={() => { isDrawing.current = false }}
          onMouseLeave={() => { isDrawing.current = false }}
          onTouchStart={handleCanvasMouseDown}
          onTouchMove={handleCanvasMove}
          onTouchEnd={() => { isDrawing.current = false }}
        />
        <p className="text-xs text-surface-400 text-center mt-2">Assine com o dedo ou mouse</p>
      </Modal>
    </div>
  )
}
