import { useState, useEffect } from 'react'
import { Check, Plus, Trash2, X, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { format, subMonths, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale'

// ── TÂCHES ADMIN PAR DÉFAUT ─────────────────────────────────────────────
const DEFAULT_TASKS = [
  // Financier
  { category: 'Financier', label: 'Paiement loyer',           frequency: 'monthly',  day: 1  },
  { category: 'Financier', label: 'Paiement électricité',     frequency: 'monthly',  day: 5  },
  { category: 'Financier', label: 'Paiement eau & gaz',       frequency: 'monthly',  day: 5  },
  { category: 'Financier', label: 'Paiement fournisseurs',    frequency: 'weekly',   day: null },
  { category: 'Financier', label: 'Clôture caisse mensuelle', frequency: 'monthly',  day: 30 },
  { category: 'Financier', label: 'Virement salaires',        frequency: 'monthly',  day: 25 },
  // RH
  { category: 'RH',        label: 'Fiche de paie équipe',     frequency: 'monthly',  day: 28 },
  { category: 'RH',        label: 'Planning shifts mois suivant', frequency: 'monthly', day: 25 },
  { category: 'RH',        label: 'Évaluation mensuelle équipe',  frequency: 'monthly', day: 30 },
  // Administratif
  { category: 'Administratif', label: 'Déclaration CNSS',     frequency: 'monthly',  day: 15 },
  { category: 'Administratif', label: 'Déclaration TVA',       frequency: 'monthly',  day: 20 },
  { category: 'Administratif', label: 'Sauvegarde données caisse', frequency: 'weekly', day: null },
  // Opérationnel
  { category: 'Opérationnel', label: 'Commande café mensuelle',  frequency: 'monthly', day: 20 },
  { category: 'Opérationnel', label: 'Commande sirops & pâtes',  frequency: 'monthly', day: 20 },
  { category: 'Opérationnel', label: 'Nettoyage machine espresso', frequency: 'weekly', day: null },
  { category: 'Opérationnel', label: 'Révision du menu',          frequency: 'monthly', day: 1 },
]

const FREQ_LABELS = {
  daily:   'Quotidien',
  weekly:  'Hebdomadaire',
  monthly: 'Mensuel',
  onetime: 'Ponctuel',
}

const FREQ_COLORS = {
  daily:   '#1A5C4A',
  weekly:  '#3D5A8A',
  monthly: '#C4521A',
  onetime: '#8B6B8A',
}

export default function ChecklistAdminPage() {
  const { profile }   = useAuth()
  const isManager     = hasRole(profile, 'manager')

  const [tasks, setTasks]       = useState([])
  const [checks, setChecks]     = useState({}) // { taskId_YYYY-MM: { done, done_at, done_by } }
  const [loading, setLoading]   = useState(true)
  const [period, setPeriod]     = useState(format(new Date(), 'yyyy-MM'))
  const [modal, setModal]       = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [saving, setSaving]     = useState(false)

  const periodLabel = format(new Date(period + '-01'), 'MMMM yyyy', { locale: fr })

  useEffect(() => { init() }, [])
  useEffect(() => { loadChecks() }, [period, tasks])

  async function init() {
    try {
      const { data, error } = await supabase
        .from('admin_tasks')
        .select('*')
        .eq('active', true)
        .order('category').order('label')

      if (error) throw error

      if (data && data.length > 0) {
        setTasks(data)
      } else {
        await createDefaultTasks()
      }
    } catch (e) {
      console.error('admin_tasks error:', e)
      // Table pas encore créée — afficher vide sans crasher
      setTasks([])
    }
    setLoading(false)
  }

  async function createDefaultTasks() {
    const toInsert = DEFAULT_TASKS.map((t, i) => ({ ...t, sort_order: i, active: true }))
    const { data } = await supabase.from('admin_tasks').insert(toInsert).select()
    setTasks(data || [])
  }

  async function loadChecks() {
    if (!tasks.length) return
    const { data } = await supabase
      .from('admin_checks')
      .select('*, profiles(name)')
      .eq('period', period)

    const map = {}
    for (const c of (data || [])) {
      map[c.task_id] = c
    }
    setChecks(map)
  }

  async function toggleCheck(task) {
    if (!isManager) return
    const existing = checks[task.id]
    if (existing) {
      await supabase.from('admin_checks').delete().eq('id', existing.id)
      setChecks(prev => { const n = {...prev}; delete n[task.id]; return n })
    } else {
      const { data } = await supabase.from('admin_checks').insert({
        task_id: task.id, period, done_by: profile.id, done_at: new Date().toISOString()
      }).select('*, profiles(name)').single()
      if (data) setChecks(prev => ({ ...prev, [task.id]: data }))
    }
  }

  async function saveTask(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('admin_tasks').update({ category: form.category, label: form.label, frequency: form.frequency, day: form.day || null, active: true }).eq('id', form.id)
      setTasks(prev => prev.map(t => t.id === form.id ? { ...t, ...form } : t))
    } else {
      const { data } = await supabase.from('admin_tasks').insert({ ...form, active: true, sort_order: tasks.length }).select().single()
      if (data) setTasks(prev => [...prev, data])
    }
    setSaving(false)
    setModal(false)
    setEditTask(null)
  }

  async function deleteTask(id) {
    await supabase.from('admin_tasks').update({ active: false }).eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  // Grouper par catégorie
  const categories = [...new Set(tasks.map(t => t.category))]
  const totalDone  = Object.keys(checks).length
  const totalTasks = tasks.length
  const pct        = totalTasks > 0 ? Math.round(totalDone / totalTasks * 100) : 0

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Tâches admin</h1>
            <p className="page-subtitle" style={{ textTransform: 'none' }}>{periodLabel}</p>
          </div>
          {isManager && (
            <button className="btn btn-primary btn-sm" onClick={() => { setEditTask(null); setModal(true) }}>
              <Plus size={14} /> Ajouter
            </button>
          )}
        </div>
      </div>

      <div className="page-content">

        {/* SÉLECTEUR PÉRIODE */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => setPeriod(p => format(subMonths(new Date(p + '-01'), 1), 'yyyy-MM'))}>
            ←
          </button>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="form-input" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }} />
          <button className="btn btn-ghost btn-sm"
            onClick={() => setPeriod(p => format(addMonths(new Date(p + '-01'), 1), 'yyyy-MM'))}>
            →
          </button>
        </div>

        {/* PROGRESSION */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Progression {periodLabel}</span>
            <span style={{ fontWeight: 800, color: pct === 100 ? 'var(--outside-green)' : 'var(--ink)' }}>{totalDone}/{totalTasks} — {pct}%</span>
          </div>
          <div className="progress" style={{ height: 10 }}>
            <div className="progress-bar" style={{ width: `${pct}%`, background: pct === 100 ? 'var(--outside-green)' : 'var(--outside-orange)' }} />
          </div>
        </div>

        {/* TÂCHES PAR CATÉGORIE */}
        {categories.map(cat => {
          const catTasks = tasks.filter(t => t.category === cat)
          const catDone  = catTasks.filter(t => checks[t.id]).length
          return (
            <div key={cat} style={{ marginBottom: '1rem' }}>
              <div className="section-label">
                {cat}
                <span style={{ color: catDone === catTasks.length ? 'var(--outside-green)' : 'var(--muted)', marginLeft: 6 }}>
                  {catDone}/{catTasks.length}
                </span>
              </div>

              <div className="card">
                {catTasks.map((task, idx) => {
                  const done  = !!checks[task.id]
                  const check = checks[task.id]
                  return (
                    <div key={task.id} style={{ padding: '0.75rem 1rem', borderBottom: idx < catTasks.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>

                      {/* CHECKBOX */}
                      <div
                        onClick={() => toggleCheck(task)}
                        style={{ width: 26, height: 26, borderRadius: '50%', border: `2.5px solid ${done ? 'var(--outside-green)' : 'var(--outside-cream2)'}`, background: done ? 'var(--outside-green)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isManager ? 'pointer' : 'default', flexShrink: 0, transition: 'all 0.2s' }}>
                        {done && <Check size={14} color="white" />}
                      </div>

                      {/* INFOS */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--muted)' : 'var(--ink)' }}>
                          {task.label}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: FREQ_COLORS[task.frequency] || 'var(--muted)', background: `${FREQ_COLORS[task.frequency]}18`, padding: '1px 6px', borderRadius: 'var(--radius-pill)' }}>
                            {FREQ_LABELS[task.frequency] || task.frequency}
                          </span>
                          {task.day && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>avant le {task.day}</span>
                          )}
                          {done && check?.profiles?.name && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--outside-green)', fontWeight: 700 }}>✓ {check.profiles.name}</span>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS MANAGER */}
                      {isManager && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }}
                            onClick={() => { setEditTask(task); setModal(true) }}>✎</button>
                          <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }}
                            onClick={() => deleteTask(task.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL AJOUT/EDIT */}
      {modal && (
        <TaskModal
          task={editTask}
          categories={categories}
          onClose={() => { setModal(false); setEditTask(null) }}
          onSave={saveTask}
          saving={saving}
        />
      )}
    </>
  )
}

function TaskModal({ task, categories, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id:        task?.id || null,
    category:  task?.category || (categories[0] || 'Financier'),
    label:     task?.label || '',
    frequency: task?.frequency || 'monthly',
    day:       task?.day || '',
  })
  const [newCat, setNewCat] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open onClose={onClose} title={task ? 'Modifier la tâche' : 'Nouvelle tâche'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.label || !form.category || saving}
          onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>

      <div className="form-group">
        <label className="form-label">
          Catégorie
          <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', fontSize: '0.72rem', marginLeft: 8 }}
            onClick={() => setNewCat(n => !n)}>
            {newCat ? '← Existante' : '+ Nouvelle'}
          </button>
        </label>
        {newCat
          ? <input className="form-input" placeholder="ex: Juridique" value={form.category} onChange={e => set('category', e.target.value)} autoFocus />
          : <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
        }
      </div>

      <div className="form-group">
        <label className="form-label">Tâche</label>
        <input className="form-input" value={form.label} onChange={e => set('label', e.target.value)}
          placeholder="ex: Paiement électricité" autoFocus={!!task} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Fréquence</label>
          <select className="form-select" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
            <option value="daily">Quotidien</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="monthly">Mensuel</option>
            <option value="onetime">Ponctuel</option>
          </select>
        </div>
        {form.frequency === 'monthly' && (
          <div className="form-group">
            <label className="form-label">Avant le (jour)</label>
            <input className="form-input" type="number" min="1" max="31" placeholder="ex: 5"
              value={form.day} onChange={e => set('day', e.target.value)} />
          </div>
        )}
      </div>
    </Modal>
  )
}
