import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui'
import { Eye, EyeOff, Zap, Wifi, Monitor, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn, user, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  function validate() {
    const e: typeof errors = {}
    if (!email.trim()) e.email = 'E-mail obrigatório'
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'E-mail inválido'
    if (!password) e.password = 'Senha obrigatória'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const result = await signIn(email.trim(), password)
      if (result.error) toast.error(result.error)
      else { toast.success('Bem-vindo!'); navigate('/dashboard', { replace: true }) }
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[46%] bg-surface-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-lg">TecchTI</span>
            <p className="text-xs text-surface-500">Soluções de Informática</p>
          </div>
        </div>
        <div className="relative space-y-6">
          <div>
            <h2 className="text-4xl font-display font-bold text-white leading-tight">
              Gerencie sua empresa <span className="text-brand-400">do jeito certo</span>
            </h2>
            <p className="text-surface-400 mt-3 leading-relaxed max-w-sm">Sistema completo para TI, câmeras, redes e suporte técnico.</p>
          </div>
          <div className="space-y-3">
            {[
              { icon: Monitor, label: 'Ordens de Serviço com assinatura digital' },
              { icon: Camera, label: 'Controle de câmeras e DVRs em estoque' },
              { icon: Wifi, label: 'Gestão de redes e infraestrutura' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-brand-500/20 flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-brand-400" />
                </div>
                <span className="text-sm text-surface-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-surface-600">© {new Date().getFullYear()} TecchTI — Garopaba, Santa Catarina</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8 animate-slide-in-up">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-surface-900">Entrar no sistema</h1>
            <p className="text-sm text-surface-400">Use suas credenciais para acessar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label className="label">E-mail</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
                placeholder="seu@email.com" autoComplete="email" autoFocus
                className={`input ${errors.email ? 'input-error' : ''}`} />
              {errors.email && <p className="field-error">{errors.email}</p>}
            </div>

            <div className="space-y-1">
              <label className="label">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                  placeholder="••••••••" autoComplete="current-password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`} />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="field-error">{errors.password}</p>}
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full btn-lg mt-2">
              {submitting ? <><Spinner />Entrando...</> : 'Entrar'}
            </button>
          </form>

          <div className="p-4 rounded-2xl bg-surface-50 border border-surface-100">
            <p className="text-xs font-semibold text-surface-600 mb-1">Primeiros passos:</p>
            <p className="text-xs text-surface-400 leading-relaxed">
              Crie o primeiro usuário admin no painel Supabase (Authentication → Users) e cadastre o perfil na tabela <code className="font-mono bg-surface-200 px-1 rounded">profiles</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
