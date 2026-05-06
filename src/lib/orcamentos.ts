import { supabase } from '@/lib/supabase'
import type { Orcamento, OrcamentoItem } from '@/types'

export const orcamentosService = {
  async list(filters?: { status?: string; clienteId?: string }) {
    let q = supabase
      .from('orcamentos')
      .select(`
        *,
        cliente:clientes(id, nome, whatsapp, telefone, email, cidade),
        itens:orcamento_itens(*)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status) q = q.eq('status', filters.status)
    if (filters?.clienteId) q = q.eq('cliente_id', filters.clienteId)

    const { data, error } = await q
    if (error) throw error
    return data as Orcamento[]
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('orcamentos')
      .select(`
        *,
        cliente:clientes(*),
        itens:orcamento_itens(*, servico:servicos(id, nome))
      `)
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Orcamento
  },

  async create(payload: Partial<Orcamento>, itens: Partial<OrcamentoItem>[]) {
    // Gera número do orçamento
    const { data: numData } = await supabase.rpc('gerar_numero_orcamento')
    const numero = numData as string

    const { data: orc, error } = await supabase
      .from('orcamentos')
      .insert({ ...payload, numero })
      .select()
      .single()
    if (error) throw error

    if (itens.length > 0) {
      const { error: itensError } = await supabase
        .from('orcamento_itens')
        .insert(itens.map(i => ({ ...i, orcamento_id: orc.id })))
      if (itensError) throw itensError
    }

    return orc as Orcamento
  },

  async update(id: string, payload: Partial<Orcamento>, itens?: Partial<OrcamentoItem>[]) {
    const { data, error } = await supabase
      .from('orcamentos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    if (itens !== undefined) {
      await supabase.from('orcamento_itens').delete().eq('orcamento_id', id)
      if (itens.length > 0) {
        await supabase.from('orcamento_itens').insert(
          itens.map(i => ({ ...i, orcamento_id: id }))
        )
      }
    }

    return data as Orcamento
  },

  async updateStatus(id: string, status: Orcamento['status']) {
    const { error } = await supabase
      .from('orcamentos')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async delete(id: string) {
    const { error } = await supabase.from('orcamentos').delete().eq('id', id)
    if (error) throw error
  },
}

// ===== CALC ENGINE =====
export type UrgenciaTipo = 'normal' | 'urgente' | 'emergencia'

export interface OrcamentoCalcParams {
  itens: Array<{ quantidade: number; valor_unit: number; tipo?: 'servico' | 'material' }>
  urgencia: UrgenciaTipo
  deslocamento: number
  desconto_pct: number
  desconto_valor: number
}

export interface OrcamentoCalcResult {
  subtotalServicos: number
  subtotalMateriais: number
  taxaUrgencia: number
  deslocamento: number
  subtotalBruto: number
  descontoAplicado: number
  total: number
}

export function calcularOrcamento(p: OrcamentoCalcParams): OrcamentoCalcResult {
  const subtotalServicos = p.itens
    .filter(i => !i.tipo || i.tipo === 'servico')
    .reduce((s, i) => s + i.quantidade * i.valor_unit, 0)

  const subtotalMateriais = p.itens
    .filter(i => i.tipo === 'material')
    .reduce((s, i) => s + i.quantidade * i.valor_unit, 0)

  const pctUrgencia: Record<UrgenciaTipo, number> = {
    normal: 0, urgente: 0.5, emergencia: 1.0
  }
  const taxaUrgencia = subtotalServicos * pctUrgencia[p.urgencia]

  const subtotalBruto = subtotalServicos + subtotalMateriais + taxaUrgencia + p.deslocamento

  const descontoAplicado = p.desconto_valor > 0
    ? Math.min(p.desconto_valor, subtotalBruto)
    : subtotalBruto * (p.desconto_pct / 100)

  const total = Math.max(0, subtotalBruto - descontoAplicado)

  return {
    subtotalServicos, subtotalMateriais,
    taxaUrgencia, deslocamento: p.deslocamento,
    subtotalBruto, descontoAplicado, total
  }
}

// ===== WHATSAPP MESSAGE BUILDER =====
export function buildWhatsAppMessage(orc: Orcamento, calc: OrcamentoCalcResult): string {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const data = orc.data_validade
    ? new Date(orc.data_validade + 'T00:00:00').toLocaleDateString('pt-BR')
    : null

  const linhasItens = (orc.itens || [])
    .map(i => `  • ${i.descricao} (${i.quantidade}x ${fmt(i.valor_unit)})`)
    .join('\n')

  return [
    `Olá${orc.cliente?.nome ? ', ' + orc.cliente.nome.split(' ')[0] : ''}! 👋`,
    ``,
    `Segue o orçamento *${orc.numero}* da *TecchTI*:`,
    ``,
    linhasItens,
    ``,
    calc.taxaUrgencia > 0    ? `  Urgência: ${fmt(calc.taxaUrgencia)}` : null,
    calc.deslocamento > 0    ? `  Deslocamento: ${fmt(calc.deslocamento)}` : null,
    calc.descontoAplicado > 0 ? `  Desconto: -${fmt(calc.descontoAplicado)}` : null,
    ``,
    `*Total: ${fmt(calc.total)}*`,
    data ? `Válido até: ${data}` : null,
    ``,
    orc.observacoes || null,
    ``,
    `Para aceitar ou tirar dúvidas, é só responder aqui. 😊`,
  ].filter(l => l !== null).join('\n')
}
