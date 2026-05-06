import { cn } from '@/lib/utils'
import { X, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import React from 'react'

// ===== SPINNER =====
export function Spinner({ size = 'sm', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <Loader2 className={cn('animate-spin text-brand-500', sizes[size], className)} />
  )
}

// ===== LOADING PAGE =====
export function LoadingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-surface-400">Carregando...</p>
    </div>
  )
}

// ===== EMPTY STATE =====
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-surface-100 flex items-center justify-center">
        <Icon className="w-7 h-7 text-surface-400" />
      </div>
      <div>
        <p className="font-semibold text-surface-700 text-base">{title}</p>
        {description && <p className="text-sm text-surface-400 mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ===== ERROR STATE =====
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-6 h-6 text-red-500" />
      </div>
      <div>
        <p className="font-medium text-surface-700">Algo deu errado</p>
        <p className="text-sm text-surface-400 mt-1">{message || 'Tente novamente em alguns instantes'}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm">
          Tentar novamente
        </button>
      )}
    </div>
  )
}

// ===== MODAL =====
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, subtitle, children, size = 'md', footer }: ModalProps) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={cn('modal-box w-full', sizes[size])}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-surface-100">
          <div>
            <h2 className="text-base font-display font-bold text-surface-900">{title}</h2>
            {subtitle && <p className="text-sm text-surface-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn-icon btn-ghost text-surface-400 hover:text-surface-600 -mt-1 -mr-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-5 pb-5 pt-0 flex items-center justify-end gap-2 border-t border-surface-100 mt-2 pt-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== CONFIRM DIALOG =====
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  variant = 'danger',
  loading = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {description && <p className="text-sm text-surface-600">{description}</p>}
    </Modal>
  )
}

// ===== SEARCH INPUT =====
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  )
}

// ===== FORM FIELD =====
export function FormField({
  label,
  error,
  required,
  children,
  className,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

// ===== PAGINATION =====
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
      <p className="text-xs text-surface-400">
        {from}–{to} de <span className="font-medium text-surface-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="btn-icon btn-ghost btn-sm disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = i + 1
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'w-7 h-7 rounded-lg text-xs font-medium transition-colors',
                p === page
                  ? 'bg-brand-600 text-white'
                  : 'text-surface-500 hover:bg-surface-100'
              )}
            >
              {p}
            </button>
          )
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="btn-icon btn-ghost btn-sm disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ===== STAT CARD (Dashboard KPI) =====
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  accent = 'blue',
  loading = false,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  trend?: number
  trendLabel?: string
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'purple'
  loading?: boolean
}) {
  const accents = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   ring: 'bg-blue-100' },
    green:  { bg: 'bg-emerald-50', icon: 'text-emerald-500', ring: 'bg-emerald-100' },
    yellow: { bg: 'bg-amber-50',  icon: 'text-amber-500',  ring: 'bg-amber-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    ring: 'bg-red-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-500', ring: 'bg-purple-100' },
  }
  const a = accents[accent]

  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', a.ring)}>
          <Icon className={cn('w-5 h-5', a.icon)} />
        </div>
        {trend !== undefined && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
          )}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-7 bg-surface-100 animate-pulse rounded-lg w-3/4" />
      ) : (
        <div className="kpi-value">{value}</div>
      )}
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {trendLabel && <span className="text-xs text-surface-400">{trendLabel}</span>}
      </div>
    </div>
  )
}

// ===== SECTION DIVIDER =====
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-surface-100" />
      <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider px-2">{label}</span>
      <div className="flex-1 h-px bg-surface-100" />
    </div>
  )
}

// ===== AVATAR =====
export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const initials = name.split(' ').slice(0, 2).map(n => n[0]?.toUpperCase()).join('')
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' }
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn('rounded-full flex items-center justify-center text-white font-semibold font-display', sizes[size], color, className)}>
      {initials}
    </div>
  )
}
