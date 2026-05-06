/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '⚠️  Variáveis de ambiente do Supabase não configuradas.\n' +
    'Copie .env.example para .env.local e preencha as credenciais.\n' +
    'Encontre em: app.supabase.com → Settings → API'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth:     { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 10 } },
})

export default supabase
