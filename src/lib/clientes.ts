import { supabase } from '@/lib/supabase'
import type { Cliente, ClienteFormData } from '@/types'

export const clientesService = {
  async list(search?: string) {
    let query = supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (search) {
      query = query.or(
        `nome.ilike.%${search}%,cpf_cnpj.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`
      )
    }

    const { data, error } = await query
    if (error) throw error
    return data as Cliente[]
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Cliente
  },

  async create(formData: ClienteFormData) {
    const { data, error } = await supabase
      .from('clientes')
      .insert(formData)
      .select()
      .single()
    if (error) throw error
    return data as Cliente
  },

  async update(id: string, formData: Partial<ClienteFormData>) {
    const { data, error } = await supabase
      .from('clientes')
      .update({ ...formData, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Cliente
  },

  async deactivate(id: string) {
    const { error } = await supabase
      .from('clientes')
      .update({ ativo: false, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async getCount() {
    const { count, error } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true })
      .eq('ativo', true)
    if (error) throw error
    return count ?? 0
  },
}
