import { useState, useEffect } from 'react'
import { Plus, Trash2, RefreshCw, Eye, EyeOff, Copy, Check, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Badge, Modal } from '../components/UI'

export default function Team() {
  const { profile } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    const { data } = await supabase
      .from('profiles').select('*')
      .order('role').order('name')
    setMembers(data || [])
    setLoading(false)
  }

  async function createMember({ name, role, email, password }) {
    setSaving(true)
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setSaving(false); return { error } }
    if (data.user) {
      const colors = ['#C8956C', '#4A7C59', '#3D5A8A', '#8B6B8A', '#D4A853', '#B04A3A']
      const color = colors[Math.floor(Math.random() * colors.length)]
      await supabase.from('profiles').insert({ id: data.user.id, name, role, avatar_color: color })
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

  // Admin can change roles
  async function changeRole(id, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', id)
    setMembers(m => m.map(x => x.id === id ? { ...x, role: newRole } : x))
  }

  if (!hasRole(profile, 'manager')) {
    return (
      <div className="page-content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown-600)' }}>Accès réservé au manager</h2>
      </div>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  const isAdmin = hasRole(profile, 'admin')

  const ROLE_LABELS = {
    admin: { label: 'Admin', color: 'red' },
    manager: { label: 'Manager', color: 'amber' },
    barista: { label: 'Barista', color: 'gray' },
  }

  // Roles a manager can create — admin can create any role
  const creatableRoles = isAdmin
    ? ['barista', 'manager', 'admin']
    : ['barista', 'manager']

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Equipe</h1>
            <p className="page-subtitle">{members.length} membre{members.length > 1 ? 's' : ''} · Gestion des accès</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> Créer un compte
          </button>
        </div>
      </div>

      <div className="page-content">
        {created && (
          <div style={{ background: '#EBF5EE', border: '1px solid #A3D4B0', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: 500, color: '#2D6A3F', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Compte créé pour {created.name}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: '#2D6A3F' }} onClick={() => setCreated(null)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <CredField label="Email" value={created.email} />
              <CredField label="Mot de passe" value={created.password} secret />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4A7C59', marginTop: '10px' }}>
              Transmets ces identifiants à {created.name} — il/elle peut se connecter immédiatement.
            </div>
          </div>
        )}

        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Membre</th>
                  <th>Rôle</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Aucun membre</td></tr>
                )}
                {members.map(m => {
                  const rl = ROLE_LABELS[m.role] || { label: m.role, color: 'gray' }
                  const canEdit = isAdmin && m.id !== profile.id
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar name={m.name} color={m.avatar_color} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{m.name}</div>
                            {m.id === profile.id && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Toi</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {canEdit ? (
                          <select
                            className="form-select"
                            style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }}
                            value={m.role}
                            onChange={e => changeRole(m.id, e.target.value)}
                          >
                            <option value="barista">Barista</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <Badge color={rl.color}>
                            {m.role === 'admin' && <Shield size={10} />}
                            {rl.label}
                          </Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.id !== profile.id && hasRole(profile, 'manager') && (
                          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => deleteMember(m.id)} title="Supprimer l'accès">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', background: 'var(--brown-50)', borderRadius: 'var(--radius-lg)', padding: '1.25rem 1.5rem', fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--brown-700)', display: 'block', marginBottom: '8px' }}>Niveaux d'accès</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[
              { role: 'Admin', color: 'red', desc: 'Accès complet — gestion des rôles, configuration, tous les modules' },
              { role: 'Manager', color: 'amber', desc: 'Création de comptes, validation des checklists, rapports, stock, recettes' },
              { role: 'Barista', color: 'gray', desc: 'Checklists, rapport de shift, consultation stock et recettes' },
            ].map(r => (
              <div key={r.role} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Badge color={r.color}>{r.role}</Badge>
                <span style={{ fontSize: '0.82rem' }}>{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {modal && (
        <CreateModal
          onClose={() => setModal(false)}
          onCreate={createMember}
          saving={saving}
          creatableRoles={creatableRoles}
        />
      )}
    </>
  )
}

function CredField({ label, value, secret = false }) {
  const [show, setShow] = useState(!secret)
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  return (
    <div style={{ background: 'white', borderRadius: 'var(--radius-sm)', padding: '8px 10px', border: '1px solid #A3D4B0' }}>
      <div style={{ fontSize: '0.7rem', color: '#4A7C59', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ flex: 1, fontSize: '0.875rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
          {show ? value : '••••••••'}
        </span>
        {secret && (
          <button className="btn btn-ghost btn-icon" style={{ padding: '2px', color: '#4A7C59' }} onClick={() => setShow(s => !s)}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
        <button className="btn btn-ghost btn-icon" style={{ padding: '2px', color: '#4A7C59' }} onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  )
}

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function CreateModal({ onClose, onCreate, saving, creatableRoles }) {
  const [form, setForm] = useState({ name: '', role: 'barista', email: '', password: generatePassword() })
  const [error, setError] = useState('')
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleCreate = async () => {
    if (!form.name || !form.email) { setError('Prénom et email requis'); return }
    const result = await onCreate(form)
    if (result?.error) {
      const msgs = { 'User already registered': 'Cet email est déjà utilisé', 'invalid email': 'Email invalide' }
      setError(msgs[result.error.message] || result.error.message)
    }
  }

  return (
    <Modal open onClose={onClose} title="Créer un compte équipe"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
            {saving ? <Spinner size={16} /> : <Plus size={15} />} Créer le compte
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Prénom</label>
        <input className="form-input" autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Sarra" />
      </div>
      <div className="form-group">
        <label className="form-label">Rôle</label>
        <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
          {creatableRoles.map(r => (
            <option key={r} value={r}>
              {r === 'admin' ? 'Admin' : r === 'manager' ? 'Manager' : 'Barista'}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Email</label>
        <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="sarra@outside.tn" />
      </div>
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Mot de passe</span>
          <button className="btn btn-ghost btn-sm" style={{ padding: 0, height: 'auto', fontSize: '0.75rem' }}
            onClick={() => set('password', generatePassword())}>
            <RefreshCw size={12} /> Regénérer
          </button>
        </label>
        <input className="form-input" value={form.password} onChange={e => set('password', e.target.value)}
          style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
      </div>
      {error && <div style={{ background: '#FDEEEC', color: 'var(--danger)', fontSize: '0.85rem', padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-sm)' }}>{error}</div>}
    </Modal>
  )
}
