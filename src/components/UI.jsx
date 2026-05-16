import { useEffect, useRef } from 'react'
import { Check, X, AlertTriangle, CheckCircle } from 'lucide-react'

// ── TOAST ──────────────────────────────────────────────────────────────────
let _setToasts = null

export function ToastProvider({ children }) {
  const [toasts, setToasts] = [[], null]
  return children
}

const toastQueue = []
let toastSetter = null

export function useToast() {
  return {
    toast: (msg, type = 'default') => {
      if (toastSetter) toastSetter(prev => [...prev, { id: Date.now(), msg, type }])
    }
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = require('react').useState([])
  toastSetter = setToasts

  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => setToasts(p => p.slice(1)), 3200)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' && <CheckCircle size={16} />}
          {t.type === 'error' && <AlertTriangle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── MODAL ──────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '1.2rem' }}>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ── LOADING SPINNER ────────────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
      <circle cx="12" cy="12" r="10" stroke="var(--brown-200)" strokeWidth="2.5" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ── AVATAR ─────────────────────────────────────────────────────────────────
export function Avatar({ name = '?', color = '#C8956C', size = 'md' }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const cls = size === 'lg' ? 'avatar avatar-lg' : 'avatar'
  return (
    <div className={cls} style={{ background: color }}>
      {initials}
    </div>
  )
}

// ── EMPTY STATE ────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div style={{ marginTop: '1.25rem' }}>{action}</div>}
    </div>
  )
}

// ── BADGE ──────────────────────────────────────────────────────────────────
export function Badge({ children, color = 'gray' }) {
  return <span className={`badge badge-${color}`}>{children}</span>
}

// ── CONFIRM DIALOG ─────────────────────────────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Confirmer</button>
        </>
      }
    >
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{message}</p>
    </Modal>
  )
}
