import { supabase } from '@/lib/supabase'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const relatoriosService = {
  // ── Faturamento por período ────────────────────────────────
  async faturamentoPeriodo(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('valor, tipo, categoria, data_pagamento, forma_pagamento, cliente:clientes(nome)')
      .eq('pago', true)
      .gte('data_pagamento', inicio)
      .lte('data_pagamento', fim)
      .order('data_pagamento')
    if (error) throw error
    return data || []
  },

  // ── OS por período ─────────────────────────────────────────
  async osPeriodo(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select(`
        id, numero, titulo, status, prioridade, valor_total,
        data_abertura, data_conclusao,
        cliente:clientes(nome),
        tecnico:profiles(nome)
      `)
      .gte('data_abertura', inicio + 'T00:00:00')
      .lte('data_abertura', fim + 'T23:59:59')
      .order('data_abertura', { ascending: false })
    if (error) throw error
    return data || []
  },

  // ── Ranking de técnicos ────────────────────────────────────
  async rankingTecnicos(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('tecnico_id, valor_total, status, tecnico:profiles(nome)')
      .eq('status', 'concluido')
      .gte('data_conclusao', inicio + 'T00:00:00')
      .lte('data_conclusao', fim + 'T23:59:59')
    if (error) throw error

    const map: Record<string, { nome: string; total: number; count: number }> = {}
    ;(data || []).forEach((os: any) => {
      const id   = os.tecnico_id || 'sem_tecnico'
      const nome = os.tecnico?.nome || 'Sem técnico'
      if (!map[id]) map[id] = { nome, total: 0, count: 0 }
      map[id].total += os.valor_total || 0
      map[id].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  },

  // ── Ranking de serviços ────────────────────────────────────
  async rankingServicos(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from('os_itens')
      .select(`
        descricao, valor_unit, quantidade, subtotal,
        os:ordens_servico!inner(data_abertura, status)
      `)
      .eq('tipo', 'servico')
      .eq('os.status', 'concluido')
      .gte('os.data_abertura', inicio + 'T00:00:00')
      .lte('os.data_abertura', fim + 'T23:59:59')
    if (error) throw error

    const map: Record<string, { nome: string; total: number; count: number }> = {}
    ;(data || []).forEach((item: any) => {
      const key = item.descricao
      if (!map[key]) map[key] = { nome: key, total: 0, count: 0 }
      map[key].total += item.subtotal || item.valor_unit * item.quantidade || 0
      map[key].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  },

  // ── Inadimplência ─────────────────────────────────────────
  async inadimplencia() {
    const hoje = format(new Date(), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(nome, whatsapp, telefone)')
      .eq('tipo', 'receita')
      .eq('pago', false)
      .lt('data_vencimento', hoje)
      .order('data_vencimento')
    if (error) throw error
    return data || []
  },

  // ── Clientes mais ativos ───────────────────────────────────
  async clientesAtivos(inicio: string, fim: string) {
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('cliente_id, valor_total, cliente:clientes(nome, telefone)')
      .eq('status', 'concluido')
      .gte('data_abertura', inicio + 'T00:00:00')
      .lte('data_abertura', fim + 'T23:59:59')
    if (error) throw error

    const map: Record<string, { nome: string; telefone: string; total: number; count: number }> = {}
    ;(data || []).forEach((os: any) => {
      const id = os.cliente_id
      if (!map[id]) map[id] = { nome: os.cliente?.nome || '—', telefone: os.cliente?.telefone || '', total: 0, count: 0 }
      map[id].total += os.valor_total || 0
      map[id].count += 1
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10)
  },

  // ── Resumo mensal (últimos 6 meses) ───────────────────────
  async resumoMensal() {
    const meses = []
    for (let i = 5; i >= 0; i--) {
      const ref    = subMonths(new Date(), i)
      const inicio = format(startOfMonth(ref), 'yyyy-MM-dd')
      const fim    = format(endOfMonth(ref),   'yyyy-MM-dd')
      const label  = format(ref, 'MMM/yy', { locale: ptBR })

      const [rec, desp, osConc, osAbert] = await Promise.all([
        supabase.from('financeiro_lancamentos').select('valor')
          .eq('tipo', 'receita').eq('pago', true)
          .gte('data_pagamento', inicio).lte('data_pagamento', fim),
        supabase.from('financeiro_lancamentos').select('valor')
          .eq('tipo', 'despesa').eq('pago', true)
          .gte('data_pagamento', inicio).lte('data_pagamento', fim),
        supabase.from('ordens_servico').select('id', { count: 'exact', head: true })
          .eq('status', 'concluido')
          .gte('data_conclusao', inicio + 'T00:00:00').lte('data_conclusao', fim + 'T23:59:59'),
        supabase.from('ordens_servico').select('id', { count: 'exact', head: true })
          .gte('data_abertura', inicio + 'T00:00:00').lte('data_abertura', fim + 'T23:59:59'),
      ])

      const receitas  = (rec.data  || []).reduce((s: number, l: any) => s + l.valor, 0)
      const despesas  = (desp.data || []).reduce((s: number, l: any) => s + l.valor, 0)
      meses.push({
        label, inicio, fim,
        receitas, despesas, lucro: receitas - despesas,
        osConcluidas: osConc.count || 0,
        osAbertas:    osAbert.count || 0,
      })
    }
    return meses
  },
}

// ── PDF builder for reports ────────────────────────────────
export function buildRelatorioPDFHtml(titulo: string, periodo: string, conteudoHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;padding:36px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0c8fe6;padding-bottom:16px;margin-bottom:24px}
  .logo h1{font-size:20px;font-weight:800;color:#0159a0}
  .logo p{font-size:10px;color:#64748b;margin-top:2px}
  .doc-info{text-align:right}
  .doc-title{font-size:16px;font-weight:700;color:#1e293b}
  .doc-period{font-size:11px;color:#64748b;margin-top:3px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  thead th{background:#0159a0;color:white;padding:7px 10px;font-size:10px;text-transform:uppercase;font-weight:600;text-align:left}
  tbody tr:nth-child(even) td{background:#f8fafc}
  tbody td{padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}
  .right{text-align:right}.center{text-align:center}.bold{font-weight:600}
  .section-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:20px 0 8px;font-weight:600}
  .summary-box{background:#f0f9ff;border:1px solid #bae0fd;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap}
  .summary-item .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
  .summary-item .value{font-size:16px;font-weight:700;color:#0159a0;margin-top:2px}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
  .green{color:#16a34a}.red{color:#dc2626}
</style></head><body>
<div class="header">
  <div class="logo"><h1>TecchTI</h1><p>Soluções de Informática — Garopaba, SC</p></div>
  <div class="doc-info">
    <div class="doc-title">${titulo}</div>
    <div class="doc-period">${periodo}</div>
  </div>
</div>
${conteudoHtml}
<div class="footer">
  <div>TecchTI — Soluções de Informática | Garopaba, SC</div>
  <div>Gerado em ${new Date().toLocaleString('pt-BR')}</div>
</div>
</body></html>`
}
