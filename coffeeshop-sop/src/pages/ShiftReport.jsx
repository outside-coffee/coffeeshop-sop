import { useState, useEffect } from 'react'
import { CheckCircle, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const SHIFTS = [
  { value: 'morning', label: 'Matin (6h–14h)' },
  { value: 'afternoon', label: 'Après-midi (12h–20h)' },
  { value: 'full', label: 'Journée (8h–17h)' },
]

export default function ShiftReport() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existing, setExisting] = useState(null)
  const today = format(new Date(), 'yyyy-MM-dd')

  const [form, setForm] = useState({
    shift: 'morning',
    ca: '',
    covers: '',
    cash_status: 'ok',
    cash_diff: '',
    stock_issues: '',
    equipment_issues: '',
    customer_incidents: '',
    handover_notes: '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('shift_reports')
        .select('*')
        .eq('date', today)
        .eq('barista_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setExisting(data)
        setForm({
          shift: data.shift,
          ca: data.ca?.toString() || '',
          covers: data.covers?.toString() || '',
          cash_status: data.cash_status || 'ok',
          cash_diff: data.cash_diff?.toString() || '',
          stock_issues: data.stock_issues || '',
          equipment_issues: data.equipment_issues || '',
          customer_incidents: data.customer_incidents || '',
          handover_notes: data.handover_notes || '',
        })
        setSaved(true)
      }
      setLoading(false)
    }
    if (profile) load()
  }, [profile])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      date: today,
      barista_id: profile.id,
      shift: form.shift,
      ca: form.ca ? parseFloat(form.ca) : null,
      covers: form.covers ? parseInt(form.covers) : null,
      cash_status: form.cash_status,
      cash_diff: form.cash_diff ? parseFloat(form.cash_diff) : 0,
      stock_issues: form.stock_issues || null,
      equipment_issues: form.equipment_issues || null,
      customer_incidents: form.customer_incidents || null,
      handover_notes: form.handover_notes || null,
    }

    if (existing) {
      await supabase.from('shift_reports').update(payload).eq('id', existing.id)
    } else {
      const { data } = await supabase.from('shift_reports').insert(payload).select().single()
      setExisting(data)
    }
    setSaved(true)
    setSaving(false)
  }

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
            <h1 className="page-title">Rapport de shift</h1>
            <p className="page-subtitle">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
          </div>
          {saved && <Badge color="green"><CheckCircle size={12} /> Enregistré</Badge>}
        </div>
      </div>

      <div className="page-content">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>

            {/* INFOS SHIFT */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Infos du shift</span>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Shift</label>
                  <select className="form-select" value={form.shift} onChange={e => set('shift', e.target.value)}>
                    {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* VENTES */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Ventes & caisse</span>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">CA du shift (€)</label>
                  <input className="form-input" type="number" step="0.01" min="0"
                    placeholder="ex: 480" value={form.ca} onChange={e => set('ca', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre de passages</label>
                  <input className="form-input" type="number" min="0"
                    placeholder="ex: 95" value={form.covers} onChange={e => set('covers', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Caisse</label>
                  <select className="form-select" value={form.cash_status} onChange={e => set('cash_status', e.target.value)}>
                    <option value="ok">Aucun écart</option>
                    <option value="surplus">Excédent</option>
                    <option value="missing">Manquant</option>
                  </select>
                </div>
                {form.cash_status !== 'ok' && (
                  <div className="form-group">
                    <label className="form-label">Montant de l'écart (€)</label>
                    <input className="form-input" type="number" step="0.01" min="0"
                      placeholder="ex: 5.50" value={form.cash_diff} onChange={e => set('cash_diff', e.target.value)} />
                  </div>
                )}
              </div>
            </div>

            {/* INCIDENTS */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Incidents & alertes</span>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Ruptures de stock</label>
                  <input className="form-input" type="text"
                    placeholder="ex: lait d'avoine, sucre roux..."
                    value={form.stock_issues} onChange={e => set('stock_issues', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Problèmes équipement</label>
                  <input className="form-input" type="text"
                    placeholder="ex: moulin à régler..."
                    value={form.equipment_issues} onChange={e => set('equipment_issues', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Incidents clients</label>
                  <textarea className="form-textarea" rows={2}
                    placeholder="plainte, remboursement, etc."
                    value={form.customer_incidents} onChange={e => set('customer_incidents', e.target.value)} />
                </div>
              </div>
            </div>

            {/* PASSATION */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Passation équipe</span>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Consignes pour le shift suivant</label>
                  <textarea className="form-textarea" rows={4}
                    placeholder="Ce que l'équipe suivante doit savoir..."
                    value={form.handover_notes} onChange={e => set('handover_notes', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '8px' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? <Spinner size={18} /> : <CheckCircle size={18} />}
              {existing ? 'Mettre à jour le rapport' : 'Enregistrer le rapport'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
