import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate, ROLE_LABEL, maskPhone } from '@/lib/utils'
import { LoadingPage, FormField, SectionDivider, Spinner, Modal, ConfirmDialog, Avatar } from '@/components/ui'
import {
  Building2, Users, FileText, Save, Plus,
  Pencil, Trash2, CheckCircle, Shield, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Profile, UserRole } from '@/types'

// ── Tab bar ───────────────────────────────────────────────
function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  const tabs = [
    { id: 'empresa',  label: 'Empresa',   icon: Building2 },
    { id: 'usuarios', label: 'Usuários',  icon: Users     },
    { id: 'fiscal',   label: 'Fiscal',    icon: FileText  },
  ]
  return (
    <div className="flex gap-1 border-b border-surface-100 mb-6">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            active === t.id
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          }`}>
          <t.icon className="w-4 h-4" />{t.label}
        </button>
      ))}
    </div>
  )
}

// ── Empresa tab ───────────────────────────────────────────
function EmpresaTab() {
  const [form, setForm] = useState({
    nome_fantasia: '', razao_social: '', cnpj: '',
    inscricao_municipal: '', regime_tributario: 'simples_nacional',
    telefone: '', email: '', site: '',
    cep: '', logradouro: '', numero: '', complemento: '',
    bairro: '', cidade: '', estado: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [configId, setConfigId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('empresa_config').select('*').limit(1).single()
        if (data) {
          setConfigId(data.id)
          setForm({
            nome_fantasia: data.nome_fantasia || '',
            razao_social: data.razao_social || '',
            cnpj: data.cnpj || '',
            inscricao_municipal: data.inscricao_municipal || '',
            regime_tributario: data.regime_tributario || 'simples_nacional',
            telefone: data.contato?.telefone || '',
            email: data.contato?.email || '',
            site: data.contato?.site || '',
            cep: data.endereco?.cep || '',
            logradouro: data.endereco?.logradouro || '',
            numero: data.endereco?.numero || '',
            complemento: data.endereco?.complemento || '',
            bairro: data.endereco?.bairro || '',
            cidade: data.endereco?.cidade || '',
            estado: data.endereco?.estado || '',
          })
        }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const set = (f: keyof typeof form, v: string) => setForm(p => ({ ...p, [f]: v }))

  async function handleSave() {
    setSaving(true)
    try {
      const payload = {
        nome_fantasia: form.nome_fantasia,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
        inscricao_municipal: form.inscricao_municipal,
        regime_tributario: form.regime_tributario,
        contato: { telefone: form.telefone, email: form.email, site: form.site },
        endereco: { cep: form.cep, logradouro: form.logradouro, numero: form.numero, complemento: form.complemento, bairro: form.bairro, cidade: form.cidade, estado: form.estado },
      }
      if (configId) {
        await supabase.from('empresa_config').update(payload).eq('id', configId)
      } else {
        const { data } = await supabase.from('empresa_config').insert(payload).select().single()
        if (data) setConfigId(data.id)
      }
      toast.success('Dados da empresa salvos!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-700">Dados Cadastrais</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Nome fantasia" className="col-span-2">
            <input className="input" value={form.nome_fantasia} onChange={e => set('nome_fantasia', e.target.value)} placeholder="TecchTI" />
          </FormField>
          <FormField label="Razão social">
            <input className="input" value={form.razao_social} onChange={e => set('razao_social', e.target.value)} />
          </FormField>
          <FormField label="CNPJ">
            <input className="input" value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </FormField>
          <FormField label="Inscrição municipal">
            <input className="input" value={form.inscricao_municipal} onChange={e => set('inscricao_municipal', e.target.value)} />
          </FormField>
          <FormField label="Regime tributário">
            <select className="select" value={form.regime_tributario} onChange={e => set('regime_tributario', e.target.value)}>
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
              <option value="mei">MEI</option>
            </select>
          </FormField>
        </div>

        <SectionDivider label="Contato" />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Telefone">
            <input className="input" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(48) 99999-9999" />
          </FormField>
          <FormField label="E-mail">
            <input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="contato@tecchti.com.br" />
          </FormField>
          <FormField label="Site" className="col-span-2">
            <input className="input" value={form.site} onChange={e => set('site', e.target.value)} placeholder="https://tecchti.vercel.app" />
          </FormField>
        </div>

        <SectionDivider label="Endereço" />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="CEP">
            <input className="input" value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="88780-000" />
          </FormField>
          <FormField label="Cidade">
            <input className="input" value={form.cidade} onChange={e => set('cidade', e.target.value)} placeholder="Garopaba" />
          </FormField>
          <FormField label="Logradouro" className="col-span-2">
            <input className="input" value={form.logradouro} onChange={e => set('logradouro', e.target.value)} />
          </FormField>
          <FormField label="Número">
            <input className="input" value={form.numero} onChange={e => set('numero', e.target.value)} />
          </FormField>
          <FormField label="Bairro">
            <input className="input" value={form.bairro} onChange={e => set('bairro', e.target.value)} />
          </FormField>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? <Spinner /> : <Save className="w-4 h-4" />} Salvar dados da empresa
      </button>
    </div>
  )
}

// ── Usuários tab ──────────────────────────────────────────
function UsuariosTab() {
  const { user: me } = useAuthStore()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Profile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('profiles').select('*').order('nome')
        setProfiles((data as Profile[]) || [])
      } finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleToggleAtivo(p: Profile) {
    try {
      await supabase.from('profiles').update({ ativo: !p.ativo }).eq('id', p.id)
      setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !p.ativo } : x))
      toast.success(p.ativo ? 'Usuário desativado' : 'Usuário ativado')
    } catch { toast.error('Erro ao atualizar') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await supabase.from('profiles').update({ ativo: false }).eq('id', deleteTarget.id)
      setProfiles(prev => prev.map(x => x.id === deleteTarget.id ? { ...x, ativo: false } : x))
      toast.success('Usuário desativado')
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500">{profiles.length} usuário{profiles.length !== 1 ? 's' : ''} cadastrado{profiles.length !== 1 ? 's' : ''}</p>
        <button onClick={() => { setEditTarget(null); setModalOpen(true) }} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> Novo usuário
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="divide-y divide-surface-50">
          {profiles.map(p => (
            <div key={p.id} className={`flex items-center gap-4 px-5 py-4 ${!p.ativo ? 'opacity-50' : ''}`}>
              <Avatar name={p.nome} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-surface-800 text-sm">{p.nome}</span>
                  {p.id === me?.id && <span className="badge badge-blue text-[10px]">você</span>}
                  {!p.ativo && <span className="badge badge-gray text-[10px]">inativo</span>}
                </div>
                <p className="text-xs text-surface-400 mt-0.5">{p.email} · {maskPhone(p.telefone || '')}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <RoleBadge role={p.role} />
                {p.id !== me?.id && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditTarget(p); setModalOpen(true) }}
                      className="btn-icon btn-ghost btn-sm" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggleAtivo(p)}
                      className={`btn-icon btn-ghost btn-sm ${p.ativo ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                      title={p.ativo ? 'Desativar' : 'Ativar'}>
                      {p.ativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setDeleteTarget(p)}
                      className="btn-icon btn-ghost btn-sm text-red-400 hover:bg-red-50" title="Remover">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <UsuarioModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null) }}
        onSaved={p => setProfiles(prev => {
          const idx = prev.findIndex(x => x.id === p.id)
          if (idx >= 0) { const n = [...prev]; n[idx] = p; return n }
          return [...prev, p]
        })}
        initial={editTarget}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Desativar usuário"
        description={`Desativar "${deleteTarget?.nome}"? O usuário não conseguirá mais fazer login.`}
        confirmLabel="Desativar"
        loading={deleting}
      />
    </div>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    admin:      'badge-red',
    tecnico:    'badge-blue',
    financeiro: 'badge-green',
    vendedor:   'badge-yellow',
  }
  return <span className={`badge ${styles[role]}`}><Shield className="w-2.5 h-2.5" />{ROLE_LABEL[role]}</span>
}

function UsuarioModal({ open, onClose, onSaved, initial }: {
  open: boolean; onClose: () => void
  onSaved: (p: Profile) => void; initial?: Profile | null
}) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', role: 'tecnico' as UserRole, password: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Partial<typeof form>>({})

  useEffect(() => {
    if (!open) return
    setForm(initial ? { nome: initial.nome, email: initial.email, telefone: initial.telefone || '', role: initial.role, password: '' } : { nome: '', email: '', telefone: '', role: 'tecnico', password: '' })
    setErrors({})
  }, [open, initial])

  const set = (f: keyof typeof form, v: string) => { setForm(p => ({ ...p, [f]: v })); setErrors(p => ({ ...p, [f]: undefined })) }

  async function handleSave() {
    const e: Partial<typeof form> = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (!form.email.trim()) e.email = 'E-mail obrigatório'
    if (!initial && !form.password) e.password = 'Senha obrigatória'
    if (!initial && form.password.length < 6) e.password = 'Mínimo 6 caracteres'
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    try {
      if (initial) {
        // Update existing profile
        const { data } = await supabase.from('profiles')
          .update({ nome: form.nome.trim(), telefone: form.telefone, role: form.role })
          .eq('id', initial.id).select().single()
        toast.success('Usuário atualizado!')
        onSaved(data as Profile)
      } else {
        // Create auth user then profile
        const { data: authData, error: authError } = await supabase.auth.admin
          ? { data: null, error: null } // admin API not available from client
          : { data: null, error: { message: 'Use o painel do Supabase para criar novos usuários' } }

        if (authError) {
          toast.error('Para criar usuários, acesse: Supabase → Authentication → Users')
          toast('Depois atualize o role na tabela profiles', { icon: 'ℹ️' })
          return
        }
      }
      onClose()
    } catch (err: any) { toast.error(err.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm"
      title={initial ? 'Editar Usuário' : 'Novo Usuário'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving && <Spinner />} {initial ? 'Salvar' : 'Criar usuário'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!initial && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <strong>Para criar usuários:</strong> Acesse Supabase → Authentication → Users → Add user. Depois atualize o campo <code className="bg-amber-100 px-1 rounded">role</code> na tabela profiles.
          </div>
        )}
        <FormField label="Nome completo" required error={errors.nome}>
          <input className={`input ${errors.nome ? 'input-error' : ''}`} value={form.nome}
            onChange={e => set('nome', e.target.value)} autoFocus />
        </FormField>
        <FormField label="E-mail" required error={errors.email}>
          <input type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email}
            onChange={e => set('email', e.target.value)} disabled={!!initial} />
        </FormField>
        <FormField label="Telefone">
          <input className="input" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(48) 99999-9999" />
        </FormField>
        <FormField label="Perfil de acesso">
          <select className="select" value={form.role} onChange={e => set('role', e.target.value as UserRole)}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </FormField>
        {initial && (
          <div className="p-3 rounded-xl bg-surface-50 border text-xs text-surface-500">
            Para alterar a senha, o usuário deve usar a opção "Esqueci a senha" na tela de login.
          </div>
        )}
      </div>
    </Modal>
  )
}

// ── Fiscal tab ────────────────────────────────────────────
function FiscalTab() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm text-surface-700">Integração Fiscal — NFS-e</h3>
            <p className="text-xs text-surface-400">Emissão de Nota Fiscal de Serviço Eletrônica</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { step: '1', label: 'Obter Certificado Digital A1', desc: 'Adquira o e-CPF ou e-CNPJ A1 (arquivo). Custo médio: R$ 250–350/ano. Emitido por: Certisign, Serasa, Soluti.', done: false },
            { step: '2', label: 'Cadastrar empresa na prefeitura', desc: 'Verifique se o município de Garopaba (IBGE: 4204301) exige NFS-e e cadastre a empresa no portal.', done: false },
            { step: '3', label: 'Contratar API fiscal', desc: 'Focus NFe (recomendado — mesmo padrão do GestãoPro), eNotas, NFe.io ou Plugnotas. Ambiente de homologação gratuito.', done: false },
            { step: '4', label: 'Configurar token da API', desc: 'Insira o token de API abaixo e teste a emissão em homologação.', done: false },
            { step: '5', label: 'Emissão em produção', desc: 'Após testes aprovados, ative o ambiente de produção. O sistema gerará NFS-e automaticamente ao concluir cada OS.', done: false },
          ].map(s => (
            <div key={s.step} className="flex gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${s.done ? 'bg-emerald-500 text-white' : 'bg-surface-200 text-surface-500'}`}>
                {s.done ? <CheckCircle className="w-3.5 h-3.5" /> : s.step}
              </div>
              <div>
                <p className="text-sm font-medium text-surface-700">{s.label}</p>
                <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-700">Configuração da API Fiscal</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Provedor">
            <select className="select">
              <option value="focus">Focus NFe</option>
              <option value="enotas">eNotas</option>
              <option value="nfeio">NFe.io</option>
              <option value="plugnotas">Plugnotas</option>
            </select>
          </FormField>
          <FormField label="Ambiente">
            <select className="select">
              <option value="homologacao">Homologação (testes)</option>
              <option value="producao">Produção</option>
            </select>
          </FormField>
          <FormField label="Token / API Key" className="col-span-2">
            <input className="input font-mono text-xs" placeholder="Insira o token da API fiscal aqui..." />
          </FormField>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm">Testar conexão</button>
          <button className="btn-primary btn-sm" disabled>
            <Save className="w-3.5 h-3.5" /> Salvar configuração
          </button>
        </div>
        <p className="text-xs text-surface-400">A integração fiscal completa estará disponível após obter o Certificado Digital.</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export function ConfiguracoesPage() {
  const [tab, setTab] = useState('empresa')

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="page-title">Configurações</h2>
        <p className="page-subtitle">Empresa, usuários e sistema</p>
      </div>
      <TabBar active={tab} onChange={setTab} />
      {tab === 'empresa'  && <EmpresaTab />}
      {tab === 'usuarios' && <UsuariosTab />}
      {tab === 'fiscal'   && <FiscalTab />}
    </div>
  )
}
