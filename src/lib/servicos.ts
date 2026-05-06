import { supabase } from '@/lib/supabase'
import type { Servico, CategoriaServico } from '@/types'

export const servicosService = {
  async listCategorias() {
    const { data, error } = await supabase
      .from('categorias_servico')
      .select('*')
      .eq('ativo', true)
      .order('nome')
    if (error) throw error
    return data as CategoriaServico[]
  },

  async list(search?: string) {
    let query = supabase
      .from('servicos')
      .select('*, categoria:categorias_servico(id, nome, cor, icone)')
      .eq('ativo', true)
      .order('nome')

    if (search) {
      query = query.or(`nome.ilike.%${search}%,descricao.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) throw error
    return data as Servico[]
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('servicos')
      .select('*, categoria:categorias_servico(id, nome, cor, icone)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Servico
  },

  async create(form: Partial<Servico>) {
    const { data, error } = await supabase
      .from('servicos')
      .insert(form)
      .select('*, categoria:categorias_servico(id, nome, cor, icone)')
      .single()
    if (error) throw error
    return data as Servico
  },

  async update(id: string, form: Partial<Servico>) {
    const { data, error } = await supabase
      .from('servicos')
      .update(form)
      .eq('id', id)
      .select('*, categoria:categorias_servico(id, nome, cor, icone)')
      .single()
    if (error) throw error
    return data as Servico
  },

  async deactivate(id: string) {
    const { error } = await supabase
      .from('servicos')
      .update({ ativo: false })
      .eq('id', id)
    if (error) throw error
  },

  async createCategoria(nome: string, cor?: string, icone?: string) {
    const { data, error } = await supabase
      .from('categorias_servico')
      .insert({ nome, cor, icone })
      .select()
      .single()
    if (error) throw error
    return data as CategoriaServico
  },
}
