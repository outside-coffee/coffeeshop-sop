import { useState, useEffect } from 'react'
import { Plus, Trash2, GripVertical, Save, X, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'

export default function ChecklistAdmin() {
  const { profile } = useAuth()
  const [type, setType]         = useState('opening')
  const [templates, setTemplates] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { fetchTemplates() }, [type])

  async function fetchTemplates() {
    setLoading(true)
    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .eq('type', type)
      .order('sort_order')
    setTemplates(data || [])
    setLoading(false)
  }

  async function saveItem(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('checklist_templates').update({
        category: form.category, label: form.label,
        sublabel: form.sublabel || null, active: form.active,
      }).eq('id', form.id)
      setTemplates(prev => prev.map(t => t.id === form.id ? { ...t, ...form } : t))
    } else {
      const maxOrder = templates.length > 0 ? Math.max(...templates.map(t => t.sort_order)) : 0
      const { data } = await supabase.from('checklist_templates').insert({
        type, category: form.category, label: form.label,
        sublabel: form.sublabel || null, sort_order: maxOrder + 1, active: true,
      }).select().single()
      if (data) setTemplates(prev => [...prev, data])
    }
    setSaving(false)
    setModal(false)
    setEditItem(null)
  }

  async function deleteItem(id) {
    setDeleting(id)
    await supabase.from('checklist_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  async function toggleActive(item) {
    await supabase.from('checklist_templates').update({ active: !item.active }).eq('id', item.id)
    setTemplates(prev => prev.map(t => t.id === item.id ? { ...t, active: !t.active } : t))
  }

  async function moveItem(idx, dir) {
    const newTemplates = [...templates]
    const target = idx + dir
    if (target < 0 || target >= newTemplates.length) return
    // Swap
    ;[newTemplates[idx], newTemplates[target]] = [newTemplates[target], newTemplates[idx]]
    // Update sort_order
    const updates = newTemplates.map((t, i) => ({ id: t.id, sort_order: i + 1 }))
    setTemplates(newTemplates.map((t, i) => ({ ...t, sort_order: i + 1 })))
    await Promise.all(updates.map(u => supabase.from('checklist_templates').update({ sort_order: u.sort_order }).eq('id', u.id)))
  }

  if (!hasRole(profile, 'admin')) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Accès admin uniquement</div>
    </div>
  )

  const categories = [...new Set(templates.map(t => t.category))]

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Checklists</h1>
            <p className="page-subtitle">Gestion des tâches — admin</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setModal(true) }}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* TABS */}
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn${type === 'opening' ? ' active' : ''}`} onClick={() => setType('opening')}>
            ☀️ Ouverture
          </button>
          <button className={`tab-btn${type === 'closing' ? ' active' : ''}`} onClick={() => setType('closing')}>
            🌙 Fermeture
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={28} /></div>
        ) : (
          <>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
              {templates.filter(t => t.active).length} tâches actives · {templates.filter(t => !t.active).length} inactives
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {templates.map((item, idx) => (
                <div key={item.id} className="card"
                  style={{ padding: '0.75rem 1rem', opacity: item.active ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

                    {/* ORDRE */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                      <button onClick={() => moveItem(idx, -1)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'var(--outside-cream2)' : 'var(--muted)', padding: '1px' }}>
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveItem(idx, 1)} disabled={idx === templates.length - 1}
                        style={{ background: 'none', border: 'none', cursor: idx === templates.length - 1 ? 'default' : 'pointer', color: idx === templates.length - 1 ? 'var(--outside-cream2)' : 'var(--muted)', padding: '1px' }}>
                        <ChevronDown size={14} />
                      </button>
                    </div>

                    {/* CONTENU */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--outside-orange)', fontWeight: 700, marginTop: '1px' }}>
                        {item.category}
                        {item.sublabel && <span style={{ color: 'var(--muted)', marginLeft: '6px' }}>· {item.sublabel}</span>}
                      </div>
                    </div>

                    {/* ACTIONS */}
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.72rem', color: item.active ? 'var(--outside-green)' : 'var(--muted)' }}
                        onClick={() => toggleActive(item)}>
                        {item.active ? '✓ Actif' : '○ Inactif'}
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: 'var(--muted)' }}
                        onClick={() => { setEditItem(item); setModal(true) }}>
                        ✎
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => deleteItem(item.id)}
                        disabled={deleting === item.id}>
                        {deleting === item.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {modal && (
        <ItemModal
          item={editItem}
          type={type}
          categories={categories}
          onClose={() => { setModal(false); setEditItem(null) }}
          onSave={saveItem}
          saving={saving}
        />
      )}
    </>
  )
}

function ItemModal({ item, type, categories, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id:       item?.id || null,
    category: item?.category || (categories[0] || ''),
    label:    item?.label    || '',
    sublabel: item?.sublabel || '',
    active:   item?.active   ?? true,
  })
  const [newCat, setNewCat] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open onClose={onClose}
      title={item ? 'Modifier la tâche' : 'Nouvelle tâche'}
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
        {newCat ? (
          <input className="form-input" placeholder="ex: Hygiène" value={form.category}
            onChange={e => set('category', e.target.value)} autoFocus />
        ) : (
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="">— Choisir —</option>
          </select>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Tâche</label>
        <input className="form-input" value={form.label}
          onChange={e => set('label', e.target.value)}
          placeholder="ex: Vérifier la température du frigo"
          autoFocus={!!item} />
      </div>

      <div className="form-group">
        <label className="form-label">Précision (optionnel)</label>
        <input className="form-input" value={form.sublabel}
          onChange={e => set('sublabel', e.target.value)}
          placeholder="ex: Doit être entre 0°C et 4°C" />
      </div>
    </Modal>
  )
}
