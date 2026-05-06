import { supabase } from '@/lib/supabase'
import type { Produto, EstoqueMovimento, MovimentoTipo, ProdutoCategoria } from '@/types'

export const estoqueService = {
  // ── PRODUTOS ──────────────────────────────────────────────
  async listProdutos(search?: string) {
    let q = supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (search) q = q.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%,categoria.ilike.%${search}%`)

    const { data, error } = await q
    if (error) throw error
    return data as Produto[]
  },

  async getProdutoById(id: string) {
    const { data, error } = await supabase
      .from('produtos').select('*').eq('id', id).single()
    if (error) throw error
    return data as Produto
  },

  async createProduto(payload: Partial<Produto>) {
    const { data, error } = await supabase
      .from('produtos').insert(payload).select().single()
    if (error) throw error
    return data as Produto
  },

  async updateProduto(id: string, payload: Partial<Produto>) {
    const { data, error } = await supabase
      .from('produtos')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data as Produto
  },

  async deactivateProduto(id: string) {
    const { error } = await supabase
      .from('produtos').update({ ativo: false }).eq('id', id)
    if (error) throw error
  },

  // ── ESTOQUE BAIXO ─────────────────────────────────────────
  async listEstoqueBaixo() {
    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .filter('estoque_atual', 'lte', 'estoque_minimo')
      .order('nome')
    if (error) throw error
    return data as Produto[]
  },

  // ── MOVIMENTAÇÕES ─────────────────────────────────────────
  async listMovimentos(produtoId?: string, limit = 50) {
    let q = supabase
      .from('estoque_movimentos')
      .select('*, produto:produtos(id,nome,unidade)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (produtoId) q = q.eq('produto_id', produtoId)

    const { data, error } = await q
    if (error) throw error
    return data as EstoqueMovimento[]
  },

  async registrarMovimento(payload: {
    produto_id: string
    tipo: MovimentoTipo
    quantidade: number
    valor_unit?: number
    os_id?: string
    observacao?: string
    user_id?: string
  }) {
    // The trigger on the DB updates estoque_atual automatically
    const { data, error } = await supabase
      .from('estoque_movimentos')
      .insert(payload)
      .select('*, produto:produtos(id,nome,unidade)')
      .single()
    if (error) throw error
    return data as EstoqueMovimento
  },

  // ── SUMMARY STATS ─────────────────────────────────────────
  async getSummary() {
    const { data: produtos } = await supabase
      .from('produtos').select('*').eq('ativo', true)

    const lista = (produtos || []) as Produto[]
    const totalItens     = lista.length
    const totalBaixo     = lista.filter(p => p.estoque_atual <= p.estoque_minimo).length
    const valorEstoque   = lista.reduce((s, p) => s + p.estoque_atual * p.preco_custo, 0)
    const valorVenda     = lista.reduce((s, p) => s + p.estoque_atual * p.preco_venda, 0)

    return { totalItens, totalBaixo, valorEstoque, valorVenda }
  },

  // ── CATEGORIAS ────────────────────────────────────────────
  CATEGORIAS: [
    { value: 'camera',     label: '📷 Câmeras'    },
    { value: 'dvr',        label: '📼 DVR / NVR'  },
    { value: 'cabo',       label: '🔌 Cabos'      },
    { value: 'conector',   label: '🔩 Conectores' },
    { value: 'fonte',      label: '⚡ Fontes'     },
    { value: 'computador', label: '💻 Computadores'},
    { value: 'rede',       label: '🌐 Redes'      },
    { value: 'outro',      label: '📦 Outros'     },
  ] as { value: ProdutoCategoria; label: string }[],

  TIPO_MOVIMENTO: [
    { value: 'entrada', label: 'Entrada de compra' },
    { value: 'saida',   label: 'Saída / uso'       },
    { value: 'ajuste',  label: 'Ajuste de inventário' },
  ] as { value: MovimentoTipo; label: string }[],
}
