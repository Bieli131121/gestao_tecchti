import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, formatRelative, OS_STATUS_BADGE, OS_STATUS_LABEL } from '@/lib/utils'
import { StatCard, LoadingPage } from '@/components/ui'
import {
  DollarSign, Users, ClipboardList, FileText,
  Package, TrendingUp, AlertTriangle, Clock,
  ArrowRight, CheckCircle2, XCircle, PauseCircle
} from 'lucide-react'

interface Stats {
  faturamentoMes: number
  lucroMes: number
  totalClientes: number
  osAbertas: number
  osEmAndamento: number
  osConcluidas: number
  orcamentosPendentes: number
  estoqueBaixo: number
  aReceberMes: number
  despesasMes: number
}

interface RecentOS {
  id: string; numero: string; titulo: string; status: string
  data_abertura: string; valor_total: number
  cliente: { nome: string }; tecnico?: { nome: string }
}

interface RecentOrcamento {
  id: string; numero: string; status: string; total: number
  created_at: string; cliente: { nome: string }
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const W = 80; const H = 28
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - (v / max) * H}`)
  return (
    <svg width={W} height={H} className="opacity-60">
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const [stats, setStats]         = useState<Stats | null>(null)
  const [recentOS, setRecentOS]   = useState<RecentOS[]>([])
  const [recentOrc, setRecentOrc] = useState<RecentOrcamento[]>([])
  const [sparkRec, setSparkRec]   = useState<number[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const now         = new Date()
      const startMonth  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endMonth    = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const startMonthD = startMonth.slice(0, 10)
      const endMonthD   = endMonth.slice(0, 10)

      const [
        { count: totalClientes },
        { count: osAbertas },
        { count: osEmAndamento },
        { count: osConcluidas },
        { count: orcamentosPendentes },
        { count: estoqueBaixo },
        { data: receitasData },
        { data: despesasData },
        { data: aReceberData },
        { data: osRecentes },
        { data: orcRecentes },
      ] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('ativo', true),
        supabase.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status', 'aberto'),
        supabase.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
        supabase.from('ordens_servico').select('*', { count: 'exact', head: true }).eq('status', 'concluido').gte('data_conclusao', startMonth),
        supabase.from('orcamentos').select('*', { count: 'exact', head: true }).in('status', ['rascunho', 'enviado']),
        supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('ativo', true).filter('estoque_atual', 'lte', 'estoque_minimo'),
        supabase.from('financeiro_lancamentos').select('valor').eq('tipo', 'receita').eq('pago', true).gte('data_pagamento', startMonthD).lte('data_pagamento', endMonthD),
        supabase.from('financeiro_lancamentos').select('valor').eq('tipo', 'despesa').eq('pago', true).gte('data_pagamento', startMonthD).lte('data_pagamento', endMonthD),
        supabase.from('financeiro_lancamentos').select('valor').eq('tipo', 'receita').eq('pago', false).gte('data_vencimento', startMonthD).lte('data_vencimento', endMonthD),
        supabase.from('ordens_servico').select('id, numero, titulo, status, data_abertura, valor_total, cliente:clientes(nome), tecnico:profiles(nome)').in('status', ['aberto', 'em_andamento']).order('data_abertura', { ascending: false }).limit(6),
        supabase.from('orcamentos').select('id, numero, status, total, created_at, cliente:clientes(nome)').order('created_at', { ascending: false }).limit(5),
      ])

      const faturamentoMes = (receitasData || []).reduce((s, l) => s + l.valor, 0)
      const despesasMes    = (despesasData  || []).reduce((s, l) => s + l.valor, 0)
      const aReceberMes    = (aReceberData  || []).reduce((s, l) => s + l.valor, 0)

      setStats({
        faturamentoMes, lucroMes: faturamentoMes - despesasMes,
        totalClientes: totalClientes ?? 0,
        osAbertas: osAbertas ?? 0, osEmAndamento: osEmAndamento ?? 0,
        osConcluidas: osConcluidas ?? 0,
        orcamentosPendentes: orcamentosPendentes ?? 0,
        estoqueBaixo: estoqueBaixo ?? 0,
        aReceberMes, despesasMes,
      })
      setRecentOS((osRecentes || []).map((o: any) => ({ ...o, cliente: Array.isArray(o.cliente) ? o.cliente[0] : o.cliente, tecnico: Array.isArray(o.tecnico) ? o.tecnico[0] : o.tecnico })) as RecentOS[])
      setRecentOrc((orcRecentes || []).map((o: any) => ({ ...o, cliente: Array.isArray(o.cliente) ? o.cliente[0] : o.cliente })) as unknown as RecentOrcamento[])

      // Sparkline: receitas dos últimos 7 dias
      const spark: number[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const ds = d.toISOString().slice(0, 10)
        const { data: dl } = await supabase.from('financeiro_lancamentos').select('valor')
          .eq('tipo', 'receita').eq('pago', true).eq('data_pagamento', ds)
        spark.push((dl || []).reduce((s, l) => s + l.valor, 0))
      }
      setSparkRec(spark)
    } finally { setLoading(false) }
  }

  if (loading) return <LoadingPage />

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = user?.nome?.split(' ')[0] || ''

  const STATUS_ICON: Record<string, React.ReactNode> = {
    aberto:       <Clock className="w-3.5 h-3.5 text-amber-500" />,
    em_andamento: <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />,
    pausado:      <PauseCircle className="w-3.5 h-3.5 text-surface-400" />,
    concluido:    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    cancelado:    <XCircle className="w-3.5 h-3.5 text-red-400" />,
  }

  return (
    <div className="space-y-6 animate-slide-in-up">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-display font-bold text-surface-900">
            {greeting}, {firstName}! 👋
          </h2>
          <p className="text-sm text-surface-400 mt-1">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button onClick={loadAll} className="btn-secondary btn-sm text-xs">↻ Atualizar</button>
      </div>

      {/* Alert banners */}
      {((stats?.estoqueBaixo ?? 0) > 0 || (stats?.osAbertas ?? 0) > 3) && (
        <div className="flex flex-wrap gap-2">
          {(stats?.estoqueBaixo ?? 0) > 0 && (
            <Link to="/estoque" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {stats!.estoqueBaixo} produto{stats!.estoqueBaixo > 1 ? 's' : ''} com estoque baixo
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
          {(stats?.osAbertas ?? 0) > 3 && (
            <Link to="/os" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors">
              <Clock className="w-3.5 h-3.5" />
              {stats!.osAbertas} OS aguardando atendimento
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Faturamento com sparkline */}
        <div className="kpi-card">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-500" />
            </div>
            {sparkRec.length > 0 && <MiniSparkline data={sparkRec} color="#10b981" />}
          </div>
          <div className="kpi-value">{formatCurrency(stats?.faturamentoMes)}</div>
          <div className="flex justify-between items-center">
            <span className="kpi-label">Faturamento do mês</span>
            {(stats?.lucroMes ?? 0) >= 0
              ? <span className="text-xs font-semibold text-emerald-600">Lucro {formatCurrency(stats?.lucroMes)}</span>
              : <span className="text-xs font-semibold text-red-500">Prejuízo {formatCurrency(Math.abs(stats?.lucroMes ?? 0))}</span>
            }
          </div>
        </div>

        <StatCard label="Clientes ativos"    value={stats?.totalClientes ?? 0}           icon={Users}         accent="blue"   />
        <StatCard label="A receber no mês"   value={formatCurrency(stats?.aReceberMes)}   icon={TrendingUp}    accent="yellow" />
        <StatCard label="OS concluídas/mês"  value={stats?.osConcluidas ?? 0}            icon={ClipboardList} accent="purple" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="OS abertas"          value={stats?.osAbertas ?? 0}              icon={Clock}      accent="yellow" />
        <StatCard label="Em andamento"        value={stats?.osEmAndamento ?? 0}          icon={TrendingUp} accent="blue"   />
        <StatCard label="Orçamentos pendentes" value={stats?.orcamentosPendentes ?? 0}   icon={FileText}   accent="purple" />
        <StatCard label="Estoque baixo"       value={stats?.estoqueBaixo ?? 0}           icon={Package}    accent="red"    />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent OS */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-50">
            <h3 className="font-display font-semibold text-surface-800 text-sm">OS em aberto</h3>
            <Link to="/os" className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentOS.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-sm text-surface-400">Nenhuma OS em aberto 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-50">
              {recentOS.map(os => (
                <Link key={os.id} to={`/os/${os.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors group">
                  <div className="flex-shrink-0">{STATUS_ICON[os.status]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-brand-600">#{os.numero}</span>
                      <span className={`${OS_STATUS_BADGE[os.status]} text-[10px]`}>{OS_STATUS_LABEL[os.status]}</span>
                    </div>
                    <p className="text-sm font-medium text-surface-700 truncate mt-0.5">{os.titulo}</p>
                    <p className="text-xs text-surface-400">
                      {os.cliente?.nome}
                      {os.tecnico?.nome && ` · ${os.tecnico.nome}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {os.valor_total > 0 && <p className="text-xs font-semibold text-surface-600">{formatCurrency(os.valor_total)}</p>}
                    <p className="text-xs text-surface-400">{formatRelative(os.data_abertura)}</p>
                    <ArrowRight className="w-3.5 h-3.5 text-surface-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column: quick actions + recent orcamentos */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="card p-5 space-y-2">
            <h3 className="font-display font-semibold text-surface-800 text-sm mb-3">Ações rápidas</h3>
            {[
              { label: 'Nova Ordem de Serviço', to: '/os/nova',           cls: 'bg-brand-600 hover:bg-brand-700 text-white' },
              { label: 'Novo Orçamento',        to: '/orcamentos/novo',   cls: 'bg-surface-100 hover:bg-surface-200 text-surface-700' },
              { label: 'Cadastrar Cliente',     to: '/clientes/novo',     cls: 'bg-surface-100 hover:bg-surface-200 text-surface-700' },
              { label: 'Lançar Receita',        to: '/financeiro',        cls: 'bg-surface-100 hover:bg-surface-200 text-surface-700' },
              { label: 'Entrada de Estoque',    to: '/estoque',           cls: 'bg-surface-100 hover:bg-surface-200 text-surface-700' },
            ].map(({ label, to, cls }) => (
              <Link key={to} to={to}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${cls}`}>
                {label}
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </Link>
            ))}
          </div>

          {/* Recent orcamentos */}
          {recentOrc.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-50">
                <h3 className="font-display font-semibold text-surface-800 text-xs uppercase tracking-wider">Orçamentos recentes</h3>
                <Link to="/orcamentos" className="text-xs text-brand-600">Ver todos</Link>
              </div>
              <div className="divide-y divide-surface-50">
                {recentOrc.map(o => (
                  <Link key={o.id} to={`/orcamentos/${o.id}`}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-50 transition-colors">
                    <div>
                      <span className="text-xs font-mono font-bold text-brand-600">#{o.numero}</span>
                      <p className="text-xs text-surface-600 truncate max-w-[120px]">{o.cliente?.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-surface-700">{formatCurrency(o.total)}</p>
                      <p className="text-[10px] text-surface-400">{formatDate(o.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
