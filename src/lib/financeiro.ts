import { supabase } from '@/lib/supabase'
import type { FinanceiroLancamento, LancamentoTipo, FormaPagamento } from '@/types'
import { startOfMonth, endOfMonth, format, subMonths } from 'date-fns'

export const financeiroService = {
  // ── LANÇAMENTOS ──────────────────────────────────────────
  async list(filters?: {
    tipo?: LancamentoTipo
    pago?: boolean
    mes?: Date
    clienteId?: string
  }) {
    let q = supabase
      .from('financeiro_lancamentos')
      .select(`
        *,
        cliente:clientes(id, nome),
        os:ordens_servico(id, numero, titulo)
      `)
      .order('data_vencimento', { ascending: true })

    if (filters?.tipo)      q = q.eq('tipo', filters.tipo)
    if (filters?.pago !== undefined) q = q.eq('pago', filters.pago)
    if (filters?.clienteId) q = q.eq('cliente_id', filters.clienteId)
    if (filters?.mes) {
      q = q
        .gte('data_vencimento', format(startOfMonth(filters.mes), 'yyyy-MM-dd'))
        .lte('data_vencimento', format(endOfMonth(filters.mes),   'yyyy-MM-dd'))
    }

    const { data, error } = await q
    if (error) throw error
    return data as FinanceiroLancamento[]
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .select('*, cliente:clientes(id,nome), os:ordens_servico(id,numero,titulo)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as FinanceiroLancamento
  },

  async create(payload: Partial<FinanceiroLancamento>) {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data as FinanceiroLancamento
  },

  async update(id: string, payload: Partial<FinanceiroLancamento>) {
    const { data, error } = await supabase
      .from('financeiro_lancamentos')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as FinanceiroLancamento
  },

  async delete(id: string) {
    const { error } = await supabase.from('financeiro_lancamentos').delete().eq('id', id)
    if (error) throw error
  },

  async marcarPago(id: string, formaPagamento: FormaPagamento, dataPagamento?: string) {
    return financeiroService.update(id, {
      pago: true,
      forma_pagamento: formaPagamento,
      data_pagamento: dataPagamento || format(new Date(), 'yyyy-MM-dd'),
    })
  },

  // ── DASHBOARD SUMMARY ─────────────────────────────────────
  async getDashboardSummary(mes: Date = new Date()) {
    const inicioMes = format(startOfMonth(mes), 'yyyy-MM-dd')
    const fimMes    = format(endOfMonth(mes),   'yyyy-MM-dd')
    const hoje      = format(new Date(), 'yyyy-MM-dd')

    const [receitas, despesas, vencidas, aReceberMes] = await Promise.all([
      // Receitas pagas no mês
      supabase.from('financeiro_lancamentos')
        .select('valor')
        .eq('tipo', 'receita').eq('pago', true)
        .gte('data_pagamento', inicioMes).lte('data_pagamento', fimMes),

      // Despesas pagas no mês
      supabase.from('financeiro_lancamentos')
        .select('valor')
        .eq('tipo', 'despesa').eq('pago', true)
        .gte('data_pagamento', inicioMes).lte('data_pagamento', fimMes),

      // Vencidas não pagas (qualquer tipo)
      supabase.from('financeiro_lancamentos')
        .select('id, tipo, valor, descricao, data_vencimento')
        .eq('pago', false)
        .lt('data_vencimento', hoje)
        .order('data_vencimento'),

      // A receber no mês (receitas não pagas)
      supabase.from('financeiro_lancamentos')
        .select('valor')
        .eq('tipo', 'receita').eq('pago', false)
        .gte('data_vencimento', inicioMes).lte('data_vencimento', fimMes),
    ])

    const totalReceitas  = (receitas.data  || []).reduce((s, l) => s + l.valor, 0)
    const totalDespesas  = (despesas.data  || []).reduce((s, l) => s + l.valor, 0)
    const totalAReceber  = (aReceberMes.data || []).reduce((s, l) => s + l.valor, 0)
    const lucroMes       = totalReceitas - totalDespesas

    return {
      totalReceitas,
      totalDespesas,
      lucroMes,
      totalAReceber,
      vencidas: vencidas.data || [],
    }
  },

  // ── FLUXO DE CAIXA (últimos N meses) ─────────────────────
  async getFluxo(meses = 6) {
    const resultado: { mes: string; receitas: number; despesas: number; lucro: number }[] = []

    for (let i = meses - 1; i >= 0; i--) {
      const ref   = subMonths(new Date(), i)
      const inicio = format(startOfMonth(ref), 'yyyy-MM-dd')
      const fim    = format(endOfMonth(ref),   'yyyy-MM-dd')
      const label  = format(ref, 'MMM/yy')

      const [rec, desp] = await Promise.all([
        supabase.from('financeiro_lancamentos').select('valor')
          .eq('tipo', 'receita').eq('pago', true)
          .gte('data_pagamento', inicio).lte('data_pagamento', fim),
        supabase.from('financeiro_lancamentos').select('valor')
          .eq('tipo', 'despesa').eq('pago', true)
          .gte('data_pagamento', inicio).lte('data_pagamento', fim),
      ])

      const r = (rec.data  || []).reduce((s, l) => s + l.valor, 0)
      const d = (desp.data || []).reduce((s, l) => s + l.valor, 0)
      resultado.push({ mes: label, receitas: r, despesas: d, lucro: r - d })
    }

    return resultado
  },

  // ── CATEGORIAS PADRÃO ─────────────────────────────────────
  CATEGORIAS_RECEITA: [
    'Serviço técnico', 'Venda de produto', 'Visita técnica',
    'Instalação', 'Manutenção', 'Contrato mensal', 'Outros',
  ],
  CATEGORIAS_DESPESA: [
    'Material / peças', 'Combustível', 'Alimentação', 'Ferramentas',
    'Software / licença', 'Aluguel', 'Contador', 'Impostos',
    'Marketing', 'Telefone / internet', 'Outros',
  ],
}
