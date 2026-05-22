import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Avatar, Badge, Modal } from '../components/UI'
import { ChevronDown, ChevronUp, Star, Save, Plus } from 'lucide-react'
import { format } from 'date-fns'
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
          <button className={`tab-btn${tab === 'org'   ? ' active' : ''}`} onClick={() => setTab('org')}>Équipe</button>
          <button className={`tab-btn${tab === 'roles' ? ' active' : ''}`} onClick={() => setTab('roles')}>Rôles</button>
          {isManager && <button className={`tab-btn${tab === 'eval'  ? ' active' : ''}`} onClick={() => setTab('eval')}>Évaluation</button>}
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
