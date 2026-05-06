import { useState, useEffect } from 'react'
import { cn, maskCPF, maskCNPJ, maskPhone, maskCEP, buscarCEP } from '@/lib/utils'
import { FormField, SectionDivider, Spinner } from '@/components/ui'
import { Search } from 'lucide-react'
import type { Cliente, ClienteFormData } from '@/types'

interface ClienteFormProps {
  initialData?: Partial<Cliente>
  onSubmit: (data: ClienteFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
]

const DEFAULT: ClienteFormData = {
  tipo: 'pf',
  nome: '',
  cpf_cnpj: '',
  telefone: '',
  whatsapp: '',
  email: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: 'Garopaba',
  estado: 'SC',
  inscricao_estadual: '',
  inscricao_municipal: '',
  observacoes: '',
  ativo: true,
}

export function ClienteForm({ initialData, onSubmit, onCancel, loading }: ClienteFormProps) {
  const [form, setForm] = useState<ClienteFormData>({ ...DEFAULT, ...initialData })
  const [errors, setErrors] = useState<Partial<Record<keyof ClienteFormData, string>>>({})
  const [cepLoading, setCepLoading] = useState(false)

  useEffect(() => {
    if (initialData) setForm({ ...DEFAULT, ...initialData })
  }, [initialData])

  const set = (field: keyof ClienteFormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleCpfCnpj = (raw: string) => {
    set('cpf_cnpj', form.tipo === 'pf' ? maskCPF(raw) : maskCNPJ(raw))
  }

  const handleCEPBlur = async () => {
    const cep = form.cep?.replace(/\D/g, '')
    if (cep?.length !== 8) return
    setCepLoading(true)
    const result = await buscarCEP(cep)
    setCepLoading(false)
    if (result) {
      setForm(prev => ({
        ...prev,
        logradouro: result.logradouro || prev.logradouro,
        bairro: result.bairro || prev.bairro,
        cidade: result.cidade || prev.cidade,
        estado: result.estado || prev.estado,
      }))
    }
  }

  const validate = () => {
    const e: typeof errors = {}
    if (!form.nome.trim()) e.nome = 'Nome obrigatório'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit(form)
  }

  const iField = (
    field: keyof ClienteFormData,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> & { required?: boolean } = {}
  ) => (
    <FormField label={label} error={errors[field]} required={props.required}>
      <input
        value={(form[field] as string) || ''}
        onChange={e => set(field, e.target.value)}
        className={cn('input', errors[field] && 'input-error')}
        {...props}
      />
    </FormField>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Tipo */}
      <div>
        <label className="label">Tipo de pessoa</label>
        <div className="flex rounded-xl border border-surface-200 overflow-hidden bg-white w-fit">
          {(['pf', 'pj'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { set('tipo', t); set('cpf_cnpj', '') }}
              className={cn(
                'px-5 py-2 text-sm font-medium transition-colors',
                form.tipo === t ? 'bg-brand-600 text-white' : 'text-surface-500 hover:bg-surface-50'
              )}
            >
              {t === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>
      </div>

      {/* Basic info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Nome completo" error={errors.nome} required className="sm:col-span-2">
          <input
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder={form.tipo === 'pj' ? 'Razão social ou nome fantasia' : 'Nome completo'}
            className={cn('input', errors.nome && 'input-error')}
          />
        </FormField>

        <FormField label={form.tipo === 'pf' ? 'CPF' : 'CNPJ'} error={errors.cpf_cnpj}>
          <input
            value={form.cpf_cnpj || ''}
            onChange={e => handleCpfCnpj(e.target.value)}
            placeholder={form.tipo === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
            className={cn('input font-mono', errors.cpf_cnpj && 'input-error')}
          />
        </FormField>

        {form.tipo === 'pj' && iField('inscricao_municipal', 'Inscrição Municipal', { placeholder: 'Opcional' })}
      </div>

      <SectionDivider label="Contato" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Telefone">
          <input
            value={form.telefone || ''}
            onChange={e => set('telefone', maskPhone(e.target.value))}
            placeholder="(48) 99999-9999"
            className="input"
            inputMode="tel"
          />
        </FormField>

        <FormField label="WhatsApp">
          <input
            value={form.whatsapp || ''}
            onChange={e => set('whatsapp', maskPhone(e.target.value))}
            placeholder="(48) 99999-9999"
            className="input"
            inputMode="tel"
          />
        </FormField>

        <FormField label="E-mail" error={errors.email} className="sm:col-span-2">
          <input
            type="email"
            value={form.email || ''}
            onChange={e => set('email', e.target.value)}
            placeholder="cliente@email.com"
            className={cn('input', errors.email && 'input-error')}
          />
        </FormField>
      </div>

      <SectionDivider label="Endereço" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="CEP" className="sm:col-span-1">
          <div className="relative">
            <input
              value={form.cep || ''}
              onChange={e => set('cep', maskCEP(e.target.value))}
              onBlur={handleCEPBlur}
              placeholder="88495-000"
              className="input pr-9"
              inputMode="numeric"
            />
            {cepLoading
              ? <Spinner className="absolute right-3 top-1/2 -translate-y-1/2" />
              : <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            }
          </div>
        </FormField>

        <FormField label="Logradouro" className="sm:col-span-2">
          <input
            value={form.logradouro || ''}
            onChange={e => set('logradouro', e.target.value)}
            placeholder="Rua, Avenida..."
            className="input"
          />
        </FormField>

        <FormField label="Número">
          <input
            value={form.numero || ''}
            onChange={e => set('numero', e.target.value)}
            placeholder="123"
            className="input"
          />
        </FormField>

        <FormField label="Complemento">
          <input
            value={form.complemento || ''}
            onChange={e => set('complemento', e.target.value)}
            placeholder="Apto, sala..."
            className="input"
          />
        </FormField>

        <FormField label="Bairro">
          <input
            value={form.bairro || ''}
            onChange={e => set('bairro', e.target.value)}
            placeholder="Centro"
            className="input"
          />
        </FormField>

        <FormField label="Cidade" className="sm:col-span-2">
          <input
            value={form.cidade || ''}
            onChange={e => set('cidade', e.target.value)}
            placeholder="Garopaba"
            className="input"
          />
        </FormField>

        <FormField label="Estado">
          <select
            value={form.estado || 'SC'}
            onChange={e => set('estado', e.target.value)}
            className="select"
          >
            {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
          </select>
        </FormField>
      </div>

      <SectionDivider label="Observações" />

      <FormField label="Observações">
        <textarea
          value={form.observacoes || ''}
          onChange={e => set('observacoes', e.target.value)}
          placeholder="Informações adicionais sobre o cliente..."
          rows={3}
          className="input resize-none"
        />
      </FormField>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-100">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <Spinner />}
          {initialData?.id ? 'Salvar alterações' : 'Cadastrar cliente'}
        </button>
      </div>
    </form>
  )
}
