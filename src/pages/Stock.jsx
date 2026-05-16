import { useState, useEffect } from 'react'
import { Plus, Edit2, TrendingUp, TrendingDown, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge, Modal, EmptyState } from '../components/UI'

export default function Stock() {
  const { profile } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [editItem, setEditItem] = useState(null)
  const [movementItem, setMovementItem] = useState(null)
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('stock_items').select('*').eq('active', true)
      .order('category').order('name')
    setItems(data || [])
    setLoading(false)
  }

  function getStockStatus(item) {
    if (item.current_qty <= item.min_qty * 0.5) return 'critical'
    if (item.current_qty <= item.min_qty) return 'low'
    return 'ok'
  }

  function getStockPct(item) {
    if (item.ideal_qty === 0) return 100
    return Math.min(100, Math.round((item.current_qty / item.ideal_qty) * 100))
  }

  // Catégories construites dynamiquement depuis les données réelles
  const categories = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory)
  const lowCount = items.filter(i => getStockStatus(i) !== 'ok').length

  async function saveMovement({ item, type, qty, note }) {
    setSaving(true)
    const newQty = type === 'reception'
      ? item.current_qty + qty
      : Math.max(0, item.current_qty + qty)

    await Promise.all([
      supabase.from('stock_movements').insert({
        item_id: item.id, type, qty,
        note: note || null,
        done_by: profile?.id,
      }),
      supabase.from('stock_items').update({
        current_qty: newQty,
        updated_at: new Date().toISOString()
      }).eq('id', item.id)
    ])
    await fetchItems()
    setSaving(false)
    setMovementItem(null)
  }

  async function saveItem(data) {
    setSaving(true)
    if (data.id) {
      await supabase.from('stock_items').update(data).eq('id', data.id)
    } else {
      await supabase.from('stock_items').insert(data)
    }
    await fetchItems()
    setSaving(false)
    setEditItem(null)
    setAddModal(false)
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
            <h1 className="page-title">Stock</h1>
            <p className="page-subtitle">
              {items.length} produits · {lowCount > 0 ? `${lowCount} alerte(s)` : 'Tout est OK'}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>
            <Plus size={15} /> Ajouter un produit
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* CATEGORY TABS */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const label = cat === 'all' ? 'Tout' : cat
            const cnt   = cat === 'all' ? items.length : items.filter(i => i.category === cat).length
            return (
              <button key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)}
              >
                {label} <span style={{ opacity: 0.7 }}>({cnt})</span>
              </button>
            )
          })}
        </div>

        {/* STOCK TABLE */}
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Categorie</th>
                  <th>Stock actuel</th>
                  <th>Niveau</th>
                  <th>Statut</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Aucun produit</td></tr>
                )}
                {filtered.map(item => {
                  const status = getStockStatus(item)
                  const pct    = getStockPct(item)
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.category}</span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{item.current_qty}</span>
                        <span style={{ color: 'var(--muted)', marginLeft: '4px', fontSize: '0.8rem' }}>{item.unit}</span>
                      </td>
                      <td style={{ minWidth: '120px' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '3px' }}>
                          min: {item.min_qty} / ideal: {item.ideal_qty}
                        </div>
                        <div className="stock-bar">
                          <div className={`stock-fill ${status}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td>
                        {status === 'ok'       && <Badge color="green">OK</Badge>}
                        {status === 'low'      && <Badge color="amber">Bas</Badge>}
                        {status === 'critical' && <Badge color="red">Critique</Badge>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Reception"
                            onClick={() => setMovementItem({ item, mode: 'reception' })}>
                            <TrendingUp size={15} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Ajustement"
                            onClick={() => setMovementItem({ item, mode: 'adjustment' })}>
                            <TrendingDown size={15} />
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" title="Modifier"
                            onClick={() => setEditItem(item)}>
                            <Edit2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {movementItem && (
        <MovementModal
          item={movementItem.item}
          mode={movementItem.mode}
          onClose={() => setMovementItem(null)}
          onSave={saveMovement}
          saving={saving}
        />
      )}

      {(editItem || addModal) && (
        <ItemModal
          item={editItem}
          categories={categories.filter(c => c !== 'all')}
          onClose={() => { setEditItem(null); setAddModal(false) }}
          onSave={saveItem}
          saving={saving}
        />
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
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!qty || saving}
            onClick={() => onSave({ item, type: mode, qty: mode === 'reception' ? +qty : -Math.abs(+qty), note })}>
            {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
          </button>
        </>
      }
    >
      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1rem' }}>
        Stock actuel: <strong style={{ color: 'var(--ink)' }}>{item.current_qty} {item.unit}</strong>
      </div>
      <div className="form-group">
        <label className="form-label">
          {mode === 'reception' ? 'Quantite recue' : 'Quantite a soustraire'} ({item.unit})
        </label>
        <input className="form-input" type="number" min="0" step="0.1"
          value={qty} onChange={e => setQty(e.target.value)} autoFocus placeholder="ex: 500" />
      </div>
      <div className="form-group">
        <label className="form-label">Note (optionnel)</label>
        <input className="form-input" type="text" value={note} onChange={e => setNote(e.target.value)}
          placeholder={mode === 'reception' ? 'Livraison fournisseur' : 'Casse, inventaire...'} />
      </div>
    </Modal>
  )
}

function ItemModal({ item, categories, onClose, onSave, saving }) {
  const [form, setForm] = useState(item || {
    name: '', category: categories[0] || '', unit: 'g',
    current_qty: 0, min_qty: 0, ideal_qty: 0, supplier: ''
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <Modal open onClose={onClose}
      title={item ? 'Modifier le produit' : 'Nouveau produit'}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.name || saving}
            onClick={() => onSave(form)}>
            {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Nom</label>
        <input className="form-input" value={form.name}
          onChange={e => set('name', e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Categorie</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Unite</label>
          <select className="form-select" value={form.unit} onChange={e => set('unit', e.target.value)}>
            {['g', 'kg', 'ml', 'L', 'unite', 'Feuilles', 'bouteille', 'sac', 'boite'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {[['current_qty','Stock actuel'],['min_qty','Seuil minimum'],['ideal_qty','Stock ideal']].map(([k, l]) => (
          <div className="form-group" key={k}>
            <label className="form-label">{l}</label>
            <input className="form-input" type="number" step="0.1" min="0"
              value={form[k]} onChange={e => set(k, parseFloat(e.target.value) || 0)} />
          </div>
        ))}
      </div>
    </Modal>
  )
}
