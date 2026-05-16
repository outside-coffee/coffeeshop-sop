import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/UI'

export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'barista' })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')

    let result
    if (mode === 'login') {
      result = await signIn(form.email, form.password)
    } else {
      if (!form.name) { setError('Le prénom est requis'); setLoading(false); return }
      result = await signUp(form.email, form.password, form.name, form.role)
    }

    if (result?.error) {
      const msgs = {
        'Invalid login credentials': 'Email ou mot de passe incorrect',
        'User already registered': 'Ce compte existe déjà, connecte-toi',
        'Password should be at least 6 characters': 'Le mot de passe doit faire au moins 6 caractères',
      }
      setError(msgs[result.error.message] || result.error.message)
    } else {
      navigate('/')
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>☕ SOP Manager</h1>
          <p>Coffeeshop Operations</p>
        </div>

        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            className={`tab-btn${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
          >
            Connexion
          </button>
          <button
            className={`tab-btn${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label className="form-label">Prénom</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ex: Marie"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
                  <option value="barista">Barista</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="marie@coffeeshop.fr"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-input"
              type="password"
              placeholder={mode === 'register' ? 'Min. 6 caractères' : '••••••••'}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#FDEEEC',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              padding: '0.6rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}>
            {loading ? <Spinner size={18} /> : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
          {mode === 'login' ? (
            <>Pas encore de compte ? <button className="btn btn-ghost btn-sm" onClick={() => setMode('register')}>S'inscrire</button></>
          ) : (
            <>Déjà un compte ? <button className="btn btn-ghost btn-sm" onClick={() => setMode('login')}>Se connecter</button></>
          )}
        </p>
      </div>
    </div>
  )
}
