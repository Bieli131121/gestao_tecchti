import { useEffect, useState, useCallback } from 'react'
import { relatoriosService, buildRelatorioPDFHtml } from '@/lib/relatorios'
import { formatCurrency, formatDate, whatsappLink } from '@/lib/utils'
import { LoadingPage, ErrorState, StatCard } from '@/components/ui'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileBarChart2, TrendingUp, TrendingDown, Users,
  ClipboardList, Download, RefreshCw, MessageCircle,
  Star, DollarSign, Wrench
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── mini bar chart ─────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0
  return (
    <div className="flex-1 bg-surface-100 rounded-full h-2 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  )
}

// ── period selector ────────────────────────────────────────
function PeriodSelector({ inicio, fim, onChange }: {
  inicio: string; fim: string
  onChange: (inicio: string, fim: string) => void
}) {
  const presets = [
    { label: 'Este mês',       getRange: () => ({ i: format(startOfMonth(new Date()), 'yyyy-MM-dd'), f: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
    { label: 'Mês passado',    getRange: () => { const r = subMonths(new Date(), 1); return { i: format(startOfMonth(r), 'yyyy-MM-dd'), f: format(endOfMonth(r), 'yyyy-MM-dd') } } },
    { label: 'Últimos 3 meses', getRange: () => ({ i: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'), f: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
    { label: 'Este ano',       getRange: () => ({ i: `${new Date().getFullYear()}-01-01`, f: `${new Date().getFullYear()}-12-31` }) },
  ]

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {presets.map(p => {
        const range = p.getRange()
        const active = range.i === inicio && range.f === fim
        return (
          <button key={p.label} onClick={() => onChange(range.i, range.f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-white border border-surface-200 text-surface-500 hover:bg-surface-50'}`}>
            {p.label}
          </button>
        )
      })}
      <div className="flex items-center gap-1 ml-1">
        <input type="date" className="input text-xs py-1.5 w-36" value={inicio}
          onChange={e => onChange(e.target.value, fim)} />
        <span className="text-surface-400 text-xs">até</span>
        <input type="date" className="input text-xs py-1.5 w-36" value={fim}
          onChange={e => onChange(inicio, e.target.value)} />
      </div>
    </div>
  )
}

// ── Resumo Mensal Chart ────────────────────────────────────
function ResumoMensalChart({ data }: { data: any[] }) {
  if (!data.length) return null
  const maxVal = Math.max(...data.flatMap(d => [d.receitas, d.despesas]), 1)
  const H = 140

  return (
    <div className="card p-5">
      <h3 className="font-display font-semibold text-sm text-surface-700 mb-5">Receitas vs Despesas — Últimos 6 meses</h3>
      <div className="flex items-end gap-3 justify-between" style={{ height: H + 48 }}>
        {data.map((d, i) => {
          const hR = Math.max(4, (d.receitas / maxVal) * H)
          const hD = Math.max(4, (d.despesas / maxVal) * H)
          return (
            <div key={i} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 group">
              {/* tooltip */}
              <div className="opacity-0 group-hover:opacity-100 absolute bg-surface-800 text-white text-xs rounded-lg px-2 py-1 pointer-events-none -translate-y-2 transition-opacity z-10 whitespace-nowrap">
                {formatCurrency(d.receitas)} / {formatCurrency(d.despesas)}
              </div>
              <div className="relative flex items-end gap-0.5 w-full justify-center" style={{ height: H }}>
                <div title={`Receitas: ${formatCurrency(d.receitas)}`}
                  className="rounded-t-md bg-emerald-400 hover:bg-emerald-500 transition-colors cursor-default"
                  style={{ height: hR, width: '44%' }} />
                <div title={`Despesas: ${formatCurrency(d.despesas)}`}
                  className="rounded-t-md bg-red-400 hover:bg-red-500 transition-colors cursor-default"
                  style={{ height: hD, width: '44%' }} />
              </div>
              <span className="text-[10px] text-surface-400 truncate w-full text-center capitalize">{d.label}</span>
              <span className={`text-[10px] font-bold ${d.lucro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {d.lucro >= 0 ? '+' : ''}{formatCurrency(d.lucro)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-1 justify-center">
        <span className="flex items-center gap-1.5 text-xs text-surface-500"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block"/>Receitas</span>
        <span className="flex items-center gap-1.5 text-xs text-surface-500"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block"/>Despesas</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export function RelatoriosPage() {
  const hoje     = new Date()
  const [inicio, setInicio] = useState(format(startOfMonth(hoje), 'yyyy-MM-dd'))
  const [fim, setFim]       = useState(format(endOfMonth(hoje),   'yyyy-MM-dd'))

  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const [faturamento, setFaturamento] = useState<any[]>([])
  const [osData, setOsData]           = useState<any[]>([])
  const [tecnicos, setTecnicos]       = useState<any[]>([])
  const [servicos, setServicos]       = useState<any[]>([])
  const [clientes, setClientes]       = useState<any[]>([])
  const [inadimplencia, setInadimplencia] = useState<any[]>([])
  const [resumoMensal, setResumoMensal]   = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [fat, os, tec, srv, cli, inad, resumo] = await Promise.all([
        relatoriosService.faturamentoPeriodo(inicio, fim),
        relatoriosService.osPeriodo(inicio, fim),
        relatoriosService.rankingTecnicos(inicio, fim),
        relatoriosService.rankingServicos(inicio, fim),
        relatoriosService.clientesAtivos(inicio, fim),
        relatoriosService.inadimplencia(),
        relatoriosService.resumoMensal(),
      ])
      setFaturamento(fat); setOsData(os); setTecnicos(tec)
      setServicos(srv); setClientes(cli); setInadimplencia(inad)
      setResumoMensal(resumo)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [inicio, fim])

  useEffect(() => { load() }, [load])

  // ── computed ─────────────────────────────────────────────
  const totalReceitas  = faturamento.filter(l => l.tipo === 'receita').reduce((s: number, l: any) => s + l.valor, 0)
  const totalDespesas  = faturamento.filter(l => l.tipo === 'despesa').reduce((s: number, l: any) => s + l.valor, 0)
  const lucro          = totalReceitas - totalDespesas
  const osConcluidas   = osData.filter(o => o.status === 'concluido').length
  const valorOS        = osData.filter(o => o.status === 'concluido').reduce((s: number, o: any) => s + (o.valor_total || 0), 0)
  const totalInadimpl  = inadimplencia.reduce((s: number, l: any) => s + l.valor, 0)
  const maxTec         = tecnicos[0]?.total || 1
  const maxSrv         = servicos[0]?.total || 1
  const maxCli         = clientes[0]?.total || 1
  const periodoLabel   = `${formatDate(inicio)} a ${formatDate(fim)}`

  // ── print helpers ─────────────────────────────────────────
  function printReport(titulo: string, html: string) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error('Permita pop-ups para exportar'); return }
    win.document.write(buildRelatorioPDFHtml(titulo, periodoLabel, html))
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  function exportFaturamento() {
    const rows = faturamento.map((l: any) => `
      <tr>
        <td>${formatDate(l.data_pagamento)}</td>
        <td>${l.descricao}</td>
        <td>${l.categoria || '—'}</td>
        <td>${l.cliente?.nome || l.fornecedor || '—'}</td>
        <td class="${l.tipo === 'receita' ? 'green right' : 'red right'} bold">
          ${l.tipo === 'receita' ? '+' : '-'}${formatCurrency(l.valor)}
        </td>
      </tr>`).join('')
    const html = `
      <div class="summary-box">
        <div class="summary-item"><div class="label">Receitas</div><div class="value green">${formatCurrency(totalReceitas)}</div></div>
        <div class="summary-item"><div class="label">Despesas</div><div class="value red">${formatCurrency(totalDespesas)}</div></div>
        <div class="summary-item"><div class="label">Lucro</div><div class="value ${lucro >= 0 ? 'green' : 'red'}">${formatCurrency(lucro)}</div></div>
      </div>
      <div class="section-title">Lançamentos do período</div>
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Cliente/Fornecedor</th><th class="right">Valor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    printReport('Relatório de Faturamento', html)
  }

  function exportOS() {
    const rows = osData.map((o: any) => `
      <tr>
        <td class="bold">#${o.numero}</td>
        <td>${o.titulo}</td>
        <td>${o.cliente?.nome || '—'}</td>
        <td>${o.tecnico?.nome || '—'}</td>
        <td>${o.status}</td>
        <td class="right bold">${formatCurrency(o.valor_total)}</td>
        <td>${formatDate(o.data_abertura)}</td>
      </tr>`).join('')
    const html = `
      <div class="summary-box">
        <div class="summary-item"><div class="label">Total OS</div><div class="value">${osData.length}</div></div>
        <div class="summary-item"><div class="label">Concluídas</div><div class="value green">${osConcluidas}</div></div>
        <div class="summary-item"><div class="label">Faturado em OS</div><div class="value">${formatCurrency(valorOS)}</div></div>
      </div>
      <div class="section-title">Ordens de Serviço do período</div>
      <table>
        <thead><tr><th>Nº</th><th>Título</th><th>Cliente</th><th>Técnico</th><th>Status</th><th class="right">Valor</th><th>Abertura</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    printReport('Relatório de Ordens de Serviço', html)
  }

  function exportInadimplencia() {
    const rows = inadimplencia.map((l: any) => `
      <tr>
        <td>${l.cliente?.nome || '—'}</td>
        <td>${l.descricao}</td>
        <td>${formatDate(l.data_vencimento)}</td>
        <td class="right red bold">${formatCurrency(l.valor)}</td>
      </tr>`).join('')
    const html = `
      <div class="summary-box">
        <div class="summary-item"><div class="label">Total em aberto</div><div class="value red">${formatCurrency(totalInadimpl)}</div></div>
        <div class="summary-item"><div class="label">Clientes com atraso</div><div class="value">${inadimplencia.length}</div></div>
      </div>
      <div class="section-title">Títulos vencidos e não pagos</div>
      <table>
        <thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th class="right">Valor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    printReport('Relatório de Inadimplência', html)
  }

  if (loading) return <LoadingPage />
  if (error)   return <ErrorState message={error} onRetry={load} />

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Relatórios</h2>
          <p className="page-subtitle">Análises e exportações</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* Period selector */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-surface-500 mb-3 uppercase tracking-wider">Período de análise</p>
        <PeriodSelector inicio={inicio} fim={fim} onChange={(i, f) => { setInicio(i); setFim(f) }} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Receitas no período"  value={formatCurrency(totalReceitas)} icon={TrendingUp}    accent="green"  />
        <StatCard label="Despesas no período"  value={formatCurrency(totalDespesas)} icon={TrendingDown}  accent="red"    />
        <StatCard label="Lucro líquido"         value={formatCurrency(lucro)}         icon={DollarSign}   accent={lucro >= 0 ? 'green' : 'red'} />
        <StatCard label="OS concluídas"         value={osConcluidas}                  icon={ClipboardList} accent="blue"   />
      </div>

      {/* Chart + Export buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ResumoMensalChart data={resumoMensal} />
        </div>

        {/* Export panel */}
        <div className="card p-5 space-y-3">
          <h3 className="font-display font-semibold text-sm text-surface-700 flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-500" /> Exportar PDF
          </h3>
          <p className="text-xs text-surface-400">Gera PDF para impressão ou envio ao cliente</p>

          {[
            { label: 'Faturamento do período',     icon: DollarSign,    action: exportFaturamento, color: 'text-emerald-600' },
            { label: 'Ordens de Serviço',          icon: ClipboardList, action: exportOS,           color: 'text-brand-600'   },
            { label: 'Inadimplência',              icon: TrendingDown,  action: exportInadimplencia, color: 'text-red-500'    },
          ].map(({ label, icon: Icon, action, color }) => (
            <button key={label} onClick={action}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-200 hover:bg-surface-50 hover:border-surface-300 transition-all text-sm text-left">
              <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
              <span className="font-medium text-surface-700">{label}</span>
              <Download className="w-3.5 h-3.5 text-surface-300 ml-auto" />
            </button>
          ))}
        </div>
      </div>

      {/* Rankings row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ranking técnicos */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-500" /> Ranking de Técnicos
          </h3>
          {tecnicos.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">Nenhum dado no período</p>
          ) : (
            <div className="space-y-3">
              {tecnicos.slice(0, 6).map((t, i) => (
                <div key={t.nome} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-surface-700">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500'}`}>{i + 1}</span>
                      {t.nome}
                    </span>
                    <span className="font-semibold text-surface-600">{t.count} OS · {formatCurrency(t.total)}</span>
                  </div>
                  <MiniBar value={t.total} max={maxTec} color="#3b82f6" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking serviços */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-brand-500" /> Top Serviços
          </h3>
          {servicos.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">Nenhum dado no período</p>
          ) : (
            <div className="space-y-3">
              {servicos.slice(0, 6).map((s, i) => (
                <div key={s.nome} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-surface-700">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500'}`}>{i + 1}</span>
                      <span className="truncate max-w-[120px]">{s.nome}</span>
                    </span>
                    <span className="font-semibold text-surface-600 whitespace-nowrap">{s.count}x · {formatCurrency(s.total)}</span>
                  </div>
                  <MiniBar value={s.total} max={maxSrv} color="#10b981" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ranking clientes */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-sm text-surface-700 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" /> Melhores Clientes
          </h3>
          {clientes.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">Nenhum dado no período</p>
          ) : (
            <div className="space-y-3">
              {clientes.slice(0, 6).map((c, i) => (
                <div key={c.nome} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-surface-700">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-surface-100 text-surface-500'}`}>{i + 1}</span>
                      <span className="truncate max-w-[110px]">{c.nome}</span>
                    </span>
                    <span className="font-semibold text-surface-600 whitespace-nowrap">{c.count} OS · {formatCurrency(c.total)}</span>
                  </div>
                  <MiniBar value={c.total} max={maxCli} color="#f59e0b" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inadimplência */}
      {inadimplencia.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-50">
            <h3 className="font-display font-semibold text-sm text-surface-700 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              Inadimplência — {formatCurrency(totalInadimpl)} em aberto
            </h3>
            <button onClick={exportInadimplencia} className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Descrição</th>
                  <th>Vencimento</th>
                  <th className="text-right">Valor</th>
                  <th className="w-24 text-right">WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {inadimplencia.map((l: any) => (
                  <tr key={l.id}>
                    <td className="font-medium text-surface-800">{l.cliente?.nome || '—'}</td>
                    <td className="text-surface-600 text-sm">{l.descricao}</td>
                    <td><span className="text-xs font-medium text-red-600">{formatDate(l.data_vencimento)}</span></td>
                    <td className="text-right font-bold text-red-600">{formatCurrency(l.valor)}</td>
                    <td className="text-right">
                      {l.cliente?.whatsapp && (
                        <a href={whatsappLink(l.cliente.whatsapp,
                          `Olá ${l.cliente.nome.split(' ')[0]}! Passando para informar que temos um título em aberto no valor de ${formatCurrency(l.valor)} vencido em ${formatDate(l.data_vencimento)}. Podemos acertar? 😊`
                        )} target="_blank" rel="noopener noreferrer"
                          className="btn-icon btn-ghost btn-sm text-emerald-600 hover:bg-emerald-50">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OS table */}
      {osData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-50">
            <h3 className="font-display font-semibold text-sm text-surface-700">
              Ordens de Serviço do período — {osData.length} OS · {formatCurrency(valorOS)}
            </h3>
            <button onClick={exportOS} className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Nº</th><th>Título</th>
                  <th className="hidden md:table-cell">Cliente</th>
                  <th className="hidden lg:table-cell">Técnico</th>
                  <th>Status</th>
                  <th className="text-right">Valor</th>
                  <th className="hidden md:table-cell">Abertura</th>
                </tr>
              </thead>
              <tbody>
                {osData.slice(0, 20).map((o: any) => (
                  <tr key={o.id}>
                    <td><span className="font-mono font-bold text-brand-600 text-xs">#{o.numero}</span></td>
                    <td className="font-medium text-surface-800 text-sm max-w-[180px] truncate">{o.titulo}</td>
                    <td className="hidden md:table-cell text-surface-600 text-xs">{o.cliente?.nome || '—'}</td>
                    <td className="hidden lg:table-cell text-surface-500 text-xs">{o.tecnico?.nome || '—'}</td>
                    <td>
                      <span className={`badge text-[10px] ${
                        o.status === 'concluido' ? 'badge-green' :
                        o.status === 'em_andamento' ? 'badge-blue' :
                        o.status === 'cancelado' ? 'badge-red' : 'badge-yellow'
                      }`}>{o.status.replace('_', ' ')}</span>
                    </td>
                    <td className="text-right font-semibold text-surface-700">{formatCurrency(o.valor_total)}</td>
                    <td className="hidden md:table-cell text-xs text-surface-400">{formatDate(o.data_abertura)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {osData.length > 20 && (
            <div className="px-5 py-3 border-t border-surface-50 text-xs text-surface-400">
              Mostrando 20 de {osData.length} OS. Exporte o PDF para ver todas.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
