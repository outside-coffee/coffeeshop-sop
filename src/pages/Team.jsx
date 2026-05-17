import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, Eye, EyeOff, Copy, Check, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Badge, Modal } from '../components/UI'

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const ROLE_LABELS = {
  admin:   { label: 'Admin',   color: 'red' },
  manager: { label: 'Manager', color: 'amber' },
  barista: { label: 'Barista', color: 'gray' },
}

export default function Team() {
  const { profile } = useAuth()
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

  async function createMember({ name, role, email, password }) {
    setSaving(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setSaving(false); return { error } }
    if (data.user) {
      const colors = ['#C8956C','#4A7C59','#3D5A8A','#8B6B8A','#D4A853','#B04A3A']
      await supabase.from('profiles').insert({ id: data.user.id, name, role, avatar_color: colors[Math.floor(Math.random() * colors.length)] })
    }
    await fetchMembers()
    setSaving(false)
    setModal(false)
    setCreated({ name, email, password })
    return { error: null }
  }

  async function deleteMember(id) {
    await supabase.from('profiles').delete().eq('id', id)
    setMembers(m => m.filter(x => x.id !== id))
  }

  async function changeRole(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setMembers(m => m.map(x => x.id === id ? { ...x, role: newRole } : x))
  }

  if (!hasRole(profile, 'manager')) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Acces reserve au manager</div>
    </div>
  )

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  const isAdmin = hasRole(profile, 'admin')
  const creatableRoles = isAdmin ? ['barista','manager','admin'] : ['barista','manager']

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Equipe</h1>
            <p className="page-subtitle">{members.length} membre{members.length > 1 ? 's' : ''}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Creer
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* COMPTE CREE */}
        {created && (
          <div style={{ background: '#E0F2EB', border: '1.5px solid #A3D4B0', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, color: '#1A5C4A', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Compte cree pour {created.name}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: '#1A5C4A', padding: '0' }} onClick={() => setCreated(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <CredField label="Email" value={created.email} />
              <CredField label="Mot de passe" value={created.password} secret />
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {m.name}
                      {m.id === profile.id && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '6px' }}>(toi)</span>}
                    </div>
                    {canEdit ? (
                      <select className="form-select" style={{ padding: '2px 8px', fontSize: '0.78rem', width: 'auto', marginTop: '4px', height: 'auto' }}
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
                  {m.id !== profile.id && hasRole(profile, 'manager') && (
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteMember(m.id)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* INFO ROLES */}
        <div style={{ marginTop: '1.25rem', background: 'var(--outside-cream)', borderRadius: 'var(--radius-lg)', padding: '1rem', fontSize: '0.82rem' }}>
          <div style={{ fontWeight: 800, marginBottom: '8px', color: 'var(--outside-dark)' }}>Niveaux d'acces</div>
          {[
            { role: 'Admin', color: 'red', desc: 'Acces complet + gestion des roles' },
            { role: 'Manager', color: 'amber', desc: 'Creation comptes, rapports, stock' },
            { role: 'Barista', color: 'gray', desc: 'Checklists, rapport shift, recettes' },
          ].map(r => (
            <div key={r.role} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <Badge color={r.color}>{r.role}</Badge>
              <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {modal && <CreateModal onClose={() => setModal(false)} onCreate={createMember} saving={saving} creatableRoles={creatableRoles} />}
    </>
  )
}

function CredField({ label, value, secret = false }) {
  const [show, setShow]     = useState(!secret)
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', padding: '8px 10px', border: '1px solid #A3D4B0' }}>
      <div style={{ fontSize: '0.65rem', color: '#1A5C4A', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ flex: 1, fontSize: '0.82rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{show ? value : '••••••••'}</span>
        {secret && <button className="btn btn-ghost btn-icon" style={{ padding: '2px', color: '#1A5C4A' }} onClick={() => setShow(s => !s)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>}
        <button className="btn btn-ghost btn-icon" style={{ padding: '2px', color: '#1A5C4A' }} onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
      </div>
    </div>
  )
}

function CreateModal({ onClose, onCreate, saving, creatableRoles }) {
  const [form, setForm] = useState({ name: '', role: 'barista', email: '', password: generatePassword() })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    if (!form.name || !form.email) { setError('Prenom et email requis'); return }
    const result = await onCreate(form)
    if (result?.error) setError({ 'User already registered': 'Email deja utilise' }[result.error.message] || result.error.message)
  }

  return (
    <Modal open onClose={onClose} title="Creer un compte"
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
          {saving ? <Spinner size={16} /> : <Plus size={15} />} Creer
        </button>
      </>}>
      <div className="form-group">
        <label className="form-label">Prenom</label>
        <input className="form-input" autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Sarra" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
            {creatableRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="@outside.tn" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Mot de passe</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: '0.72rem' }} onClick={() => set('password', generatePassword())}>
            <RefreshCw size={11} /> Regenerer
          </button>
        </label>
        <input className="form-input" value={form.password} onChange={e => set('password', e.target.value)} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
      </div>
      {error && <div style={{ background: '#FDEEEC', color: 'var(--danger)', fontSize: '0.85rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
    </Modal>
  )
}
