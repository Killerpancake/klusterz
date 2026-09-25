import React from 'react'

export function Panel({ children, className = '' }) {
  return (
    <div className={`bg-panel border border-line rounded-lg ${className}`}>
      {children}
    </div>
  )
}

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-open text-base hover:brightness-110',
    ghost: 'bg-transparent text-ink border border-line hover:border-mute',
    danger: 'bg-transparent text-full border border-full/50 hover:bg-full/10',
  }
  return (
    <button
      className={`px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-sm text-mute mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-mute mt-1">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm text-ink placeholder:text-mute/60 focus:border-open outline-none transition'

// load 0-1 -> color band. Grounded in the actual capacity data, not decoration.
export function loadColor(pct) {
  if (pct >= 1) return 'full'
  if (pct >= 0.6) return 'filling'
  return 'open'
}

export function LoadBar({ booked, capacity }) {
  const cap = Math.max(capacity, 1)
  const pct = Math.min(booked / cap, 1)
  const color = loadColor(pct)
  const colorMap = { open: '#4FD1C5', filling: '#F2B84B', full: '#E2574C' }
  return (
    <div className="w-full h-1.5 bg-panel2 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct * 100}%`, background: colorMap[color] }}
      />
    </div>
  )
}

export function StatusDot({ status }) {
  const colorMap = { open: 'bg-open', filling: 'bg-filling', full: 'bg-full' }
  return <span className={`inline-block w-2 h-2 rounded-full ${colorMap[status]}`} />
}

export function Toast({ message, kind = 'info', onClose }) {
  if (!message) return null
  const border = kind === 'error' ? 'border-full/50' : kind === 'success' ? 'border-open/50' : 'border-line'
  return (
    <div
      className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-panel2 border ${border} rounded-md px-4 py-2.5 text-sm shadow-lg z-50 max-w-[90vw]`}
      onClick={onClose}
      role="status"
    >
      {message}
    </div>
  )
}

export function EmptyState({ title, body }) {
  return (
    <div className="text-center py-16 px-4">
      <p className="text-ink font-medium mb-1">{title}</p>
      {body && <p className="text-mute text-sm max-w-sm mx-auto">{body}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 border-2 border-line border-t-open rounded-full animate-spin" />
    </div>
  )
}
