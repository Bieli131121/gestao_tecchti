// ===== AUTH / USERS =====
export type UserRole = 'admin' | 'tecnico' | 'financeiro' | 'vendedor'

export interface Profile {
  id: string
  nome: string
  email: string
  telefone?: string
  role: UserRole
  ativo: boolean
  avatar_url?: string
  created_at: string
  updated_at: string
}

// ===== CLIENTS =====
export type ClienteTipo = 'pf' | 'pj'

export interface Cliente {
  id: string
  tipo: ClienteTipo
  nome: string
  cpf_cnpj?: string
  telefone?: string
  whatsapp?: string
  email?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  inscricao_estadual?: string
  inscricao_municipal?: string
  observacoes?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ClienteFormData = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>

// ===== SERVICES =====
export interface CategoriaServico {
  id: string
  nome: string
  icone?: string
  cor?: string
  ativo: boolean
}

export interface Servico {
  id: string
  categoria_id?: string
  categoria?: CategoriaServico
  nome: string
  descricao?: string
  valor_base: number
  tempo_medio_minutos?: number
  custo_estimado: number
  margem_lucro_pct: number
  taxa_urgencia_pct: number
  taxa_deslocamento: number
  ativo: boolean
  created_at: string
}

// ===== PRODUCTS / STOCK =====
export type ProdutoCategoria = 'camera' | 'dvr' | 'cabo' | 'conector' | 'fonte' | 'computador' | 'rede' | 'outro'
export type MovimentoTipo = 'entrada' | 'saida' | 'ajuste' | 'uso_os'

export interface Produto {
  id: string
  nome: string
  descricao?: string
  categoria?: ProdutoCategoria
  codigo?: string
  unidade: string
  preco_custo: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  localizacao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EstoqueMovimento {
  id: string
  produto_id: string
  produto?: Produto
  tipo: MovimentoTipo
  quantidade: number
  valor_unit?: number
  os_id?: string
  observacao?: string
  user_id?: string
  created_at: string
}

// ===== QUOTES =====
export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'expirado'
export type UrgenciaTipo = 'normal' | 'urgente' | 'emergencia'

export interface OrcamentoItem {
  id: string
  orcamento_id: string
  servico_id?: string
  servico?: Servico
  descricao: string
  quantidade: number
  valor_unit: number
  subtotal: number
}

export interface Orcamento {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente
  criado_por?: string
  status: OrcamentoStatus
  data_validade?: string
  subtotal: number
  desconto_pct: number
  desconto_valor: number
  taxa_deslocamento: number
  taxa_urgencia: number
  total: number
  observacoes?: string
  pdf_url?: string
  enviado_whatsapp: boolean
  itens?: OrcamentoItem[]
  created_at: string
  updated_at: string
}

// ===== WORK ORDERS =====
export type OSStatus = 'aberto' | 'em_andamento' | 'concluido' | 'cancelado' | 'pausado'
export type OSPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente'
export type OSItemTipo = 'servico' | 'material'
export type FotoTipo = 'antes' | 'depois' | 'geral'

export interface OSItem {
  id: string
  os_id: string
  tipo: OSItemTipo
  servico_id?: string
  servico?: Servico
  produto_id?: string
  produto?: Produto
  descricao: string
  quantidade: number
  valor_unit: number
  subtotal: number
}

export interface OSChecklist {
  id: string
  os_id: string
  item: string
  concluido: boolean
  ordem: number
}

export interface OSFoto {
  id: string
  os_id: string
  tipo: FotoTipo
  url: string
  legenda?: string
  created_at: string
}

export interface OrdemServico {
  id: string
  numero: string
  cliente_id: string
  cliente?: Cliente
  tecnico_id?: string
  tecnico?: Profile
  orcamento_id?: string
  status: OSStatus
  prioridade: OSPrioridade
  titulo: string
  descricao?: string
  data_abertura: string
  data_previsao?: string
  data_conclusao?: string
  valor_servico: number
  valor_materiais: number
  desconto: number
  valor_total: number
  forma_pagamento?: string
  pago: boolean
  assinatura_url?: string
  assinado_em?: string
  observacoes?: string
  itens?: OSItem[]
  checklist?: OSChecklist[]
  fotos?: OSFoto[]
  created_at: string
  updated_at: string
}

// ===== FINANCIAL =====
export type LancamentoTipo = 'receita' | 'despesa'
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'transferencia' | 'boleto' | 'cheque'

export interface FinanceiroLancamento {
  id: string
  tipo: LancamentoTipo
  categoria?: string
  descricao: string
  valor: number
  data_vencimento: string
  data_pagamento?: string
  pago: boolean
  forma_pagamento?: FormaPagamento
  os_id?: string
  os?: OrdemServico
  cliente_id?: string
  cliente?: Cliente
  fornecedor?: string
  recorrente: boolean
  parcela_atual: number
  total_parcelas: number
  observacoes?: string
  created_at: string
}

// ===== COMPANY CONFIG =====
export interface EmpresaConfig {
  id: string
  razao_social?: string
  nome_fantasia?: string
  cnpj?: string
  inscricao_municipal?: string
  regime_tributario?: string
  endereco?: Record<string, string>
  contato?: Record<string, string>
  logo_url?: string
  proximo_num_os: number
  proximo_num_orcamento: number
  updated_at: string
}

// ===== UI HELPERS =====
export interface SelectOption {
  value: string
  label: string
}

export interface PaginationState {
  page: number
  pageSize: number
  total: number
}

export interface FilterState {
  search: string
  status?: string
  dateFrom?: string
  dateTo?: string
}
