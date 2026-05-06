import { type ClassValue, clsx } from 'clsx'
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ===== CSS CLASS MERGING =====
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// ===== CURRENCY =====
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

// ===== DATES =====
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '—'
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatRelative(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '—'
    return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
  } catch {
    return '—'
  }
}

// ===== MASKS =====
export function maskCPF(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14)
}

export function maskCNPJ(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    .slice(0, 18)
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    .slice(0, 15)
}

export function maskCEP(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{5})(\d{1,3})$/, '$1-$2')
    .slice(0, 9)
}

// ===== DOCUMENT VALIDATION =====
export function validateCPF(cpf: string): boolean {
  const stripped = cpf.replace(/\D/g, '')
  if (stripped.length !== 11) return false
  if (/^(\d)\1+$/.test(stripped)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(stripped[i]) * (10 - i)
  let rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  if (rest !== parseInt(stripped[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(stripped[i]) * (11 - i)
  rest = (sum * 10) % 11
  if (rest === 10 || rest === 11) rest = 0
  return rest === parseInt(stripped[10])
}

export function validateCNPJ(cnpj: string): boolean {
  const stripped = cnpj.replace(/\D/g, '')
  if (stripped.length !== 14) return false
  if (/^(\d)\1+$/.test(stripped)) return false
  const calc = (str: string, weights: number[]) =>
    weights.reduce((sum, w, i) => sum + parseInt(str[i]) * w, 0)
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const r1 = calc(stripped, w1) % 11
  const d1 = r1 < 2 ? 0 : 11 - r1
  if (d1 !== parseInt(stripped[12])) return false
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const r2 = calc(stripped, w2) % 11
  const d2 = r2 < 2 ? 0 : 11 - r2
  return d2 === parseInt(stripped[13])
}

// ===== STRINGS =====
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

export function searchNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ===== NUMBERS =====
export function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ===== WHATSAPP =====
export function whatsappLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '')
  const number = digits.startsWith('55') ? digits : `55${digits}`
  const text = message ? encodeURIComponent(message) : ''
  return `https://wa.me/${number}${text ? `?text=${text}` : ''}`
}

// ===== STATUS HELPERS =====
export const OS_STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  pausado: 'Pausado',
}

export const OS_STATUS_BADGE: Record<string, string> = {
  aberto: 'badge-yellow',
  em_andamento: 'badge-blue',
  concluido: 'badge-green',
  cancelado: 'badge-red',
  pausado: 'badge-gray',
}

export const ORCAMENTO_STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  expirado: 'Expirado',
}

export const ORCAMENTO_STATUS_BADGE: Record<string, string> = {
  rascunho: 'badge-gray',
  enviado: 'badge-blue',
  aprovado: 'badge-green',
  recusado: 'badge-red',
  expirado: 'badge-yellow',
}

export const PRIORIDADE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORIDADE_BADGE: Record<string, string> = {
  baixa: 'badge-gray',
  normal: 'badge-blue',
  alta: 'badge-yellow',
  urgente: 'badge-red',
}

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
}

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  cheque: 'Cheque',
}

// ===== CEP LOOKUP =====
export async function buscarCEP(cep: string) {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    const data = await res.json()
    if (data.erro) return null
    return {
      logradouro: data.logradouro,
      bairro: data.bairro,
      cidade: data.localidade,
      estado: data.uf,
    }
  } catch {
    return null
  }
}
