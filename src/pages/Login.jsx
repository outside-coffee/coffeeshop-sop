import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/UI'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '' })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(form.email, form.password)
    if (error) {
      const msgs = {
        'Invalid login credentials': 'Email ou mot de passe incorrect',
        'Email not confirmed': 'Compte non confirme — contacte le manager',
      }
      setError(msgs[error.message] || 'Erreur de connexion — contacte le manager')
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Outside</h1>
          <p>Your Everyday Escape</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email"
              placeholder="prenom@outside.tn"
              value={form.email} onChange={e => set('email', e.target.value)}
              autoFocus required />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input className="form-input" type="password"
              placeholder="••••••••"
              value={form.password} onChange={e => set('password', e.target.value)}
              required />
          </div>

          {error && (
            <div style={{ background: '#FDEEEC', color: 'var(--danger)', fontSize: '0.85rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }}>
            {loading ? <Spinner size={18} /> : 'Se connecter'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
          Pas de compte ? Contacte le manager.
        </p>
      </div>
    </div>
  )
}
