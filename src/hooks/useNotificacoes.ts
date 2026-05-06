import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface Notificacao {
  id: string
  tipo: 'estoque_baixo' | 'vencimento' | 'os_aberta' | 'os_atrasada'
  titulo: string
  mensagem: string
  urgente: boolean
  link: string
}

export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [loading, setLoading] = useState(true)

  async function carregar() {
    setLoading(true)
    const hoje = new Date().toISOString().slice(0, 10)
    const ontemISO = new Date(Date.now() - 86400000).toISOString()

    try {
      const [estBaixo, vencidas, osAbertas, osAtrasadas] = await Promise.all([
        // Produtos com estoque abaixo do mínimo
        supabase.from('produtos').select('id, nome, estoque_atual, estoque_minimo')
          .eq('ativo', true)
          .filter('estoque_atual', 'lte', 'estoque_minimo')
          .limit(10),

        // Receitas vencidas não pagas
        supabase.from('financeiro_lancamentos').select('id, descricao, valor, data_vencimento')
          .eq('tipo', 'receita').eq('pago', false)
          .lt('data_vencimento', hoje)
          .order('data_vencimento').limit(10),

        // OS abertas há mais de 7 dias
        supabase.from('ordens_servico').select('id, numero, titulo, data_abertura')
          .eq('status', 'aberto')
          .lt('data_abertura', new Date(Date.now() - 7 * 86400000).toISOString())
          .limit(5),

        // OS em andamento sem atualização há mais de 24h
        supabase.from('ordens_servico').select('id, numero, titulo, updated_at')
          .eq('status', 'em_andamento')
          .lt('updated_at', ontemISO)
          .limit(5),
      ])

      const lista: Notificacao[] = []

      // Estoque baixo
      ;(estBaixo.data || []).forEach(p => {
        lista.push({
          id: `estoque-${p.id}`,
          tipo: 'estoque_baixo',
          titulo: 'Estoque baixo',
          mensagem: `${p.nome}: ${p.estoque_atual} unidades (mínimo: ${p.estoque_minimo})`,
          urgente: p.estoque_atual === 0,
          link: '/estoque',
        })
      })

      // Vencimentos em atraso
      ;(vencidas.data || []).forEach(l => {
        const diasAtraso = Math.floor((Date.now() - new Date(l.data_vencimento).getTime()) / 86400000)
        lista.push({
          id: `vencido-${l.id}`,
          tipo: 'vencimento',
          titulo: 'Recebimento em atraso',
          mensagem: `${l.descricao} — ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} em atraso`,
          urgente: diasAtraso > 7,
          link: '/financeiro',
        })
      })

      // OS abertas antigas
      ;(osAbertas.data || []).forEach(os => {
        const diasAberto = Math.floor((Date.now() - new Date(os.data_abertura).getTime()) / 86400000)
        lista.push({
          id: `os-aberta-${os.id}`,
          tipo: 'os_aberta',
          titulo: `OS #${os.numero} sem atendimento`,
          mensagem: `"${os.titulo}" — aberta há ${diasAberto} dias`,
          urgente: diasAberto > 14,
          link: `/os/${os.id}`,
        })
      })

      // OS em andamento paradas
      ;(osAtrasadas.data || []).forEach(os => {
        lista.push({
          id: `os-parada-${os.id}`,
          tipo: 'os_atrasada',
          titulo: `OS #${os.numero} sem atualização`,
          mensagem: `"${os.titulo}" — em andamento sem movimentação`,
          urgente: false,
          link: `/os/${os.id}`,
        })
      })

      // Sort: urgentes primeiro
      lista.sort((a, b) => Number(b.urgente) - Number(a.urgente))
      setNotificacoes(lista)
    } catch (e) {
      console.error('Erro ao carregar notificações:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()

    // Atualiza a cada 5 minutos
    const interval = setInterval(carregar, 5 * 60 * 1000)

    // Realtime: quando OS muda de status
    const channel = supabase
      .channel('notificacoes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ordens_servico' }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_movimentos' }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, () => carregar())
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [])

  return {
    notificacoes,
    loading,
    total: notificacoes.length,
    urgentes: notificacoes.filter(n => n.urgente).length,
    refresh: carregar,
  }
}
