import { useState, useEffect } from 'react'
import { Plus, Trash2, Shield, Eye, EyeOff, Edit2, Save, UserCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Modal } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function generatePin() { return String(Math.floor(1000 + Math.random() * 9000)) }

const ROLES_TECH = [
  { value: 'admin',   label: 'Admin',   color: '#C4521A' },
  { value: 'manager', label: 'Manager', color: '#D4892A' },
  { value: 'barista', label: 'Barista', color: '#1A5C4A' },
]

const ROLES_OPS = [
  { value: 'manager',       label: 'Manager'       },
  { value: 'barista_lead',  label: 'Barista Lead'  },
  { value: 'barista',       label: 'Barista'        },
  { value: 'service_crew',  label: 'Service Crew'   },
  { value: 'support_crew',  label: 'Support Crew'   },
  { value: 'femme_menage',  label: 'Femme de ménage'},
]

const PALETTE = [
  '#2E7D4F','#4A3D8F','#C4521A','#C0392B','#7B4F9E','#2980B9',
  '#E67E22','#16A085','#8E44AD','#2C3E50','#D35400','#1ABC9C',
  '#E74C3C','#7F8C8D','#27AE60','#F39C12',
]

export default function Team() {
  const { profile, signUpWithPin } = useAuth()
  const isAdmin   = hasRole(profile, 'admin')
  const isManager = hasRole(profile, 'manager')

  const [members, setMembers]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editModal, setEditModal] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [created, setCreated]     = useState(null)
  const [showPins, setShowPins]   = useState({})
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => { fetchMembers() }, [])

  async function fetchMembers() {
    const { data } = await supabase.from('profiles').select('*').order('nom').order('prenom')
    setMembers(data || [])
    setLoading(false)
  }

  async function createMember(form) {
    setSaving(true)
    const displayName = [form.prenom, form.nom].filter(Boolean).join(' ') || form.prenom || form.nom
    const result = await signUpWithPin(displayName, form.role, form.pin)
    if (result?.error) { setSaving(false); return { error: result.error } }
    if (result?.user?.id) {
      await supabase.from('profiles').update({
        prenom: form.prenom, nom: form.nom,
        role_operationnel: form.role_operationnel,
        date_recrutement: form.date_recrutement || null,
        telephone: form.telephone || null,
        planning_color: form.planning_color,
        is_planning_member: form.is_planning_member,
        actif: true,
      }).eq('id', result.user.id)
    }
    await fetchMembers()
    setSaving(false); setModal(false)
    setCreated({ name: displayName, pin: form.pin, role: form.role })
    return { error: null }
  }

  async function updateMember(member, updates) {
    setSaving(true)
    const displayName = [updates.prenom, updates.nom].filter(Boolean).join(' ')
    // Seulement les colonnes valides dans profiles (exclure pin)
    const { pin, ...safeUpdates } = updates
    const payload = {
      ...safeUpdates,
      name: displayName || member.name,
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', member.id)
    if (error) {
      console.error('updateMember error:', error)
      alert('Erreur: ' + error.message)
      setSaving(false)
      return
    }
    setMembers(m => m.map(x => x.id === member.id ? { ...x, ...payload } : x))
    setSaving(false); setEditModal(null)
  }

  async function toggleActif(member) {
    const newVal = !member.actif
    await supabase.from('profiles').update({ actif: newVal }).eq('id', member.id)
    setMembers(m => m.map(x => x.id === member.id ? { ...x, actif: newVal } : x))
  }

  async function deleteMember(id) {
    if (!window.confirm('Supprimer définitivement ce membre ?')) return
    await supabase.from('profiles').delete().eq('id', id)
    setMembers(m => m.filter(x => x.id !== id))
  }

  async function resetPin(member) {
    const newPin = generatePin()
    await supabase.from('profiles').update({ pin_code: newPin }).eq('id', member.id)
    setMembers(m => m.map(x => x.id === member.id ? { ...x, pin_code: newPin } : x))
    setCreated({ name: member.name, pin: newPin, role: member.role, isReset: true })
  }

  if (!isManager) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Accès manager uniquement</div>
    </div>
  )

  const filtered = members.filter(m => showInactive ? m.actif === false : m.actif !== false)

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Équipe</h1>
            <p className="page-subtitle">{filtered.length} membre{filtered.length > 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`btn btn-sm ${showInactive ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setShowInactive(v => !v)}>
              {showInactive ? '✓ Actifs' : 'Inactifs'}
            </button>
            {isAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
                <Plus size={14} /> Ajouter
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* NOTIFICATION */}
        {created && (
          <div style={{ background: '#E8F5E9', border: '1.5px solid #A3D4B0', borderRadius: 'var(--radius-lg)', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 800, color: '#1A5C4A', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              {created.isReset ? '🔄 PIN réinitialisé' : '✓ Compte créé'} — {created.name}
              <button onClick={() => setCreated(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1A5C4A', fontWeight: 800 }}>✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
              {String(created.pin).split('').map((d, i) => (
                <div key={i} style={{ width: 48, height: 56, borderRadius: 'var(--radius-md)', background: 'white', border: '2px solid #A3D4B0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800 }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4A7C59', textAlign: 'center', fontWeight: 600 }}>PIN de {created.name}</div>
          </div>
        )}

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Spinner size={28}/></div> : (
          <div className="card">
            {filtered.map((m, idx) => {
              const roleTech = ROLES_TECH.find(r => r.value === m.role) || { label: m.role, color: '#999' }
              const roleOps  = ROLES_OPS.find(r => r.value === m.role_operationnel)
              const pinVisible = showPins[m.id]
              const recrutement = m.date_recrutement ? format(new Date(m.date_recrutement), 'd MMM yyyy', { locale: fr }) : null

              return (
                <div key={m.id} style={{ padding: '0.85rem 1rem', borderBottom: idx < filtered.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: 12, opacity: m.actif === false ? 0.5 : 1 }}>

                  {/* AVATAR */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <Avatar name={m.name} color={m.planning_color || m.avatar_color} size={44}/>
                    {m.is_planning_member && (
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: m.planning_color || '#999', border: '2px solid white' }}/>
                    )}
                  </div>

                  {/* INFOS */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                      {m.prenom && m.nom ? <><span>{m.prenom}</span> <span style={{ textTransform: 'uppercase' }}>{m.nom}</span></> : m.name}
                      {m.role === 'admin' && <Shield size={12} style={{ marginLeft: 4, color: 'var(--outside-orange)', verticalAlign: 'middle' }}/>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: roleTech.color, background: roleTech.color + '18', borderRadius: 10, padding: '1px 7px' }}>
                        {roleTech.label}
                      </span>
                      {roleOps && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#3D5A8A', background: '#3D5A8A18', borderRadius: 10, padding: '1px 7px' }}>
                          {roleOps.label}
                        </span>
                      )}
                      {m.is_planning_member && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'white', background: m.planning_color || '#999', borderRadius: 10, padding: '1px 7px' }}>
                          Planning
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 3 }}>
                      {recrutement && <span style={{ fontSize: '0.67rem', color: 'var(--muted)' }}>📅 {recrutement}</span>}
                      {m.telephone && <span style={{ fontSize: '0.67rem', color: 'var(--muted)' }}>📞 {m.telephone}</span>}
                    </div>
                    {isAdmin && m.pin_code && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'monospace', letterSpacing: 3 }}>
                          {pinVisible ? m.pin_code : '••••'}
                        </span>
                        <button onClick={() => setShowPins(p => ({ ...p, [m.id]: !p[m.id] }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                          {pinVisible ? <EyeOff size={11}/> : <Eye size={11}/>}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    <button className="btn btn-outline btn-sm"
                      style={{ fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px' }}
                      onClick={() => setEditModal(m)}>
                      Modifier
                    </button>
                    {isAdmin && <>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.65rem', color: 'var(--muted)', padding: '4px 6px' }} onClick={() => resetPin(m)}>
                        🔄
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: m.actif === false ? 'var(--outside-green)' : 'var(--danger)' }}
                        title={m.actif === false ? 'Réactiver' : 'Désactiver'}
                        onClick={() => toggleActif(m)}>
                        {m.actif === false ? '✓' : '✕'}
                      </button>
                    </>}
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                Aucun membre {showInactive ? 'inactif' : 'actif'}
              </div>
            )}
          </div>
        )}
      </div>

      {modal    && <MemberModal onClose={() => setModal(false)} onSave={createMember} saving={saving} isNew />}
      {editModal && <MemberModal member={editModal} onClose={() => setEditModal(null)} onSave={(f) => updateMember(editModal, f)} saving={saving} />}
    </>
  )
}

// ── MODAL UNIFIÉ CRÉATION / ÉDITION ───────────────────────────────────────
function MemberModal({ member, onClose, onSave, saving, isNew }) {
  const [form, setForm] = useState({
    prenom:             member?.prenom            || '',
    nom:                member?.nom               || '',
    role:               member?.role              || 'barista',
    role_operationnel:  member?.role_operationnel || '',
    pin:                member?.pin_code          || generatePin(),
    planning_color:     member?.planning_color    || '#1A5C4A',
    is_planning_member: member?.is_planning_member ?? true,
    date_recrutement:   member?.date_recrutement  || '',
    telephone:          member?.telephone         || '',
  })
  const [error, setError] = useState(null)
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.prenom.trim()) { setError('Prénom obligatoire'); return }
    if (isNew && form.pin.length !== 4) { setError('PIN doit être 4 chiffres'); return }
    const r = await onSave(form)
    if (r?.error) setError(r.error.message || 'Erreur')
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Nouveau membre' : `Modifier — ${member?.name}`}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saving ? <Spinner size={16}/> : <Save size={15}/>} {isNew ? 'Créer' : 'Enregistrer'}
        </button>
      </>}>

      {error && <div style={{ background: '#FDEEEC', color: 'var(--danger)', padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: '0.82rem' }}>{error}</div>}

      {/* NOM PRÉNOM */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Prénom *</label>
          <input className="form-input" value={form.prenom} onChange={e => set('prenom', e.target.value)} autoFocus />
        </div>
        <div className="form-group"><label className="form-label">Nom</label>
          <input className="form-input" value={form.nom} onChange={e => set('nom', e.target.value)} />
        </div>
      </div>

      {/* RÔLES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Rôle technique</label>
          <select className="form-select" value={form.role} onChange={e => set('role', e.target.value)}>
            {ROLES_TECH.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Rôle opérationnel</label>
          <select className="form-select" value={form.role_operationnel} onChange={e => set('role_operationnel', e.target.value)}>
            <option value="">— Non défini —</option>
            {ROLES_OPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* DATE + TÉLÉPHONE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Date de recrutement</label>
          <input className="form-input" type="date" value={form.date_recrutement} onChange={e => set('date_recrutement', e.target.value)} />
        </div>
        <div className="form-group"><label className="form-label">Téléphone</label>
          <input className="form-input" type="tel" value={form.telephone} onChange={e => set('telephone', e.target.value)} placeholder="+216 XX XXX XXX"/>
        </div>
      </div>

      {/* PIN (création seulement) */}
      {isNew && (
        <div className="form-group"><label className="form-label">PIN (4 chiffres)</label>
          <input className="form-input" value={form.pin} maxLength={4}
            onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
            style={{ fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center', fontSize: '1.1rem' }}/>
        </div>
      )}

      {/* COULEUR PLANNING */}
      <div className="form-group">
        <label className="form-label">Couleur planning</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => set('planning_color', c)}
              style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: `3px solid ${form.planning_color === c ? 'var(--outside-dark)' : 'transparent'}`, cursor: 'pointer', padding: 0 }}/>
          ))}
          <input type="color" value={form.planning_color} onChange={e => set('planning_color', e.target.value)}
            style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', cursor: 'pointer', padding: 0 }}/>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: form.planning_color, border: '2px solid var(--outside-cream2)', flexShrink: 0 }}/>
        </div>
      </div>

      {/* PLANNING */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" id="isPlan" checked={form.is_planning_member}
          onChange={e => set('is_planning_member', e.target.checked)} style={{ width: 16, height: 16 }}/>
        <label htmlFor="isPlan" style={{ fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
          Inclure dans le planning des horaires
        </label>
      </div>
    </Modal>
  )
}
