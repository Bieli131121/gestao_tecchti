import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { clientesService } from '@/lib/clientes'
import { supabase } from '@/lib/supabase'
import {
  formatDate, formatCurrency, whatsappLink, maskPhone,
  OS_STATUS_BADGE, OS_STATUS_LABEL, ORCAMENTO_STATUS_BADGE, ORCAMENTO_STATUS_LABEL
} from '@/lib/utils'
import { ClienteForm } from './ClienteForm'
import { LoadingPage, ErrorState } from '@/components/ui'
import {
  ArrowLeft, Pencil, MessageCircle, Phone, Mail, MapPin,
  ClipboardList, FileText, Building2, User, Calendar, CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Cliente, OrdemServico, Orcamento, ClienteFormData } from '@/types'

export function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'dados' | 'os' | 'orcamentos'>('dados')
  const [os, setOs] = useState<OrdemServico[]>([])
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    loadCliente()
  }, [id])

  useEffect(() => {
    if (tab === 'os' && os.length === 0) loadOS()
    if (tab === 'orcamentos' && orcamentos.length === 0) loadOrcamentos()
  }, [tab])

  async function loadCliente() {
    setLoading(true)
    setError(null)
    try {
      const data = await clientesService.getById(id!)
      setCliente(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadOS() {
    setHistLoading(true)
    const { data } = await supabase
      .from('ordens_servico')
      .select('*')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setOs((data || []) as OrdemServico[])
    setHistLoading(false)
  }

  async function loadOrcamentos() {
    setHistLoading(true)
    const { data } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
    setOrcamentos((data || []) as Orcamento[])
    setHistLoading(false)
  }

  const handleSave = async (data: ClienteFormData) => {
    if (!cliente) return
    setSaving(true)
    try {
      const updated = await clientesService.update(cliente.id, data)
      setCliente(updated)
      setEditing(false)
      toast.success('Cliente atualizado!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingPage />
  if (error || !cliente) return <ErrorState message={error || 'Cliente não encontrado'} onRetry={loadCliente} />

  const fullAddress = [
    cliente.logradouro,
    cliente.numero && `nº ${cliente.numero}`,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade,
    cliente.estado,
  ].filter(Boolean).join(', ')

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="btn-icon btn-ghost">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="page-title truncate">{cliente.nome}</h2>
          <p className="page-subtitle capitalize">{cliente.tipo === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}</p>
        </div>
        <div className="flex items-center gap-2">
          {cliente.whatsapp && (
            <a
              href={whatsappLink(cliente.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary btn-sm text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          )}
          <button onClick={() => setEditing(!editing)} className="btn-secondary btn-sm">
            <Pencil className="w-3.5 h-3.5" />
            {editing ? 'Cancelar edição' : 'Editar'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="card p-6">
          <ClienteForm
            initialData={cliente}
            onSubmit={handleSave}
            onCancel={() => setEditing(false)}
            loading={saving}
          />
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
            {(['dados', 'os', 'orcamentos'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                {t === 'dados' ? 'Dados' : t === 'os' ? 'Ordens de Serviço' : 'Orçamentos'}
              </button>
            ))}
          </div>

          {tab === 'dados' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Info card */}
              <div className="card p-5 space-y-4 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                    {cliente.tipo === 'pj'
                      ? <Building2 className="w-6 h-6 text-brand-500" />
                      : <User className="w-6 h-6 text-brand-500" />
                    }
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-surface-900">{cliente.nome}</h3>
                    {cliente.cpf_cnpj && (
                      <p className="text-xs font-mono text-surface-500 mt-0.5">{cliente.cpf_cnpj}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-100">
                  {cliente.telefone && (
                    <InfoRow icon={Phone} label="Telefone" value={maskPhone(cliente.telefone)} />
                  )}
                  {cliente.email && (
                    <InfoRow icon={Mail} label="E-mail" value={cliente.email} />
                  )}
                  {fullAddress && (
                    <InfoRow icon={MapPin} label="Endereço" value={fullAddress} className="sm:col-span-2" />
                  )}
                  <InfoRow icon={Calendar} label="Cadastro" value={formatDate(cliente.created_at)} />
                </div>

                {cliente.observacoes && (
                  <div className="pt-3 border-t border-surface-100">
                    <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Observações</p>
                    <p className="text-sm text-surface-600 leading-relaxed">{cliente.observacoes}</p>
                  </div>
                )}
              </div>

              {/* Quick action cards */}
              <Link to={`/os/nova?cliente=${cliente.id}`} className="card-hover p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-800 text-sm">Nova Ordem de Serviço</p>
                  <p className="text-xs text-surface-400">Abrir OS para este cliente</p>
                </div>
              </Link>

              <Link to={`/orcamentos/novo?cliente=${cliente.id}`} className="card-hover p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-surface-800 text-sm">Novo Orçamento</p>
                  <p className="text-xs text-surface-400">Criar proposta para este cliente</p>
                </div>
              </Link>
            </div>
          )}

          {tab === 'os' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <h3 className="font-display font-bold text-surface-800 text-sm">Histórico de OS</h3>
                <Link to={`/os/nova?cliente=${cliente.id}`} className="btn-primary btn-sm">
                  Nova OS
                </Link>
              </div>
              {histLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
              ) : os.length === 0 ? (
                <div className="py-12 text-center">
                  <ClipboardList className="w-7 h-7 text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">Nenhuma OS encontrada</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-50">
                  {os.map((o) => (
                    <Link key={o.id} to={`/os/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-brand-600">#{o.numero}</span>
                          <span className="text-sm font-medium text-surface-800 truncate">{o.titulo}</span>
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5">{formatDate(o.data_abertura)}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={OS_STATUS_BADGE[o.status]}>{OS_STATUS_LABEL[o.status]}</span>
                        <span className="text-sm font-semibold text-surface-700">{formatCurrency(o.valor_total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'orcamentos' && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-100">
                <h3 className="font-display font-bold text-surface-800 text-sm">Orçamentos</h3>
                <Link to={`/orcamentos/novo?cliente=${cliente.id}`} className="btn-primary btn-sm">
                  Novo Orçamento
                </Link>
              </div>
              {histLoading ? (
                <div className="flex justify-center py-10"><div className="animate-spin w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full" /></div>
              ) : orcamentos.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="w-7 h-7 text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">Nenhum orçamento encontrado</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-50">
                  {orcamentos.map((o) => (
                    <Link key={o.id} to={`/orcamentos/${o.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-600">#{o.numero}</span>
                          <span className="text-xs text-surface-400">{formatDate(o.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={ORCAMENTO_STATUS_BADGE[o.status]}>{ORCAMENTO_STATUS_LABEL[o.status]}</span>
                        <span className="text-sm font-semibold text-surface-700">{formatCurrency(o.total)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, className }: { icon: React.ElementType; label: string; value: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 ${className || ''}`}>
      <Icon className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-surface-400">{label}</p>
        <p className="text-sm text-surface-700 font-medium">{value}</p>
      </div>
    </div>
  )
}
