import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Badge, Modal } from '../components/UI'

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

const ROLE_LABELS = {
  admin:   { label: 'Admin',   color: 'red' },
  manager: { label: 'Manager', color: 'amber' },
  barista: { label: 'Barista', color: 'gray' },
}

export default function Team() {
  const { profile, signUpWithPin } = useAuth()
  const [members, setMembers]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [created, setCreated]   = useState(null)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    const { data } = await supabase.from('profiles').select('*').order('role').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  async function createMember({ name, role, pin }) {
    setSaving(true)
    const result = await signUpWithPin(name, role, pin)
    if (result?.error) { setSaving(false); return { error: result.error } }
    await fetchMembers()
    setSaving(false)
    setModal(false)
    setCreated({ name, pin, role })
    return { error: null }
  }

  async function deleteMember(id) {
    await supabase.from('profiles').delete().eq('id', id)
    setMembers(m => m.filter(x => x.id !== id))
  }

  async function resetPin(member) {
    const newPin = generatePin()
    await supabase.from('profiles').update({ pin_code: newPin }).eq('id', member.id)
    setMembers(m => m.map(x => x.id === member.id ? { ...x, pin_code: newPin } : x))
    setCreated({ name: member.name, pin: newPin, role: member.role, isReset: true })
  }

  async function changeRole(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setMembers(m => m.map(x => x.id === id ? { ...x, role: newRole } : x))
  }

  if (!hasRole(profile, 'manager')) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Accès réservé au manager</div>
    </div>
  )

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  const isAdmin = hasRole(profile, 'admin')

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Equipe</h1>
            <p className="page-subtitle">{members.length} membre{members.length > 1 ? 's' : ''}</p>
          </div>
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
              <Plus size={14} /> Créer
            </button>
          )}
        </div>
      </div>

      <div className="page-content">

        {/* COMPTE CRÉÉ / PIN RESET */}
        {created && (
          <div style={{ background: '#E0F2EB', border: '1.5px solid #A3D4B0', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, color: '#1A5C4A', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>{created.isReset ? `Nouveau PIN pour ${created.name}` : `Compte créé — ${created.name}`}</span>
              <button onClick={() => setCreated(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A5C4A', fontWeight: 800 }}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', margin: '0.75rem 0' }}>
              {created.pin.split('').map((d, i) => (
                <div key={i} style={{ width: 48, height: 56, borderRadius: 'var(--radius-md)', background: 'white', border: '2px solid #A3D4B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'var(--outside-dark)' }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4A7C59', textAlign: 'center', fontWeight: 600 }}>
              Donne ce PIN à {created.name} — connexion avec son prénom + ce code
            </div>
          </div>
        )}

        {/* MEMBRES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map(m => {
            const rl = ROLE_LABELS[m.role] || { label: m.role, color: 'gray' }
            const canEdit = isAdmin && m.id !== profile.id
            return (
              <div key={m.id} className="card" style={{ padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Avatar name={m.name} color={m.avatar_color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {m.name}
                      {m.id === profile.id && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '6px' }}>(toi)</span>}
                    </div>
                    {canEdit ? (
                      <select className="form-select"
                        style={{ padding: '2px 8px', fontSize: '0.78rem', width: 'auto', marginTop: '4px', height: 'auto' }}
                        value={m.role} onChange={e => changeRole(m.id, e.target.value)}>
                        <option value="barista">Barista</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <div style={{ marginTop: '3px' }}>
                        <Badge color={rl.color}>
                          {m.role === 'admin' && <Shield size={9} />}
                          {rl.label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS — admin seulement */}
                  {isAdmin && m.id !== profile.id && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', color: 'var(--outside-amber)' }}
                        onClick={() => resetPin(m)}
                        title="Réinitialiser le PIN">
                        🔑 PIN
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => deleteMember(m.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* INFO */}
        <div style={{ marginTop: '1.25rem', background: 'var(--outside-cream)', borderRadius: 'var(--radius-lg)', padding: '1rem', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 800, marginBottom: '8px' }}>Connexion</div>
          <div style={{ color: 'var(--muted)', fontWeight: 600, lineHeight: 1.6 }}>
            Chaque membre se connecte avec son <strong style={{ color: 'var(--ink)' }}>prénom</strong> + son <strong style={{ color: 'var(--ink)' }}>code PIN à 4 chiffres</strong>. Pas besoin d'email.
          </div>
        </div>
      </div>

      {modal && isAdmin && (
        <CreateModal onClose={() => setModal(false)} onCreate={createMember} saving={saving} />
      )}
    </>
  )
}

function CreateModal({ onClose, onCreate, saving }) {
  const [form, setForm] = useState({ name: '', role: 'barista', pin: generatePin() })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    if (!form.name) { setError('Prénom requis'); return }
    if (form.pin.length !== 4) { setError('PIN doit avoir 4 chiffres'); return }
    const result = await onCreate(form)
    if (result?.error) setError(result.error.message)
  }

  return (
    <Modal open onClose={onClose} title="Créer un compte"
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? <Spinner size={16} /> : <Plus size={15} />} Créer
        </button>
      </>}>

      <div className="form-group">
        <label className="form-label">Prénom</label>
        <input className="form-input" autoFocus value={form.name}
          onChange={e => set('name', e.target.value)} placeholder="ex: Sarra" />
      </div>

      <div className="form-group">
        <label className="form-label">Rôle</label>
        <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
          <option value="barista">Barista</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Code PIN (4 chiffres)</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontSize: '0.72rem' }}
            onClick={() => set('pin', generatePin())}>🔀 Générer</button>
        </label>
        {/* AFFICHAGE VISUEL DU PIN */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '0.75rem' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ width: 52, height: 60, borderRadius: 'var(--radius-md)', background: 'var(--outside-cream)', border: '2px solid var(--outside-cream2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 800, color: 'var(--outside-dark)' }}>
              {form.pin[i] || ''}
            </div>
          ))}
        </div>
        <input className="form-input" type="number" maxLength={4}
          value={form.pin} onChange={e => set('pin', e.target.value.slice(0,4))}
          style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '0.3em' }} />
      </div>

      {error && <div style={{ background: '#FDEEEC', color: 'var(--danger)', fontSize: '0.85rem', padding: '0.6rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>{error}</div>}
    </Modal>
  )
}
