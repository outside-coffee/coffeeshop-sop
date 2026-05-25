import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()

  // Mode: 'select' | 'pin' | 'email'
  const [step, setStep]         = useState('select')
  const [profiles, setProfiles] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [pin, setPin]           = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [loadingProfiles, setLoadingProfiles] = useState(true)
  const [error, setError]       = useState('')
  const [profile, setProfile]   = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, name, role, fake_email, avatar_color')
      .eq('actif', true)
      .order('name')
      .then(({ data }) => {
        setProfiles(data || [])
        setLoadingProfiles(false)
      })
  }, [])

  // Étape 1 — sélectionner un profil dans la liste
  function handleSelect(e) {
    e.preventDefault()
    if (!selectedId) return
    const found = profiles.find(p => p.id === selectedId)
    if (!found) return
    setProfile(found)
    setStep(found.fake_email ? 'pin' : 'email')
  }

  // Connexion PIN
  async function handlePin(digit) {
    const newPin = pin + digit
    setPin(newPin)
    if (newPin.length < 4) return

    setLoading(true)
    setError('')

    // Le mot de passe = PIN_xxxx_uuid[:8]
    const fakePassword = `PIN_${newPin}_${profile.id.slice(0, 8)}`
    const { error } = await signIn(profile.fake_email, fakePassword)

    if (error) {
      setError('PIN incorrect')
      setPin('')
      setLoading(false)
      return
    }
    navigate('/')
  }

  function deletePin() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  // Connexion email/mdp (admin)
  async function handleEmail(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Email ou mot de passe incorrect')
      setLoading(false)
      return
    }
    navigate('/')
  }

  function reset() {
    setStep('select')
    setSelectedId('')
    setPin('')
    setEmail('')
    setPassword('')
    setError('')
    setProfile(null)
  }

  const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <h1>Outside</h1>
          <p>Your Everyday Escape</p>
        </div>

        {/* ÉTAPE 1 — SÉLECTION PROFIL */}
        {step === 'select' && (
          <form onSubmit={handleSelect}>
            <div className="form-group">
              <label className="form-label">Qui es-tu ?</label>
              {loadingProfiles ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
                  <Spinner size={20} />
                </div>
              ) : (
                <select
                  className="form-input"
                  value={selectedId}
                  onChange={e => setSelectedId(e.target.value)}
                  required
                  style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}>
                  <option value="">— Sélectionner —</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>
            {error && <ErrorBox msg={error} />}
            <button className="btn btn-primary" type="submit"
              disabled={loadingProfiles || !selectedId}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }}>
              Continuer →
            </button>
          </form>
        )}

        {/* ÉTAPE 2A — PIN */}
        {step === 'pin' && (
          <div>
            <ProfileChip profile={profile} onReset={reset} />

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '1.5rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < pin.length ? 'var(--outside-dark)' : 'var(--outside-cream2)', transition: 'background 0.15s' }} />
              ))}
            </div>

            {error && <ErrorBox msg={error} />}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {DIGITS.map((d, i) => (
                <button key={i}
                  onClick={() => d === '⌫' ? deletePin() : d !== '' ? handlePin(d) : null}
                  disabled={loading || (d !== '⌫' && d !== '' && pin.length >= 4)}
                  style={{
                    height: 60, borderRadius: 'var(--radius-lg)', border: 'none',
                    background: d === '⌫' ? 'var(--outside-cream2)' : d === '' ? 'transparent' : 'white',
                    fontSize: d === '⌫' ? '1.1rem' : '1.4rem', fontWeight: 800,
                    fontFamily: 'var(--font-body)', color: 'var(--outside-dark)',
                    cursor: d === '' ? 'default' : 'pointer',
                    boxShadow: d !== '' && d !== '⌫' ? 'var(--shadow-sm)' : 'none',
                    border: d !== '' && d !== '⌫' ? '1.5px solid var(--outside-cream2)' : 'none',
                  }}>
                  {d}
                </button>
              ))}
            </div>

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <Spinner size={24} />
              </div>
            )}
          </div>
        )}

        {/* ÉTAPE 2B — EMAIL/MOT DE PASSE (admin) */}
        {step === 'email' && (
          <form onSubmit={handleEmail}>
            <ProfileChip profile={profile} onReset={reset} />

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email"
                placeholder="admin@outside.tn"
                value={email} onChange={e => setEmail(e.target.value)}
                autoFocus required />
            </div>
            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <input className="form-input" type="password"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                required />
            </div>

            {error && <ErrorBox msg={error} />}

            <button className="btn btn-primary" type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }}>
              {loading ? <Spinner size={18} /> : 'Se connecter'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function ProfileChip({ profile, onReset }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: profile?.avatar_color || 'var(--outside-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
        {profile?.name?.charAt(0).toUpperCase()}
      </div>
      <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{profile?.name}</div>
      <button onClick={onReset} style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', fontWeight: 600 }}>
        Ce n'est pas moi
      </button>
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#FDEEEC', color: 'var(--danger)', fontSize: '0.85rem', padding: '0.65rem 1rem', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontWeight: 600, textAlign: 'center' }}>
      {msg}
    </div>
  )
}
