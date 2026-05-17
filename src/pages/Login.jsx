import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [step, setStep]     = useState('name')  // 'name' | 'pin'
  const [name, setName]     = useState('')
  const [pin, setPin]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [profile, setProfile] = useState(null)

  // Étape 1 — chercher le profil par prénom
  async function handleName(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')

    const { data } = await supabase
      .from('profiles')
      .select('id, name, role, fake_email, pin_code, avatar_color')
      .ilike('name', name.trim())
      .maybeSingle()

    if (!data) {
      setError('Prénom introuvable — contacte le manager')
      setLoading(false)
      return
    }
    setProfile(data)
    setStep('pin')
    setLoading(false)
  }

  // Étape 2 — saisie PIN et connexion
  async function handlePin(digit) {
    const newPin = pin + digit
    setPin(newPin)
    if (newPin.length < 4) return

    setLoading(true)
    setError('')

    const { error } = await signIn(profile.fake_email, `PIN_${newPin}_${profile.id.slice(0,8)}`)
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

  function resetName() {
    setStep('name')
    setName('')
    setPin('')
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

        {step === 'name' && (
          <form onSubmit={handleName}>
            <div className="form-group">
              <label className="form-label">Ton prénom</label>
              <input className="form-input"
                type="text"
                placeholder="ex: Sarra"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                autoCapitalize="words"
                required
                style={{ fontSize: '1.1rem', textAlign: 'center', fontWeight: 700 }} />
            </div>
            {error && <ErrorBox msg={error} />}
            <button className="btn btn-primary" type="submit" disabled={loading || !name.trim()}
              style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }}>
              {loading ? <Spinner size={18} /> : 'Continuer →'}
            </button>
          </form>
        )}

        {step === 'pin' && (
          <div>
            {/* PROFIL */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: profile?.avatar_color || 'var(--outside-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>
                {profile?.name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{profile?.name}</div>
              <button onClick={resetName} style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', fontWeight: 600 }}>
                Ce n'est pas moi
              </button>
            </div>

            {/* INDICATEUR PIN */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '1.5rem' }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: i < pin.length ? 'var(--outside-dark)' : 'var(--outside-cream2)', transition: 'background 0.15s' }} />
              ))}
            </div>

            {error && <ErrorBox msg={error} />}

            {/* CLAVIER PIN */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {DIGITS.map((d, i) => (
                <button key={i}
                  onClick={() => d === '⌫' ? deletePin() : d !== '' ? handlePin(d) : null}
                  disabled={loading || (d !== '⌫' && d !== '' && pin.length >= 4)}
                  style={{
                    height: 60,
                    borderRadius: 'var(--radius-lg)',
                    border: 'none',
                    background: d === '⌫' ? 'var(--outside-cream2)' : d === '' ? 'transparent' : 'white',
                    fontSize: d === '⌫' ? '1.1rem' : '1.4rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-body)',
                    color: 'var(--outside-dark)',
                    cursor: d === '' ? 'default' : 'pointer',
                    boxShadow: d !== '' && d !== '⌫' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.1s',
                    border: d !== '' && d !== '⌫' ? '1.5px solid var(--outside-cream2)' : 'none',
                  }}>
                  {loading && pin.length === 4 && d !== '⌫' && d !== '' ? '' : d}
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
      </div>
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
