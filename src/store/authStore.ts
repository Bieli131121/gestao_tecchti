import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'

interface AuthState {
  user: Profile | null
  loading: boolean
  initialized: boolean

  // Actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<void>

  // Computed
  isAdmin: () => boolean
  hasRole: (roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      initialized: false,

      initialize: async () => {
        set({ loading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
            set({ user: profile || null })
          } else {
            set({ user: null })
          }
        } finally {
          set({ loading: false, initialized: true })
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single()
            set({ user: profile || null })
          } else if (event === 'SIGNED_OUT') {
            set({ user: null })
          }
        })
      },

      signIn: async (email, password) => {
        set({ loading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) return { error: translateAuthError(error.message) }

          if (data.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single()

            if (!profile?.ativo) {
              await supabase.auth.signOut()
              return { error: 'Usuário inativo. Entre em contato com o administrador.' }
            }
            set({ user: profile })
          }
          return {}
        } finally {
          set({ loading: false })
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null })
      },

      updateProfile: async (data) => {
        const user = get().user
        if (!user) return
        const { data: updated } = await supabase
          .from('profiles')
          .update(data)
          .eq('id', user.id)
          .select()
          .single()
        if (updated) set({ user: updated })
      },

      isAdmin: () => get().user?.role === 'admin',
      hasRole: (roles) => {
        const role = get().user?.role
        return role ? roles.includes(role) : false
      },
    }),
    {
      name: 'tecchti-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de fazer login'
  if (msg.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos'
  return 'Erro ao fazer login. Tente novamente'
}
