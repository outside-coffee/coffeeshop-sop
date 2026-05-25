import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Badge, Modal } from '../components/UI'
import { ChevronDown, ChevronUp, Star, Save, Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── DÉFINITION DES RÔLES ─────────────────────────────────────────────────
const ROLES_DEF = {
  manager: {
    label:    'Manager',
    color:    '#C4521A',
    bg:       '#FEF3DC',
    icon:     '🎯',
    missions: [
      'Gestion et supervision de l\'équipe',
      'Contrôle du stock et des commandes',
      'Supervision générale des opérations',
      'Contrôle de l\'application des process SOP',
      'Suivi des performances et des écarts',
      'Gestion des plannings et évaluations',
    ],
    skills: ['Leadership', 'Organisation', 'Rigueur', 'Communication', 'Analyse'],
  },
  barista: {
    label:    'Barista',
    color:    '#1A5C4A',
    bg:       '#E0F2EB',
    icon:     '☕',
    missions: [
      'Préparation des boissons selon les standards Outside',
      'Gestion du bar et du matériel',
      'Encaissement et gestion caisse',
      'Service client et cross-selling',
      'Respect des normes d\'hygiène',
    ],
    skills: ['Technique café', 'Rapidité', 'Propreté', 'Accueil', 'Caisse'],
  },
  service_crew: {
    label:    'Service Crew',
    color:    '#3D5A8A',
    bg:       '#EBF2FD',
    icon:     '🤝',
    missions: [
      'Accueil et installation des clients',
      'Service en salle',
      'Support bar en rush',
      'Entretien de la salle',
    ],
    skills: ['Accueil', 'Rapidité', 'Présentation', 'Communication'],
  },
  support_crew: {
    label:    'Support Crew',
    color:    '#8B6B8A',
    bg:       '#F5EFF5',
    icon:     '🧹',
    missions: [
      'Nettoyage et hygiène des espaces',
      'Organisation et rangement',
      'Réassort bar et salle',
      'Support général de l\'équipe',
    ],
    skills: ['Rigueur', 'Propreté', 'Organisation', 'Réactivité'],
  },
}

// ── CRITÈRES D'ÉVALUATION ────────────────────────────────────────────────
const EVAL_CRITERIA = [
  { id: 'ponctualite',   label: 'Ponctualité & tenue',       max: 20 },
  { id: 'qualite',       label: 'Qualité du travail',        max: 20 },
  { id: 'accueil',       label: 'Accueil & relation client', max: 20 },
  { id: 'proprete',      label: 'Propreté du poste',         max: 15 },
  { id: 'hygiene',       label: 'Respect protocoles hygiène',max: 15 },
  { id: 'equipe',        label: 'Esprit d\'équipe',          max: 10 },
]

// Membres de l'équipe Outside
const TEAM = [
  { name: 'Youssef F',       role: 'manager',      poste: 'Manager' },
  { name: 'Wassim',          role: 'barista',       poste: 'Barista' },
  { name: 'Hamza',           role: 'barista',       poste: 'Barista' },
  { name: 'Chahad',          role: 'service_crew',  poste: 'Service Crew' },
  { name: 'Hachem',          role: 'support_crew',  poste: 'Support Crew' },
  { name: 'Youssef',         role: 'support_crew',  poste: 'Support Crew' },
]

export default function Staff() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')

  const [tab, setTab]               = useState('org')   // 'org' | 'roles' | 'eval'
  const [expandedRole, setExpandedRole] = useState(null)
  const [evalModal, setEvalModal]   = useState(null)    // membre sélectionné
  const [evals, setEvals]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [period, setPeriod]         = useState(format(new Date(), 'yyyy-MM'))

  useEffect(() => { if (tab === 'eval') loadEvals() }, [tab, period])

  async function loadEvals() {
    setLoading(true)
    const { data } = await supabase
      .from('staff_evaluations')
      .select('*')
      .eq('period', period)
    setEvals(data || [])
    setLoading(false)
  }

  async function saveEval(evalData) {
    const existing = evals.find(e => e.staff_name === evalData.staff_name && e.period === period)
    if (existing) {
      await supabase.from('staff_evaluations').update({ ...evalData, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('staff_evaluations').insert({ ...evalData, period, evaluator_id: profile.id })
    }
    await loadEvals()
    setEvalModal(null)
  }

  const totalMax = EVAL_CRITERIA.reduce((s, c) => s + c.max, 0)

  function getEvalColor(score, max) {
    const pct = score / max * 100
    if (pct >= 85) return '#1A5C4A'
    if (pct >= 70) return '#D4892A'
    return '#B03A1A'
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Organisation & Staff</h1>
        <p className="page-subtitle">Outside — Équipe & évaluations</p>
      </div>

      <div className="page-content">

        {/* TABS */}
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn${tab === 'org'      ? ' active' : ''}`} onClick={() => setTab('org')}>Équipe</button>
          <button className={`tab-btn${tab === 'roles'    ? ' active' : ''}`} onClick={() => setTab('roles')}>Rôles</button>
          {isManager && <button className={`tab-btn${tab === 'planning' ? ' active' : ''}`} onClick={() => setTab('planning')}>Planning</button>}
          {isManager && <button className={`tab-btn${tab === 'eval'     ? ' active' : ''}`} onClick={() => setTab('eval')}>Évaluation</button>}
        </div>

        {/* ── ONGLET ÉQUIPE ──────────────────────────────────────── */}
        {tab === 'org' && (
          <>
            {/* ORGANIGRAMME */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="section-label">Organigramme</div>

              {/* Manager */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <MemberCard member={TEAM[0]} />
              </div>

              {/* Ligne de connexion */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
                <div style={{ width: 2, height: 20, background: 'var(--outside-cream2)' }} />
              </div>

              {/* Baristas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.75rem' }}>
                {TEAM.filter(m => m.role === 'barista').map(m => <MemberCard key={m.name} member={m} />)}
              </div>

              {/* Service & Support */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                {['service_crew', 'support_crew'].map(role => {
                  const members = TEAM.filter(m => m.role === role)
                  const rd = ROLES_DEF[role]
                  return (
                    <div key={role} className="card" style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1rem' }}>{rd.icon}</span>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: rd.color }}>{rd.label}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {members.map(m => (
                          <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: rd.bg, padding: '4px 10px', borderRadius: 'var(--radius-pill)' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: rd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'white' }}>
                              {m.name.charAt(0)}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.82rem', color: rd.color }}>{m.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* LISTE DÉTAILLÉE */}
            <div className="section-label">Fiches membres</div>
            <div className="card">
              {TEAM.map((member, idx) => {
                const rd = ROLES_DEF[member.role]
                return (
                  <div key={member.name} style={{ padding: '0.85rem 1rem', borderBottom: idx < TEAM.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: rd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {member.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{member.name}</div>
                      <div style={{ fontSize: '0.72rem', color: rd.color, fontWeight: 700, marginTop: '1px' }}>{rd.label}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', background: rd.bg, color: rd.color, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 700 }}>
                      {rd.icon}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── ONGLET RÔLES ───────────────────────────────────────── */}
        {tab === 'roles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(ROLES_DEF).map(([key, rd]) => {
              const isOpen = expandedRole === key
              const members = TEAM.filter(m => m.role === key)
              return (
                <div key={key} className="card">
                  <div style={{ padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                    onClick={() => setExpandedRole(isOpen ? null : key)}>
                    <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: rd.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                      {rd.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: rd.color }}>{rd.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '1px' }}>
                        {members.map(m => m.name).join(' · ')}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
                  </div>

                  {isOpen && (
                    <div style={{ borderTop: '1.5px solid var(--outside-cream)', padding: '1rem' }}>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '6px' }}>Missions</div>
                        {rd.missions.map((m, i) => (
                          <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', fontSize: '0.875rem', alignItems: 'flex-start' }}>
                            <span style={{ color: rd.color, fontWeight: 800, flexShrink: 0 }}>→</span>
                            <span style={{ fontWeight: 600 }}>{m}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '6px' }}>Compétences clés</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {rd.skills.map(s => (
                            <span key={s} style={{ background: rd.bg, color: rd.color, padding: '3px 10px', borderRadius: 'var(--radius-pill)', fontSize: '0.78rem', fontWeight: 700 }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── ONGLET ÉVALUATION (manager) ────────────────────────── */}
        {tab === 'planning' && isManager && <PlanningTab />}
        {tab === 'eval' && isManager && (
          <>
            {/* SÉLECTEUR PÉRIODE */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', alignItems: 'center' }}>
              <button className="btn btn-ghost btn-sm"
                onClick={() => setPeriod(p => format(new Date(new Date(p + '-01').setMonth(new Date(p + '-01').getMonth() - 1)), 'yyyy-MM'))}>←</button>
              <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
                className="form-input" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }} />
              <button className="btn btn-ghost btn-sm"
                onClick={() => setPeriod(p => format(new Date(new Date(p + '-01').setMonth(new Date(p + '-01').getMonth() + 1)), 'yyyy-MM'))}>→</button>
            </div>

            {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TEAM.map(member => {
                  const rd   = ROLES_DEF[member.role]
                  const eval_ = evals.find(e => e.staff_name === member.name)
                  const score = eval_ ? EVAL_CRITERIA.reduce((s, c) => s + (eval_[c.id] || 0), 0) : null

                  return (
                    <div key={member.name} className="card" style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: rd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                          {member.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{member.name}</div>
                          <div style={{ fontSize: '0.72rem', color: rd.color, fontWeight: 700 }}>{rd.label}</div>
                        </div>
                        {score !== null ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 400, color: getEvalColor(score, totalMax), lineHeight: 1 }}>{score}<span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>/{totalMax}</span></div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: getEvalColor(score, totalMax) }}>
                              {score/totalMax >= 0.85 ? 'Excellent' : score/totalMax >= 0.70 ? 'Bien' : 'À améliorer'}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>Non évalué</div>
                        )}
                        <button className="btn btn-primary btn-sm" onClick={() => setEvalModal({ member, existing: eval_ })}>
                          {eval_ ? '✎' : <><Plus size={12} /> Évaluer</>}
                        </button>
                      </div>

                      {/* BARRE SCORE */}
                      {score !== null && (
                        <div style={{ marginTop: '8px' }}>
                          <div className="progress" style={{ height: 6 }}>
                            <div className="progress-bar" style={{ width: `${score/totalMax*100}%`, background: getEvalColor(score, totalMax) }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL ÉVALUATION */}
      {evalModal && (
        <EvalModal
          member={evalModal.member}
          existing={evalModal.existing}
          period={period}
          onClose={() => setEvalModal(null)}
          onSave={saveEval}
        />
      )}
    </>
  )
}

function MemberCard({ member }) {
  const rd = ROLES_DEF[member.role]
  return (
    <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: rd.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
        {member.name.charAt(0)}
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: '0.875rem' }}>{member.name}</div>
        <div style={{ fontSize: '0.68rem', color: rd.color, fontWeight: 700 }}>{rd.icon} {rd.label}</div>
      </div>
    </div>
  )
}

function EvalModal({ member, existing, period, onClose, onSave }) {
  const rd = ROLES_DEF[member.role]
  const init = {}
  EVAL_CRITERIA.forEach(c => { init[c.id] = existing?.[c.id] ?? 0 })
  const [scores, setScores] = useState(init)
  const [notes, setNotes]   = useState(existing?.notes || '')
  const [saving, setSaving] = useState(false)

  const total = EVAL_CRITERIA.reduce((s, c) => s + (scores[c.id] || 0), 0)
  const max   = EVAL_CRITERIA.reduce((s, c) => s + c.max, 0)

  async function handleSave() {
    setSaving(true)
    await onSave({ staff_name: member.name, staff_role: member.role, ...scores, notes, total })
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose}
      title={`Évaluation — ${member.name}`}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>

      <div style={{ fontSize: '0.72rem', color: rd.color, fontWeight: 700, marginBottom: '1rem' }}>
        {rd.icon} {rd.label} · {format(new Date(period + '-01'), 'MMMM yyyy', { locale: fr })}
      </div>

      {/* SCORES */}
      {EVAL_CRITERIA.map(c => (
        <div key={c.id} style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700 }}>{c.label}</label>
            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--outside-orange)' }}>{scores[c.id]}/{c.max}</span>
          </div>
          <input type="range" min="0" max={c.max} step="1"
            value={scores[c.id]}
            onChange={e => setScores(p => ({ ...p, [c.id]: parseInt(e.target.value) }))}
            style={{ width: '100%', accentColor: 'var(--outside-orange)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--muted)' }}>
            <span>0</span><span>{c.max}</span>
          </div>
        </div>
      ))}

      {/* TOTAL */}
      <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '10px 14px', margin: '0.75rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700 }}>Score total</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: total/max >= 0.85 ? '#1A5C4A' : total/max >= 0.70 ? '#D4892A' : '#B03A1A' }}>
          {total}/{max}
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: 6 }}>({Math.round(total/max*100)}%)</span>
        </span>
      </div>

      {/* NOTE */}
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Commentaire</label>
        <textarea className="form-textarea" rows={3} placeholder="Points forts, axes d'amélioration..."
          value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
    </Modal>
  )
}

// ── PLANNING TAB ──────────────────────────────────────────────────────────
const TEAM_COLORS = {
  'Youssef F': '#2E7D4F',
  'Wassim':    '#4A3D8F',
  'Hamza':     '#C4521A',
  'Chahad':    '#C0392B',
  'Hachem':    '#7B4F9E',
  'Youssef':   '#2980B9',
}
const TEAM_NAMES = Object.keys(TEAM_COLORS)

const SLOTS_MATIN = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00']
const SLOTS_SOIR  = ['16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00','00:00']
const ALL_SLOTS   = [...SLOTS_MATIN, ...SLOTS_SOIR]

const ROLES_MAIN = [
  { value: 'barista_lead',  label: 'Barista Lead',  color: '#C4521A' },
  { value: 'barista',       label: 'Barista',        color: '#1A5C4A' },
  { value: 'service_crew',  label: 'Service Crew',   color: '#3D5A8A' },
  { value: 'support_crew',  label: 'Support Crew',   color: '#8B6B8A' },
]
const ROLES_EXTRA = [
  { value: 'caisse_matin',  label: 'Caisse Matin',   color: '#1565C0' },
  { value: 'caisse_soir',   label: 'Caisse Soir',    color: '#00838F' },
]
const DAYS_FR = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

function PlanningTab() {
  const { profile } = useAuth()
  const [weekOffset, setWeekOffset] = useState(0)
  const [data, setData]             = useState({ shifts: {}, roles: {} })
  const [loading, setLoading]       = useState(true)
  const [picker, setPicker]         = useState(null)   // { date, slot }
  const [rolePicker, setRolePicker] = useState(null)   // { date, staff }
  const [quickStaff, setQuickStaff] = useState(null)   // staff pour mode rapide

  const today    = new Date()
  const monday   = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), weekOffset)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const weekLabel = `${format(monday, 'd MMM', { locale: fr })} — ${format(weekDays[6], 'd MMM yyyy', { locale: fr })}`

  useEffect(() => { load() }, [weekOffset])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase.from('planning_shifts').select('*')
      .gte('shift_date', format(monday, 'yyyy-MM-dd'))
      .lte('shift_date', format(weekDays[6], 'yyyy-MM-dd'))
    const shifts = {}, roles = {}
    for (const r of (rows || [])) {
      if (r.shift_type.startsWith('role|')) {
        // role|matin|barista_lead or role|matin|caisse_matin (extra)
        const parts = r.shift_type.split('|')
        const period = parts[1], roleVal = parts[2]
        const key = `${r.shift_date}|${r.staff_name}|${period}`
        if (!roles[key]) roles[key] = { main: null, extras: [] }
        const isExtra = ROLES_EXTRA.some(e => e.value === roleVal)
        if (isExtra) { if (!roles[key].extras.includes(roleVal)) roles[key].extras.push(roleVal) }
        else roles[key].main = roleVal
      } else {
        const key = `${r.shift_date}|${r.shift_type}`
        if (!shifts[key]) shifts[key] = []
        if (!shifts[key].includes(r.staff_name)) shifts[key].push(r.staff_name)
      }
    }
    setData({ shifts, roles })
    setLoading(false)
  }

  async function toggleStaff(staffName, date, slot) {
    const key     = `${date}|${slot}`
    const present = data.shifts[key] || []
    const isOn    = present.includes(staffName)

    // Mise à jour locale IMMÉDIATE (pas d'attente Supabase)
    setData(prev => {
      const cur = prev.shifts[key] || []
      const next = isOn ? cur.filter(n => n !== staffName) : [...cur, staffName]
      return { ...prev, shifts: { ...prev.shifts, [key]: next } }
    })

    // Sync Supabase en arrière-plan
    if (isOn) {
      supabase.from('planning_shifts').delete()
        .eq('staff_name', staffName).eq('shift_date', date).eq('shift_type', slot)
        .then(() => {})
    } else {
      supabase.from('planning_shifts').upsert(
        { staff_name: staffName, shift_date: date, shift_type: slot, created_by: profile?.id, updated_at: new Date().toISOString() },
        { onConflict: 'staff_name,shift_date,shift_type' }
      ).then(() => {})
    }
  }

  async function setRoleValue(staffName, date, period, roleVal, isExtra) {
    const key = `${date}|${staffName}|${period}`
    const shiftType = `role|${period}|${roleVal}`
    // Toggle extra (checkbox), replace main (radio)
    const current = data.roles[key] || { main: null, extras: [] }
    if (isExtra) {
      const hasIt = current.extras.includes(roleVal)
      if (hasIt) {
        await supabase.from('planning_shifts').delete()
          .eq('staff_name', staffName).eq('shift_date', date).eq('shift_type', shiftType)
        setData(prev => { const r = {...(prev.roles[key] || {main:null,extras:[]})}; r.extras = r.extras.filter(e=>e!==roleVal); return { ...prev, roles: { ...prev.roles, [key]: r } } })
      } else {
        await supabase.from('planning_shifts').upsert({ staff_name: staffName, shift_date: date, shift_type: shiftType, created_by: profile?.id }, { onConflict: 'staff_name,shift_date,shift_type' })
        setData(prev => { const r = {...(prev.roles[key] || {main:null,extras:[]})}; r.extras = [...r.extras, roleVal]; return { ...prev, roles: { ...prev.roles, [key]: r } } })
      }
    } else {
      // Delete old main role for this period, set new
      await supabase.from('planning_shifts').delete()
        .eq('staff_name', staffName).eq('shift_date', date)
        .in('shift_type', ROLES_MAIN.map(r => `role|${period}|${r.value}`))
      if (current.main !== roleVal) {
        await supabase.from('planning_shifts').upsert({ staff_name: staffName, shift_date: date, shift_type: shiftType, created_by: profile?.id }, { onConflict: 'staff_name,shift_date,shift_type' })
        setData(prev => { const r = {...(prev.roles[key] || {main:null,extras:[]})}; r.main = roleVal; return { ...prev, roles: { ...prev.roles, [key]: r } } })
      } else {
        setData(prev => { const r = {...(prev.roles[key] || {main:null,extras:[]})}; r.main = null; return { ...prev, roles: { ...prev.roles, [key]: r } } })
      }
    }
    setRolePicker(null)
  }

  async function copierSemainePrecedente() {
    const prevMonday = subWeeks(monday, 1)
    const prevDays   = Array.from({ length: 7 }, (_, i) => addDays(prevMonday, i))
    const { data: rows } = await supabase.from('planning_shifts').select('*')
      .gte('shift_date', format(prevMonday, 'yyyy-MM-dd'))
      .lte('shift_date', format(prevDays[6], 'yyyy-MM-dd'))
    if (!rows?.length) { alert('Aucun planning la semaine précédente'); return }
    for (const { id, created_at, shift_date, ...r } of rows) {
      await supabase.from('planning_shifts').upsert({
        ...r, shift_date: format(addDays(new Date(shift_date+'T00:00:00'), 7), 'yyyy-MM-dd'),
        created_by: profile?.id, updated_at: new Date().toISOString()
      }, { onConflict: 'staff_name,shift_date,shift_type' })
    }
    load()
  }

  function downloadCSV() {
    const rows = [['Horaire', ...weekDays.map(d => format(d,'EEE d/MM',{locale:fr}))]]
    ALL_SLOTS.forEach(slot => {
      const row = [slot]
      weekDays.forEach(d => {
        const present = data.shifts[`${format(d,'yyyy-MM-dd')}|${slot}`] || []
        row.push(present.join(' + ') || '')
      })
      rows.push(row)
    })
    const csv  = rows.map(r => r.map(c => '"' + String(c) + '"').join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `planning_${format(monday,'dd-MM-yyyy')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* NAV SEMAINE */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:'1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setWeekOffset(o=>o-1)}><ChevronLeft size={16}/></button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:'0.875rem' }}>{weekLabel}</div>
          <div style={{ display:'flex', justifyContent:'center', gap:4, marginTop:4 }}>
            {[-1,0,1,2,3].map(w=>(
              <button key={w} className={`btn btn-sm ${weekOffset===w?'btn-primary':'btn-outline'}`}
                style={{ padding:'2px 8px', fontSize:'0.7rem' }} onClick={()=>setWeekOffset(w)}>
                {w===0?'Cette sem.':w===-1?'S-1':`S+${w}`}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={()=>setWeekOffset(o=>o+1)}><ChevronRight size={16}/></button>
      </div>

      {/* ACTIONS */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem', gap:8, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {TEAM_NAMES.map(name=>(
            <button key={name} onClick={()=>setQuickStaff(quickStaff===name?null:name)}
              style={{ padding:'4px 10px', borderRadius:'var(--radius-pill)', border:`2px solid ${TEAM_COLORS[name]}`,
                background: quickStaff===name ? TEAM_COLORS[name] : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background: quickStaff===name?'white':TEAM_COLORS[name] }}/>
              <span style={{ fontSize:'0.7rem', fontWeight:700, color: quickStaff===name?'white':TEAM_COLORS[name] }}>{name}</span>
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn btn-outline btn-sm" onClick={copierSemainePrecedente}>↩ S-1</button>
          <button className="btn btn-outline btn-sm" onClick={downloadCSV}><Download size={13}/> CSV</button>
        </div>
      </div>

      {quickStaff && (
        <div style={{ background:'var(--outside-green)', color:'white', padding:'6px 12px', borderRadius:'var(--radius-md)', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.82rem', fontWeight:700 }}>
          <span>Cliquer les créneaux pour <strong>{quickStaff}</strong></span>
          <button onClick={()=>setQuickStaff(null)} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:4, color:'white', cursor:'pointer', padding:'2px 8px' }}>✕ Fin</button>
        </div>
      )}

      {/* GRILLE HORAIRE */}
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><Spinner size={24}/></div> : (
        <div style={{ overflowX:'auto', marginLeft:'-1rem', marginRight:'-1rem' }}>
          <div style={{ minWidth:520, paddingLeft:'1rem', paddingRight:'1rem' }}>

            {/* HEADER JOURS */}
            <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', gap:2, marginBottom:2, position:'sticky', top:0, background:'var(--outside-cream)', zIndex:10, paddingTop:2, paddingBottom:2 }}>
              <div/>
              {weekDays.map((d,i)=>(
                <div key={i} style={{ textAlign:'center', padding:'3px 2px', borderRadius:'var(--radius-sm)', background:isToday(d)?'var(--outside-dark)':'white', border:'1px solid var(--outside-cream2)' }}>
                  <div style={{ fontSize:'0.58rem', fontWeight:800, textTransform:'uppercase', color:isToday(d)?'var(--outside-amber)':'var(--muted)' }}>{DAYS_FR[i]}</div>
                  <div style={{ fontSize:'0.78rem', fontWeight:800, color:isToday(d)?'white':'var(--outside-dark)' }}>{format(d,'d')}</div>
                </div>
              ))}
            </div>

            {/* CRÉNEAUX MATIN + SOIR */}
            <div style={{ fontSize:'0.6rem', fontWeight:800, textTransform:'uppercase', color:'var(--outside-orange)', padding:'4px 0 2px 0' }}>— Matin</div>

            {ALL_SLOTS.map((slot, slotIdx) => (
              <div key={slot}>
                {slotIdx === SLOTS_MATIN.length && (
                  <div style={{ fontSize:'0.6rem', fontWeight:800, textTransform:'uppercase', color:'var(--outside-orange)', padding:'6px 0 2px 0' }}>— Soir</div>
                )}
                <div style={{ display:'grid', gridTemplateColumns:'52px repeat(7,1fr)', gap:2, marginBottom:1 }}>
                  <div style={{ fontSize:'0.58rem', color:'var(--muted)', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5, borderRight:'2px solid var(--outside-cream2)' }}>
                    {slot}
                  </div>
                  {weekDays.map((d, di) => {
                    const dateStr = format(d,'yyyy-MM-dd')
                    const key     = `${dateStr}|${slot}`
                    const present = data.shifts[key] || []
                    const isOpen  = picker?.date===dateStr && picker?.slot===slot
                    const qActive = quickStaff && present.includes(quickStaff)
                    const border  = qActive ? TEAM_COLORS[quickStaff] : isOpen ? 'var(--outside-orange)' : quickStaff ? 'var(--outside-amber)' : 'var(--outside-cream2)'
                    return (
                      <div key={di} style={{ position:'relative' }}>
                        <div
                          onClick={() => {
                            if (quickStaff) {
                              toggleStaff(quickStaff, dateStr, slot)
                            } else {
                              setPicker(isOpen ? null : { date: dateStr, slot })
                            }
                          }}
                          style={{ height:32, borderRadius:4, border:`1.5px solid ${border}`, background:present.length>0?'white':'#FAFAFA', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:2, padding:'0 2px', overflow:'hidden' }}>
                          {present.length===0 ? (
                            <span style={{ fontSize:'0.6rem', color:'var(--outside-cream2)' }}>·</span>
                          ) : present.map(name=>(
                            <div key={name} title={name} style={{ width:16, height:16, borderRadius:'50%', background:TEAM_COLORS[name]||'#999', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.5rem', fontWeight:900, color:'white' }}>
                              {name.charAt(0)}
                            </div>
                          ))}
                        </div>
                        {isOpen && !quickStaff && (
                          <div style={{ position:'absolute', top:34, left:'50%', transform:'translateX(-50%)', zIndex:300, background:'var(--outside-dark)', borderRadius:'var(--radius-lg)', padding:'8px', boxShadow:'var(--shadow-lg)', minWidth:130 }}>
                            <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', fontWeight:800, textAlign:'center', marginBottom:6, textTransform:'uppercase' }}>{slot}</div>
                            {Object.keys(TEAM_COLORS).map(name => {
                              const isOn = present.includes(name)
                              return (
                                <button key={name} onClick={e=>{e.stopPropagation();toggleStaff(name,dateStr,slot)}}
                                  style={{ width:'100%', padding:'5px 8px', borderRadius:'var(--radius-md)', border:'none', background:isOn?TEAM_COLORS[name]:'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:7, marginBottom:2 }}>
                                  <div style={{ width:10, height:10, borderRadius:'50%', background:isOn?'white':TEAM_COLORS[name], border:isOn?'2px solid rgba(255,255,255,0.5)':'none', flexShrink:0 }}/>
                                  <span style={{ fontSize:'0.78rem', fontWeight:isOn?800:600, color:isOn?'white':'rgba(255,255,255,0.6)' }}>{name}</span>
                                  {isOn && <span style={{marginLeft:'auto',color:'white',fontSize:'0.7rem'}}>✓</span>}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {picker && <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={()=>setPicker(null)}/>}
      {rolePicker && <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={()=>setRolePicker(null)}/>}

      {/* RÔLES PAR SHIFT */}
      {!loading && (
        <div style={{ marginTop:'1.25rem' }}>
          <div className="section-label">Rôles par shift</div>
          <div style={{ overflowX:'auto', marginLeft:'-1rem', marginRight:'-1rem', paddingLeft:'1rem', paddingRight:'1rem' }}>
            <div style={{ minWidth:520 }}>
              <div style={{ display:'grid', gridTemplateColumns:'85px repeat(7,1fr)', gap:2, marginBottom:4 }}>
                <div/>
                {weekDays.map((d,i)=>(
                  <div key={i} style={{ textAlign:'center', fontSize:'0.62rem', fontWeight:800, color:isToday(d)?'var(--outside-orange)':'var(--muted)' }}>
                    {DAYS_FR[i]} {format(d,'d')}
                  </div>
                ))}
              </div>

              {TEAM_NAMES.map(name=>(
                <div key={name} style={{ display:'grid', gridTemplateColumns:'85px repeat(7,1fr)', gap:2, marginBottom:3, alignItems:'start' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, paddingTop:4 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:TEAM_COLORS[name] }}/>
                    <span style={{ fontSize:'0.7rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
                  </div>
                  {weekDays.map((d,di)=>{
                    const dateStr   = format(d,'yyyy-MM-dd')
                    const rKeyM     = `${dateStr}|${name}|matin`
                    const rKeyS     = `${dateStr}|${name}|soir`
                    const roleM     = data.roles[rKeyM] || { main:null, extras:[] }
                    const roleS     = data.roles[rKeyS] || { main:null, extras:[] }
                    const isOpen    = rolePicker?.date===dateStr && rolePicker?.staff===name
                    return (
                      <div key={di} style={{ position:'relative' }}>
                        <div onClick={()=>setRolePicker(isOpen?null:{date:dateStr,staff:name})}
                          style={{ borderRadius:4, border:`1.5px solid ${isOpen?'var(--outside-orange)':'var(--outside-cream2)'}`, background:'white', cursor:'pointer', overflow:'hidden', minHeight:50 }}>

                          {/* MATIN */}
                          <div style={{ padding:'3px 4px', borderBottom:'1px solid var(--outside-cream2)', background: roleM.main ? (ROLES_MAIN.find(r=>r.value===roleM.main)?.color+'18') : 'transparent' }}>
                            <div style={{ fontSize:'0.47rem', fontWeight:800, color:'var(--muted)', textTransform:'uppercase' }}>Matin</div>
                            <div style={{ fontSize:'0.6rem', fontWeight:800, color: roleM.main ? ROLES_MAIN.find(r=>r.value===roleM.main)?.color : 'var(--outside-cream2)', lineHeight:1.2 }}>
                              {roleM.main ? ROLES_MAIN.find(r=>r.value===roleM.main)?.label : '—'}
                            </div>
                            {roleM.extras.map(e=>(
                              <div key={e} style={{ fontSize:'0.5rem', fontWeight:700, color: ROLES_EXTRA.find(r=>r.value===e)?.color }}>
                                + {ROLES_EXTRA.find(r=>r.value===e)?.label}
                              </div>
                            ))}
                          </div>

                          {/* SOIR */}
                          <div style={{ padding:'3px 4px', background: roleS.main ? (ROLES_MAIN.find(r=>r.value===roleS.main)?.color+'18') : 'transparent' }}>
                            <div style={{ fontSize:'0.47rem', fontWeight:800, color:'var(--muted)', textTransform:'uppercase' }}>Soir</div>
                            <div style={{ fontSize:'0.6rem', fontWeight:800, color: roleS.main ? ROLES_MAIN.find(r=>r.value===roleS.main)?.color : 'var(--outside-cream2)', lineHeight:1.2 }}>
                              {roleS.main ? ROLES_MAIN.find(r=>r.value===roleS.main)?.label : '—'}
                            </div>
                            {roleS.extras.map(e=>(
                              <div key={e} style={{ fontSize:'0.5rem', fontWeight:700, color: ROLES_EXTRA.find(r=>r.value===e)?.color }}>
                                + {ROLES_EXTRA.find(r=>r.value===e)?.label}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ROLE PICKER */}
                        {isOpen && (
                          <div style={{ position:'absolute', top:54, left:0, zIndex:300, background:'var(--outside-dark)', borderRadius:'var(--radius-lg)', padding:'8px', boxShadow:'var(--shadow-lg)', minWidth:160 }}>
                            {['matin','soir'].map(period=>{
                              const rKey = `${dateStr}|${name}|${period}`
                              const role = data.roles[rKey] || { main:null, extras:[] }
                              return (
                                <div key={period}>
                                  <div style={{ fontSize:'0.6rem', color:'rgba(255,255,255,0.4)', fontWeight:800, textTransform:'uppercase', marginBottom:3, marginTop: period==='soir'?8:0 }}>
                                    {period === 'matin' ? '☀ Shift Matin' : '🌙 Shift Soir'}
                                  </div>
                                  {ROLES_MAIN.map(r=>(
                                    <button key={r.value} onClick={e=>{e.stopPropagation();setRoleValue(name,dateStr,period,r.value,false)}}
                                      style={{ width:'100%', padding:'4px 8px', borderRadius:4, border:'none', background:role.main===r.value?r.color:'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                                      <div style={{ width:8, height:8, borderRadius:'50%', background:r.color, border:'1px solid rgba(255,255,255,0.3)', flexShrink:0 }}/>
                                      <span style={{ fontSize:'0.72rem', fontWeight:600, color:role.main===r.value?'white':'rgba(255,255,255,0.7)' }}>{r.label}</span>
                                      {role.main===r.value && <span style={{marginLeft:'auto',color:'white',fontSize:'0.7rem'}}>✓</span>}
                                    </button>
                                  ))}
                                  <div style={{ borderTop:'1px solid rgba(255,255,255,0.1)', marginTop:4, paddingTop:4 }}>
                                    {ROLES_EXTRA.map(r=>(
                                      <button key={r.value} onClick={e=>{e.stopPropagation();setRoleValue(name,dateStr,period,r.value,true)}}
                                        style={{ width:'100%', padding:'3px 8px', borderRadius:4, border:'none', background:role.extras.includes(r.value)?r.color:'transparent', cursor:'pointer', display:'flex', alignItems:'center', gap:6, marginBottom:1 }}>
                                        <div style={{ width:12, height:12, borderRadius:3, background:'transparent', border:`1.5px solid ${r.color}`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                          {role.extras.includes(r.value) && <span style={{ fontSize:'0.5rem', color:'white' }}>✓</span>}
                                        </div>
                                        <span style={{ fontSize:'0.7rem', fontWeight:600, color:role.extras.includes(r.value)?'white':'rgba(255,255,255,0.7)' }}>{r.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RÉCAP */}
      {!loading && (
        <div style={{ marginTop:'1.25rem' }}>
          <div className="section-label">Récap semaine</div>
          <div className="card">
            <div style={{ display:'grid', gridTemplateColumns:'85px 1fr repeat(7,28px)', gap:4, padding:'5px 1rem', background:'var(--outside-cream)', borderBottom:'1.5px solid var(--outside-cream2)', fontSize:'0.58rem', fontWeight:800, textTransform:'uppercase', color:'var(--muted)' }}>
              <div>Employé</div><div/>
              {weekDays.map((d,i)=><div key={i} style={{textAlign:'center'}}>{DAYS_FR[i]}</div>)}
            </div>
            {TEAM_NAMES.map((name,idx)=>{
              const dayHours = weekDays.map(d=>{
                const dateStr = format(d,'yyyy-MM-dd')
                return ALL_SLOTS.filter(s=>(data.shifts[`${dateStr}|${s}`]||[]).includes(name)).length
              })
              const total = dayHours.reduce((a,b)=>a+b,0)
              return (
                <div key={name} style={{ display:'grid', gridTemplateColumns:'85px 1fr repeat(7,28px)', gap:4, padding:'6px 1rem', borderBottom:idx<TEAM_NAMES.length-1?'1.5px solid var(--outside-cream)':'none', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:TEAM_COLORS[name] }}/>
                    <span style={{ fontSize:'0.75rem', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</span>
                  </div>
                  <div style={{ height:4, background:'var(--outside-cream2)', borderRadius:2, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${total/20*100}%`, background:TEAM_COLORS[name], borderRadius:2 }}/>
                  </div>
                  {dayHours.map((h,i)=>(
                    <div key={i} style={{ textAlign:'center', fontSize:'0.7rem', fontWeight:h>0?800:400, color:h>0?TEAM_COLORS[name]:'var(--outside-cream2)', background:h>0?TEAM_COLORS[name]+'18':'transparent', borderRadius:4, padding:'1px 0' }}>
                      {h>0?`${h}h`:'—'}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
