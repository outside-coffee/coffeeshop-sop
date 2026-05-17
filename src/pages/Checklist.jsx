import { useState, useEffect } from 'react'
import { Check, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ChecklistPage({ type }) {
  const { profile } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [templates, setTemplates] = useState([])
  const [session, setSession]   = useState(null)
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [validated, setValidated] = useState(false)

  const today    = format(new Date(), 'yyyy-MM-dd')
  const title    = type === 'opening' ? 'Ouverture' : 'Fermeture'
  const subtitle = type === 'opening' ? 'Taches du matin' : 'Taches de fermeture'

  useEffect(() => { fetchData() }, [type])

  async function fetchData() {
    setLoading(true)
    const [{ data: tmpl }, { data: sessions }] = await Promise.all([
      supabase.from('checklist_templates').select('*').eq('type', type).eq('active', true).order('sort_order'),
      supabase.from('checklist_sessions').select('*').eq('type', type).eq('date', today)
    ])
    setTemplates(tmpl || [])
    const existing = sessions?.[0]
    setSession(existing || null)
    setValidated(existing?.validated_at != null)
    if (existing) {
      const { data: items } = await supabase.from('checklist_items').select('template_id').eq('session_id', existing.id)
      setCheckedIds(new Set((items || []).map(i => i.template_id)))
    } else {
      setCheckedIds(new Set())
    }
    setLoading(false)
  }

  async function ensureSession() {
    if (session) return session
    const { data } = await supabase.from('checklist_sessions')
      .insert({ type, date: today, completed_by: profile?.id })
      .select().single()
    setSession(data)
    return data
  }

  async function toggleItem(templateId) {
    if (validated) return
    setSaving(true)
    const sess = await ensureSession()
    if (!sess) { setSaving(false); return }
    if (checkedIds.has(templateId)) {
      await supabase.from('checklist_items').delete().eq('session_id', sess.id).eq('template_id', templateId)
      setCheckedIds(prev => { const n = new Set(prev); n.delete(templateId); return n })
    } else {
      await supabase.from('checklist_items').insert({ session_id: sess.id, template_id: templateId, checked_by: profile?.id })
      setCheckedIds(prev => new Set([...prev, templateId]))
    }
    setSaving(false)
  }

  async function validate() {
    if (!session || validated || checkedIds.size < templates.length) return
    setSaving(true)
    await supabase.from('checklist_sessions').update({ validated_at: new Date().toISOString() }).eq('id', session.id)
    setValidated(true)
    setSaving(false)
  }

  const progress  = templates.length > 0 ? Math.round((checkedIds.size / templates.length) * 100) : 0
  const categories = [...new Set(templates.map(t => t.category))]

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{format(new Date(), "EEE d MMM", { locale: fr })} · {subtitle}</p>
          </div>
          {validated
            ? <Badge color="green"><CheckCircle size={11} /> Validee</Badge>
            : <Badge color={progress > 0 ? 'amber' : 'gray'}>{checkedIds.size}/{templates.length}</Badge>
          }
        </div>
      </div>

      <div className="page-content">
        {/* PROGRESS */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)' }}>Progression</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: progress === 100 ? 'var(--outside-green)' : 'var(--ink)' }}>{progress}%</span>
          </div>
          <div className="progress" style={{ height: '10px' }}>
            <div className="progress-bar" style={{ width: `${progress}%`, background: progress === 100 ? 'var(--outside-green)' : 'var(--outside-amber)' }} />
          </div>
        </div>

        {/* VALIDATE BTN */}
        {!validated && (
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: '1.25rem', padding: '0.85rem', fontSize: '0.95rem', opacity: progress < 100 ? 0.5 : 1 }}
            disabled={progress < 100 || saving} onClick={validate}>
            {saving ? <Spinner size={16} /> : <CheckCircle size={17} />}
            {progress < 100 ? `Encore ${templates.length - checkedIds.size} tache(s)` : 'Valider la checklist'}
          </button>
        )}
        {validated && (
          <div style={{ background: '#E0F2EB', borderRadius: 'var(--radius-lg)', padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: 'var(--outside-green)', fontWeight: 700, fontSize: '0.9rem' }}>
            <CheckCircle size={18} /> Checklist validee pour aujourd'hui
          </div>
        )}

        {/* CATEGORIES */}
        {categories.map(cat => {
          const catItems = templates.filter(t => t.category === cat)
          const catDone  = catItems.filter(i => checkedIds.has(i.id)).length
          return (
            <div key={cat} style={{ marginBottom: '1.25rem' }}>
              <div className="section-label">
                {cat}
                <span style={{ marginLeft: '6px', color: catDone === catItems.length ? 'var(--outside-green)' : 'var(--muted)' }}>
                  {catDone}/{catItems.length}
                </span>
              </div>
              <div className="card">
                <div style={{ padding: '0 1rem' }}>
                  {catItems.map(item => {
                    const done = checkedIds.has(item.id)
                    return (
                      <div key={item.id}
                        className={`check-item${done ? ' done' : ''}`}
                        onClick={() => toggleItem(item.id)}
                        style={{ opacity: validated && !done ? 0.45 : 1 }}>
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
      </div>

      {saving && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: 'var(--outside-dark)', color: 'white', padding: '8px 16px', borderRadius: 'var(--radius-pill)', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center', zIndex: 50 }}>
          <Spinner size={13} /> Enregistrement...
        </div>
      )}
    </>
  )
}
