import { useState, useEffect } from 'react'
import { Check, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ChecklistPage({ type }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [session, setSession] = useState(null)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [validated, setValidated] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const title = type === 'opening' ? 'Checklist Ouverture' : 'Checklist Fermeture'
  const subtitle = type === 'opening' ? 'Tâches du matin' : 'Tâches de fermeture'

  useEffect(() => { fetchData() }, [type])

  async function fetchData() {
    setLoading(true)
    const [{ data: tmpl }, { data: sessions }] = await Promise.all([
      supabase.from('checklist_templates').select('*').eq('type', type).eq('active', true).order('sort_order'),
      supabase.from('checklist_sessions').select('*').eq('type', type).eq('date', today)
    ])

    setTemplates(tmpl || [])
    const existingSession = sessions?.[0]
    setSession(existingSession || null)
    setValidated(existingSession?.validated_at != null)

    if (existingSession) {
      const { data: items } = await supabase
        .from('checklist_items')
        .select('template_id')
        .eq('session_id', existingSession.id)
      setCheckedIds(new Set((items || []).map(i => i.template_id)))
    } else {
      setCheckedIds(new Set())
    }
    setLoading(false)
  }

  async function ensureSession() {
    if (session) return session
    const { data } = await supabase
      .from('checklist_sessions')
      .insert({ type, date: today, completed_by: profile?.id })
      .select()
      .single()
    setSession(data)
    return data
  }

  async function toggleItem(templateId) {
    if (validated) return
    setSaving(true)
    const sess = await ensureSession()
    if (!sess) { setSaving(false); return }

    if (checkedIds.has(templateId)) {
      await supabase.from('checklist_items')
        .delete()
        .eq('session_id', sess.id)
        .eq('template_id', templateId)
      setCheckedIds(prev => { const n = new Set(prev); n.delete(templateId); return n })
    } else {
      await supabase.from('checklist_items')
        .insert({ session_id: sess.id, template_id: templateId, checked_by: profile?.id })
      setCheckedIds(prev => new Set([...prev, templateId]))
    }
    setSaving(false)
  }

  async function validate() {
    if (!session || validated) return
    const allDone = checkedIds.size === templates.length
    if (!allDone) return
    setSaving(true)
    await supabase.from('checklist_sessions')
      .update({ validated_at: new Date().toISOString() })
      .eq('id', session.id)
    setValidated(true)
    setSaving(false)
  }

  const progress = templates.length > 0 ? Math.round((checkedIds.size / templates.length) * 100) : 0
  const categories = [...new Set(templates.map(t => t.category))]

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{format(new Date(), "EEEE d MMMM", { locale: fr })} · {subtitle}</p>
          </div>
          {validated
            ? <Badge color="green"><CheckCircle size={12} /> Validée</Badge>
            : <Badge color={progress === 100 ? 'amber' : 'gray'}>{checkedIds.size}/{templates.length} tâches</Badge>
          }
        </div>
      </div>

      <div className="page-content">
        {/* PROGRESS */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Progression</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{progress}%</span>
          </div>
          <div className="progress" style={{ height: '8px' }}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          {validated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem', color: 'var(--success)', fontSize: '0.875rem', fontWeight: 500 }}>
              <CheckCircle size={16} />
              Checklist validée pour aujourd'hui
            </div>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginTop: '1rem', opacity: progress < 100 ? 0.5 : 1 }}
              disabled={progress < 100 || saving}
              onClick={validate}
            >
              {saving ? <Spinner size={16} /> : <CheckCircle size={16} />}
              {progress < 100 ? `Encore ${templates.length - checkedIds.size} tâche(s)` : 'Valider la checklist'}
            </button>
          )}
        </div>

        {/* CATEGORIES */}
        {categories.map(cat => {
          const items = templates.filter(t => t.category === cat)
          const catDone = items.filter(i => checkedIds.has(i.id)).length

          return (
            <div key={cat} style={{ marginBottom: '1.5rem' }}>
              <div className="section-label">
                {cat}
                <span style={{ marginLeft: '8px', color: catDone === items.length ? 'var(--success)' : 'var(--muted)' }}>
                  {catDone}/{items.length}
                </span>
              </div>

              <div className="card">
                <div style={{ padding: '0.25rem 1.5rem' }}>
                  {items.map(item => {
                    const done = checkedIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`check-item${done ? ' done' : ''}`}
                        onClick={() => toggleItem(item.id)}
                        style={{ opacity: validated && !done ? 0.5 : 1 }}
                      >
                        <div className="check-circle">
                          {done && <Check size={13} color="white" />}
                        </div>
                        <div>
                          <div className="check-label">{item.label}</div>
                          {item.sublabel && <div className="check-sublabel">{item.sublabel}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}

        {saving && (
          <div style={{ position: 'fixed', bottom: '1rem', left: '50%', transform: 'translateX(-50%)',
            background: 'var(--brown-800)', color: 'white', padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Spinner size={14} /> Enregistrement…
          </div>
        )}
      </div>
    </>
  )
}
