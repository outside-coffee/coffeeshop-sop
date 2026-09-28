import { useState, useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const SHIFTS = [
  { value: 'morning', label: 'Shift matin' },
  { value: 'evening', label: 'Shift soir' },
]

const emptyForm = shift => ({
  shift, ca: '', covers: '', cash_status: 'ok', cash_diff: '',
  stock_issues: '', equipment_issues: '', customer_incidents: '', handover_notes: '',
})

export default function ShiftReport() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [existing, setExisting] = useState(null)
  const [error, setError]     = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  const [form, setForm] = useState(() => emptyForm('morning'))
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      const selectedShift = form.shift
      const { data, error: loadError } = await supabase.from('shift_reports')
        .select('*').eq('date', today).eq('barista_id', profile?.id)
        .eq('shift', selectedShift).maybeSingle()
      if (loadError) {
        setError(loadError.message || 'Impossible de charger le rapport.')
        setLoading(false)
        return
      }
      if (data) {
        setExisting(data)
        setForm({
          shift: data.shift, ca: data.ca?.toString() || '',
          covers: data.covers?.toString() || '',
          cash_status: data.cash_status || 'ok',
          cash_diff: data.cash_diff?.toString() || '',
          stock_issues: data.stock_issues || '',
          equipment_issues: data.equipment_issues || '',
          customer_incidents: data.customer_incidents || '',
          handover_notes: data.handover_notes || '',
        })
        setSaved(true)
      } else {
        setExisting(null)
        setForm(emptyForm(selectedShift))
        setSaved(false)
      }
      setLoading(false)
    }
    if (profile) load()
  }, [profile, form.shift, today])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      date: today, barista_id: profile.id, shift: form.shift,
      ca: form.ca ? parseFloat(form.ca) : null,
      covers: form.covers ? parseInt(form.covers) : null,
      cash_status: form.cash_status,
      cash_diff: form.cash_diff ? parseFloat(form.cash_diff) : 0,
      stock_issues: form.stock_issues || null,
      equipment_issues: form.equipment_issues || null,
      customer_incidents: form.customer_incidents || null,
      handover_notes: form.handover_notes || null,
    }
    const { data, error: saveError } = await supabase.from('shift_reports')
      .upsert(payload, { onConflict: 'barista_id,date,shift' })
      .select().single()
    if (saveError) {
      setError(saveError.message || 'Impossible d’enregistrer le rapport.')
      setSaving(false)
      return
    }
    setExisting(data)
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Rapport shift</h1>
            <p className="page-subtitle">{format(new Date(), "EEE d MMMM", { locale: fr })}</p>
          </div>
          {saved && <Badge color="green"><CheckCircle size={11} /> Enregistré</Badge>}
        </div>
      </div>

      <div className="page-content">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* SHIFT */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Période du rapport</label>
              <select className="form-select" value={form.shift} onChange={e => setForm(emptyForm(e.target.value))}>
                {SHIFTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FDEEEC', color: 'var(--danger)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '0.82rem' }}>
              {error}
            </div>
          )}

          {/* CAISSE */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              Ventes & caisse
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">CA (DT)</label>
              <input className="form-input" type="number" step="0.01" min="0" placeholder="ex: 480" value={form.ca} onChange={e => set('ca', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <label className="form-label">Nombre de clients</label>
              <input className="form-input" type="number" step="1" min="0" placeholder="ex : 85" value={form.covers} onChange={e => set('covers', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
              <label className="form-label">Caisse</label>
              <select className="form-select" value={form.cash_status} onChange={e => set('cash_status', e.target.value)}>
                <option value="ok">Aucun écart</option>
                <option value="surplus">Excédent</option>
                <option value="missing">Manquant</option>
              </select>
            </div>
            {form.cash_status !== 'ok' && (
              <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                <label className="form-label">Montant de l’écart (DT)</label>
                <input className="form-input" type="number" step="0.01" min="0" placeholder="ex: 5.50" value={form.cash_diff} onChange={e => set('cash_diff', e.target.value)} />
              </div>
            )}
          </div>

          {/* INCIDENTS */}
          <div className="card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
              Incidents & alertes
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Ruptures stock</label>
                <input className="form-input" type="text" placeholder="ex: lait d'avoine, sucre..." value={form.stock_issues} onChange={e => set('stock_issues', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Équipement</label>
                <input className="form-input" type="text" placeholder="ex : moulin à régler..." value={form.equipment_issues} onChange={e => set('equipment_issues', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Incidents clients</label>
                <textarea className="form-textarea" rows={2} placeholder="plainte, remboursement..." value={form.customer_incidents} onChange={e => set('customer_incidents', e.target.value)} />
              </div>
            </div>
          </div>

          {/* PASSATION */}
          <div className="card" style={{ padding: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Consignes pour le shift suivant</label>
              <textarea className="form-textarea" rows={4} placeholder="Ce que l’équipe suivante doit savoir..." value={form.handover_notes} onChange={e => set('handover_notes', e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}
            style={{ width: '100%', justifyContent: 'center' }}>
            {saving ? <Spinner size={18} /> : <CheckCircle size={18} />}
            {existing ? 'Mettre à jour' : 'Enregistrer le rapport'}
          </button>
        </form>
      </div>
    </>
  )
}
