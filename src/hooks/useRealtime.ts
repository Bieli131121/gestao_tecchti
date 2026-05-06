import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type RealtimeTable =
  | 'ordens_servico' | 'orcamentos' | 'clientes'
  | 'financeiro_lancamentos' | 'produtos' | 'estoque_movimentos'
  | 'os_checklist' | 'os_fotos'

/**
 * Subscribe to Supabase Realtime on multiple tables.
 * Calls onRefresh() debounced to avoid rapid consecutive reloads.
 */
export function useRealtime(
  tables: RealtimeTable[],
  onRefresh: () => void,
  debounceMs = 800
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshRef = useRef(onRefresh)
  refreshRef.current = onRefresh

  useEffect(() => {
    const key = tables.slice().sort().join('-')

    function trigger() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => refreshRef.current(), debounceMs)
    }

    const channel = supabase.channel(`rt-${key}`)
    tables.forEach(t =>
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, trigger)
    )
    channel.subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(',')])
}

/**
 * Debounce a value (useful for search inputs)
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
