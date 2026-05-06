import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'

function PlaceholderPage({ title, description, backTo }: {
  title: string; description?: string; backTo?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
        <Construction className="w-8 h-8 text-amber-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-display font-bold text-surface-800">{title}</h2>
        <p className="text-sm text-surface-500 max-w-sm">
          {description || 'Disponível na Fase 4 do desenvolvimento.'}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {backTo && <Link to={backTo} className="btn-ghost btn-sm"><ArrowLeft className="w-3.5 h-3.5"/>Voltar</Link>}
        <Link to="/dashboard" className="btn-primary btn-sm">Ir para o Dashboard</Link>
      </div>
    </div>
  )
}

export const RelatoriosPage    = () => <PlaceholderPage title="Relatórios"    description="Análises, exportações e relatórios avançados — Fase 4" />
export const ConfiguracoesPage = () => <PlaceholderPage title="Configurações" description="Empresa, usuários, permissões e integração fiscal — Fase 4" />
