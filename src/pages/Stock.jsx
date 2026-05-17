import { useState, useEffect } from 'react'
import { Plus, Edit2, TrendingUp, TrendingDown, Save, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge, Modal } from '../components/UI'

export default function Stock() {
  const { profile } = useAuth()
  const [items, setItems]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch]             = useState('')
  const [editItem, setEditItem]         = useState(null)
  const [movementItem, setMovementItem] = useState(null)
  const [addModal, setAddModal]         = useState(false)
  const [saving, setSaving]             = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('stock_items').select('*').eq('active', true).order('category').order('name')
    setItems(data || [])
    setLoading(false)
  }

  const getStatus = i => {
    if (i.current_qty <= i.min_qty * 0.5) return 'critical'
    if (i.current_qty <= i.min_qty) return 'low'
    return 'ok'
  }
  const getPct = i => i.ideal_qty === 0 ? 100 : Math.min(100, Math.round((i.current_qty / i.ideal_qty) * 100))

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const filtered   = items
    .filter(i => activeCategory === 'all' || i.category === activeCategory)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
  const lowCount   = items.filter(i => getStatus(i) !== 'ok').length

  async function saveMovement({ item, type, qty, note }) {
    setSaving(true)
    const newQty = type === 'reception' ? item.current_qty + qty : Math.max(0, item.current_qty + qty)
    await Promise.all([
      supabase.from('stock_movements').insert({ item_id: item.id, type, qty, note: note || null, done_by: profile?.id }),
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)
    ])
    await fetchItems()
    setSaving(false)
    setMovementItem(null)
  }

  async function saveItem(data) {
    setSaving(true)
    if (data.id) await supabase.from('stock_items').update(data).eq('id', data.id)
    else await supabase.from('stock_items').insert(data)
    await fetchItems()
    setSaving(false)
    setEditItem(null)
    setAddModal(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Stock</h1>
            <p className="page-subtitle">{items.length} produits{lowCount > 0 ? ` · ${lowCount} alerte(s)` : ' · Tout OK'}</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setAddModal(true)}>
            <Plus size={14} /> Ajouter
          </button>
        </div>
      </div>

      <div className="page-content">

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: '36px' }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* CATEGORY FILTER — scroll horizontal */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '1rem', scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            const cnt = cat === 'all' ? items.length : items.filter(i => i.category === cat).length
            return (
              <button key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {cat === 'all' ? 'Tout' : cat} ({cnt})
              </button>
            )
          })}
        </div>

        {/* ITEMS LIST — cards sur mobile */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Aucun produit</div>
          )}
          {filtered.map(item => {
            const status = getStatus(item)
            const pct    = getPct(item)
            return (
              <div key={item.id} className="card" style={{ padding: '0.9rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</span>
                      {status === 'ok'       && <Badge color="green">OK</Badge>}
                      {status === 'low'      && <Badge color="amber">Bas</Badge>}
                      {status === 'critical' && <Badge color="red">Critique</Badge>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '6px' }}>
                      {item.category} · min: {item.min_qty} {item.unit}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="stock-bar" style={{ flex: 1 }}>
                        <div className={`stock-fill ${status}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--outside-dark)', flexShrink: 0 }}>
                        {item.current_qty} {item.unit}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => setMovementItem({ item, mode: 'reception' })} title="Reception">
                      <TrendingUp size={17} color="var(--outside-green)" />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => setMovementItem({ item, mode: 'adjustment' })} title="Ajustement">
                      <TrendingDown size={17} color="var(--outside-amber)" />
                    </button>
                    <button className="btn btn-ghost btn-icon" onClick={() => setEditItem(item)} title="Modifier">
                      <Edit2 size={15} color="var(--muted)" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {movementItem && (
        <MovementModal item={movementItem.item} mode={movementItem.mode}
          onClose={() => setMovementItem(null)} onSave={saveMovement} saving={saving} />
      )}
      {(editItem || addModal) && (
        <ItemModal item={editItem} categories={categories.filter(c => c !== 'all')}
          onClose={() => { setEditItem(null); setAddModal(false) }} onSave={saveItem} saving={saving} />
      )}
    </>
  )
}

function MovementModal({ item, mode, onClose, onSave, saving }) {
  const [qty, setQty]   = useState('')
  const [note, setNote] = useState('')
  return (
    <Modal open onClose={onClose}
      title={mode === 'reception' ? `Reception — ${item.name}` : `Ajustement — ${item.name}`}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!qty || saving}
          onClick={() => onSave({ item, type: mode, qty: mode === 'reception' ? +qty : -Math.abs(+qty), note })}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
        Stock actuel: <strong style={{ color: 'var(--ink)' }}>{item.current_qty} {item.unit}</strong>
      </div>
      <div className="form-group">
        <label className="form-label">Quantite ({item.unit})</label>
        <input className="form-input" type="number" min="0" step="0.1" value={qty} onChange={e => setQty(e.target.value)} autoFocus placeholder="ex: 500" />
      </div>
      <div className="form-group">
        <label className="form-label">Note (optionnel)</label>
        <input className="form-input" type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="ex: livraison fournisseur" />
      </div>
    </Modal>
  )
}

function ItemModal({ item, categories, onClose, onSave, saving }) {
  const [form, setForm] = useState(item || { name: '', category: categories[0] || '', unit: 'g', current_qty: 0, min_qty: 0, ideal_qty: 0 })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <Modal open onClose={onClose} title={item ? 'Modifier' : 'Nouveau produit'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.name || saving} onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div className="form-group">
        <label className="form-label">Nom</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Categorie</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Unite</label>
          <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
            {['g','kg','ml','L','unite','Feuilles','bouteille'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
        {[['current_qty','Actuel'],['min_qty','Minimum'],['ideal_qty','Ideal']].map(([k,l]) => (
          <div className="form-group" key={k} style={{ marginBottom: 0 }}>
            <label className="form-label">{l}</label>
            <input className="form-input" type="number" step="0.1" min="0" value={form[k]} onChange={e => set(k, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
      </div>
    </Modal>
  )
}
