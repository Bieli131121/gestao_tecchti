import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { FormField, SectionDivider, Spinner, Avatar } from '@/components/ui'
import { maskPhone, ROLE_LABEL } from '@/lib/utils'
import { Save, Shield, LogOut, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'

export function PerfilPage() {
  const { user, updateProfile, signOut } = useAuthStore()

  const [nome, setNome]       = useState(user?.nome || '')
  const [telefone, setTel]    = useState(user?.telefone || '')
  const [saving, setSaving]   = useState(false)

  const [senhaAtual, setSenhaAtual]     = useState('')
  const [senhaNova, setSenhaNova]       = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [savingPass, setSavingPass]     = useState(false)

  async function handleSavePerfil() {
    if (!nome.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      await updateProfile({ nome: nome.trim(), telefone: telefone || undefined })
      toast.success('Perfil atualizado!')
    } catch { toast.error('Erro ao salvar perfil') }
    finally { setSaving(false) }
  }

  async function handleChangePassword() {
    if (!senhaNova) { toast.error('Digite a nova senha'); return }
    if (senhaNova.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    if (senhaNova !== senhaConfirm) { toast.error('Senhas não conferem'); return }

    setSavingPass(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senhaNova })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao alterar senha')
    } finally { setSavingPass(false) }
  }

  if (!user) return null

  return (
    <div className="space-y-6 animate-fade-in max-w-xl">
      <div>
        <h2 className="page-title">Meu Perfil</h2>
        <p className="page-subtitle">Suas informações e configurações de acesso</p>
      </div>

      {/* Avatar + role */}
      <div className="card p-6 flex items-center gap-5">
        <Avatar name={user.nome} size="lg" />
        <div>
          <p className="font-display font-bold text-surface-900 text-lg leading-tight">{user.nome}</p>
          <p className="text-sm text-surface-400 mt-0.5">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Shield className="w-3.5 h-3.5 text-brand-500" />
            <span className="text-xs font-semibold text-brand-600">{ROLE_LABEL[user.role]}</span>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-700">Dados pessoais</h3>

        <FormField label="Nome completo" required>
          <input
            className="input"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Seu nome"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="E-mail">
            <input
              className="input bg-surface-50 cursor-not-allowed"
              value={user.email}
              disabled
              title="O e-mail não pode ser alterado aqui"
            />
          </FormField>
          <FormField label="Telefone / WhatsApp">
            <input
              className="input"
              value={maskPhone(telefone)}
              onChange={e => setTel(e.target.value.replace(/\D/g, ''))}
              placeholder="(48) 99999-9999"
            />
          </FormField>
        </div>

        <button onClick={handleSavePerfil} disabled={saving} className="btn-primary">
          {saving ? <Spinner /> : <Save className="w-4 h-4" />}
          Salvar dados
        </button>
      </div>

      {/* Alterar senha */}
      <div className="card p-5 space-y-4">
        <h3 className="font-display font-semibold text-sm text-surface-700 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-500" />
          Alterar senha
        </h3>

        <FormField label="Nova senha">
          <input
            type="password"
            className="input"
            value={senhaNova}
            onChange={e => setSenhaNova(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </FormField>

        <FormField label="Confirmar nova senha">
          <input
            type="password"
            className="input"
            value={senhaConfirm}
            onChange={e => setSenhaConfirm(e.target.value)}
            placeholder="Repita a nova senha"
            autoComplete="new-password"
          />
        </FormField>

        <button onClick={handleChangePassword} disabled={savingPass} className="btn-secondary">
          {savingPass ? <Spinner /> : <KeyRound className="w-4 h-4" />}
          Alterar senha
        </button>
      </div>

      <SectionDivider label="Sessão" />

      {/* Logout */}
      <button
        onClick={() => {
          if (confirm('Deseja sair do sistema?')) signOut()
        }}
        className="btn-danger w-full"
      >
        <LogOut className="w-4 h-4" />
        Sair do sistema
      </button>
    </div>
  )
}
