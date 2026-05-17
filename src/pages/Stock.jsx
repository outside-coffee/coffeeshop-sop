import { useState, useEffect } from 'react'
import { Plus, Minus, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function Stock() {
  const { profile } = useAuth()
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(null) // id de l'item en cours de save
  const [activeCategory, setActiveCategory] = useState('all')
  const [editQty, setEditQty]       = useState({}) // { id: newQty }

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase
      .from('stock_items').select('*').eq('active', true)
      .order('category').order('name')
    setItems(data || [])
    setLoading(false)
  }

  const getStatus = i => {
    if (i.current_qty <= i.min_qty * 0.5) return 'critical'
    if (i.current_qty <= i.min_qty)       return 'low'
    return 'ok'
  }

  const STATUS_CONFIG = {
    ok:       { label: 'OK',       bg: '#E0F2EB', color: '#1A5C4A', dot: '#1A5C4A' },
    low:      { label: 'Bas',      bg: '#FEF3DC', color: '#8A5200', dot: '#D4892A' },
    critical: { label: 'Critique', bg: '#FDEEEC', color: '#8B2A1E', dot: '#B03A1A' },
  }

  const categories  = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const filtered    = items.filter(i => activeCategory === 'all' || i.category === activeCategory)
  const alerts      = items.filter(i => getStatus(i) !== 'ok')

  // Ajuste la quantité en mémoire
  function adjustQty(id, delta) {
    setEditQty(prev => {
      const current = prev[id] !== undefined
        ? prev[id]
        : items.find(i => i.id === id)?.current_qty || 0
      return { ...prev, [id]: Math.max(0, parseFloat((current + delta).toFixed(1))) }
    })
  }

  function setQtyDirect(id, val) {
    setEditQty(prev => ({ ...prev, [id]: Math.max(0, parseFloat(val) || 0) }))
  }

  // Sauvegarde une mise à jour
  async function saveItem(item) {
    const newQty = editQty[item.id]
    if (newQty === undefined || newQty === item.current_qty) {
      setEditQty(prev => { const n = {...prev}; delete n[item.id]; return n })
      return
    }
    setSaving(item.id)
    const delta = newQty - item.current_qty
    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id),
      supabase.from('stock_movements').insert({ item_id: item.id, type: 'adjustment', qty: delta, note: 'Mise a jour stock', done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_qty: newQty } : i))
    setEditQty(prev => { const n = {...prev}; delete n[item.id]; return n })
    setSaving(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Stock</h1>
            <p className="page-subtitle">
              {format(new Date(), "EEE d MMM", { locale: fr })}
              {alerts.length > 0
                ? ` · ⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}`
                : ' · Tout OK'}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* ALERTES EN HAUT */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {alerts.map(item => {
              const st = STATUS_CONFIG[getStatus(item)]
              return (
                <div key={item.id} style={{
                  background: st.bg, borderRadius: 'var(--radius-md)',
                  padding: '8px 12px', marginBottom: '6px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: st.color, flex: 1 }}>{item.name}</span>
                  <span style={{ fontWeight: 800, color: st.color }}>{item.current_qty} {item.unit}</span>
                  <span style={{ fontSize: '0.7rem', color: st.color, opacity: 0.7 }}>min: {item.min_qty}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* FILTRE CATEGORIES */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '1rem', scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            const cnt     = cat === 'all' ? items.length : items.filter(i => i.category === cat).length
            const hasAlert = cat !== 'all' && items.filter(i => i.category === cat).some(i => getStatus(i) !== 'ok')
            return (
              <button key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {hasAlert && '⚠️ '}
                {cat === 'all' ? 'Tout' : cat}
                <span style={{ opacity: 0.65 }}> ({cnt})</span>
              </button>
            )
          })}
        </div>

        {/* LISTE ITEMS */}
        <div className="card">
          {filtered.map((item, idx) => {
            const status  = getStatus(item)
            const st      = STATUS_CONFIG[status]
            const edited  = editQty[item.id] !== undefined
            const dispQty = edited ? editQty[item.id] : item.current_qty
            const isSaving = saving === item.id

            return (
              <div key={item.id} style={{
                padding: '0.85rem 1rem',
                borderBottom: idx < filtered.length - 1 ? '1.5px solid var(--outside-cream)' : 'none',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                {/* STATUS DOT */}
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

                {/* NOM */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '1px' }}>
                    min {item.min_qty} {item.unit}
                  </div>
                </div>

                {/* CONTROLES */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ width: 32, height: 32, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => adjustQty(item.id, -1)}>
                    <Minus size={14} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={dispQty}
                      onChange={e => setQtyDirect(item.id, e.target.value)}
                      style={{
                        width: 56,
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '1rem',
                        border: edited ? '2px solid var(--outside-orange)' : '2px solid var(--outside-cream2)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px 2px',
                        fontFamily: 'var(--font-body)',
                        background: edited ? '#FFF8F5' : 'white',
                        color: 'var(--outside-dark)',
                        outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700 }}>{item.unit}</span>
                  </div>

                  <button
                    className="btn btn-ghost btn-icon"
                    style={{ width: 32, height: 32, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => adjustQty(item.id, 1)}>
                    <Plus size={14} />
                  </button>

                  {/* SAVE */}
                  <button
                    className="btn btn-icon"
                    style={{
                      width: 32, height: 32,
                      background: edited ? 'var(--outside-green)' : 'transparent',
                      borderRadius: 'var(--radius-sm)',
                      border: edited ? 'none' : '2px solid transparent',
                      opacity: edited ? 1 : 0,
                      pointerEvents: edited ? 'auto' : 'none',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => saveItem(item)}
                    disabled={isSaving}>
                    {isSaving ? <Spinner size={14} /> : <Check size={14} color="white" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', marginTop: '1rem', fontWeight: 600 }}>
          Modifie la quantite puis appuie sur ✓ pour sauvegarder
        </p>
      </div>
    </>
  )
}
