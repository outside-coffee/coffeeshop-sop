import { useState, useEffect } from 'react'
import { Plus, Minus, Check, TrendingUp, TrendingDown, ClipboardList } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_CONFIG = {
  ok:       { dot: '#1A5C4A', bg: '#E0F2EB', color: '#1A5C4A', label: 'OK'       },
  low:      { dot: '#D4892A', bg: '#FEF3DC', color: '#8A5200', label: 'Bas'      },
  critical: { dot: '#B03A1A', bg: '#FDEEEC', color: '#8B2A1E', label: 'Critique' },
}

function getStatus(i) {
  if (i.current_qty <= i.min_qty * 0.5) return 'critical'
  if (i.current_qty <= i.min_qty)       return 'low'
  return 'ok'
}

export default function Stock() {
  const { profile } = useAuth()
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('inventaire') // 'inventaire' | 'mouvement'
  const [activeCategory, setActiveCategory] = useState('all')

  // Inventaire state
  const [editQty, setEditQty] = useState({})
  const [saving, setSaving]   = useState(null)

  // Mouvement state
  const [movType, setMovType]   = useState('reception') // 'reception' | 'usage'
  const [movItem, setMovItem]   = useState(null)
  const [movQty, setMovQty]     = useState('')
  const [movNote, setMovNote]   = useState('')
  const [movSaving, setMovSaving] = useState(false)
  const [movDone, setMovDone]   = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('stock_items').select('*').eq('active', true).order('category').order('name')
    setItems(data || [])
    setLoading(false)
  }

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const filtered   = items.filter(i => activeCategory === 'all' || i.category === activeCategory)
  const alerts     = items.filter(i => getStatus(i) !== 'ok')

  // ── INVENTAIRE ────────────────────────────────────────────────────────
  function adjustQty(id, delta) {
    setEditQty(prev => {
      const cur = prev[id] !== undefined ? prev[id] : items.find(i => i.id === id)?.current_qty || 0
      return { ...prev, [id]: Math.max(0, parseFloat((cur + delta).toFixed(1))) }
    })
  }

  function setQtyDirect(id, val) {
    setEditQty(prev => ({ ...prev, [id]: Math.max(0, parseFloat(val) || 0) }))
  }

  async function saveInventaire(item) {
    const newQty = editQty[item.id]
    if (newQty === undefined || newQty === item.current_qty) {
      setEditQty(prev => { const n = {...prev}; delete n[item.id]; return n })
      return
    }
    setSaving(item.id)
    const delta = newQty - item.current_qty
    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id),
      supabase.from('stock_movements').insert({ item_id: item.id, type: 'adjustment', qty: delta, note: 'Inventaire', done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_qty: newQty } : i))
    setEditQty(prev => { const n = {...prev}; delete n[item.id]; return n })
    setSaving(null)
  }

  // ── MOUVEMENT ─────────────────────────────────────────────────────────
  async function saveMouvement() {
    if (!movItem || !movQty) return
    setMovSaving(true)
    const qty    = parseFloat(movQty)
    const delta  = movType === 'reception' ? qty : -qty
    const newQty = Math.max(0, movItem.current_qty + delta)
    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', movItem.id),
      supabase.from('stock_movements').insert({ item_id: movItem.id, type: movType, qty: delta, note: movNote || null, done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === movItem.id ? { ...i, current_qty: newQty } : i))
    setMovSaving(false)
    setMovDone(true)
    setMovQty('')
    setMovNote('')
    setTimeout(() => { setMovDone(false); setMovItem(null) }, 1500)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Stock</h1>
            <p className="page-subtitle">
              {format(new Date(), "EEE d MMM", { locale: fr })}
              {alerts.length > 0 ? ` · ⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}` : ' · Tout OK'}
            </p>
          </div>
        </div>
      </div>

      <div className="page-content">

        {/* TABS */}
        <div className="tabs" style={{ marginBottom: '1rem' }}>
          <button className={`tab-btn${tab === 'inventaire' ? ' active' : ''}`} onClick={() => setTab('inventaire')}>
            <ClipboardList size={14} style={{ display: 'inline', marginRight: 4 }} />
            Inventaire
          </button>
          <button className={`tab-btn${tab === 'mouvement' ? ' active' : ''}`} onClick={() => setTab('mouvement')}>
            <TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />
            Mouvement
          </button>
        </div>

        {/* ALERTES */}
        {alerts.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {alerts.map(item => {
              const st = STATUS_CONFIG[getStatus(item)]
              return (
                <div key={item.id} style={{ background: st.bg, borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
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
            const cnt      = cat === 'all' ? items.length : items.filter(i => i.category === cat).length
            const hasAlert = cat !== 'all' && items.filter(i => i.category === cat).some(i => getStatus(i) !== 'ok')
            return (
              <button key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {hasAlert && '⚠️ '}{cat === 'all' ? 'Tout' : cat} <span style={{ opacity: 0.65 }}>({cnt})</span>
              </button>
            )
          })}
        </div>

        {/* ── ONGLET INVENTAIRE ─────────────────────────────────────── */}
        {tab === 'inventaire' && (
          <>
            <div className="card">
              {filtered.map((item, idx) => {
                const status   = getStatus(item)
                const st       = STATUS_CONFIG[status]
                const edited   = editQty[item.id] !== undefined
                const dispQty  = edited ? editQty[item.id] : item.current_qty
                const isSaving = saving === item.id

                return (
                  <div key={item.id} style={{
                    padding: '0.85rem 1rem',
                    borderBottom: idx < filtered.length - 1 ? '1.5px solid var(--outside-cream)' : 'none',
                    display: 'flex', alignItems: 'center', gap: '10px'
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '1px' }}>
                        min {item.min_qty} {item.unit}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button className="btn btn-ghost btn-icon"
                        style={{ width: 30, height: 30, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                        onClick={() => adjustQty(item.id, -1)}>
                        <Minus size={13} />
                      </button>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                        <input type="number" min="0" step="0.5" value={dispQty}
                          onChange={e => setQtyDirect(item.id, e.target.value)}
                          style={{
                            width: 52, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem',
                            border: `2px solid ${edited ? 'var(--outside-orange)' : 'var(--outside-cream2)'}`,
                            borderRadius: 'var(--radius-sm)', padding: '3px 2px',
                            fontFamily: 'var(--font-body)', background: edited ? '#FFF8F5' : 'white',
                            color: 'var(--outside-dark)', outline: 'none',
                          }} />
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700 }}>{item.unit}</span>
                      </div>

                      <button className="btn btn-ghost btn-icon"
                        style={{ width: 30, height: 30, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                        onClick={() => adjustQty(item.id, 1)}>
                        <Plus size={13} />
                      </button>

                      <button className="btn btn-icon"
                        style={{
                          width: 30, height: 30,
                          background: edited ? 'var(--outside-green)' : 'transparent',
                          borderRadius: 'var(--radius-sm)', border: 'none',
                          opacity: edited ? 1 : 0, pointerEvents: edited ? 'auto' : 'none', transition: 'all 0.15s',
                        }}
                        onClick={() => saveInventaire(item)} disabled={isSaving}>
                        {isSaving ? <Spinner size={13} /> : <Check size={13} color="white" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: '0.75rem', fontWeight: 600 }}>
              Modifie la quantite puis ✓ pour sauvegarder
            </p>
          </>
        )}

        {/* ── ONGLET MOUVEMENT ──────────────────────────────────────── */}
        {tab === 'mouvement' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* TYPE */}
            <div className="tabs">
              <button className={`tab-btn${movType === 'reception' ? ' active' : ''}`} onClick={() => setMovType('reception')}>
                <TrendingUp size={14} style={{ display: 'inline', marginRight: 4 }} />
                Reception
              </button>
              <button className={`tab-btn${movType === 'usage' ? ' active' : ''}`} onClick={() => setMovType('usage')}>
                <TrendingDown size={14} style={{ display: 'inline', marginRight: 4 }} />
                Consommation
              </button>
            </div>

            {/* SELECTION PRODUIT */}
            <div className="card" style={{ padding: '1rem' }}>
              <label className="form-label">Produit</label>
              <select className="form-select" value={movItem?.id || ''} onChange={e => setMovItem(items.find(i => i.id === parseInt(e.target.value)) || null)}>
                <option value="">Choisir un produit...</option>
                {categories.filter(c => c !== 'all').map(cat => (
                  <optgroup key={cat} label={cat}>
                    {items.filter(i => i.category === cat).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} — {i.current_qty} {i.unit}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {movItem && (
                <div style={{ marginTop: '0.75rem', padding: '8px 12px', background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Stock actuel</span>
                  <span style={{ fontWeight: 800, color: STATUS_CONFIG[getStatus(movItem)].color }}>
                    {movItem.current_qty} {movItem.unit}
                  </span>
                </div>
              )}
            </div>

            {/* QUANTITE + NOTE */}
            {movItem && (
              <div className="card" style={{ padding: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Quantite {movType === 'reception' ? 'recue' : 'consommee'} ({movItem.unit})
                  </label>
                  <input className="form-input" type="number" min="0" step="0.5"
                    placeholder="ex: 500"
                    value={movQty} onChange={e => setMovQty(e.target.value)}
                    autoFocus />
                </div>

                {/* PREVIEW */}
                {movQty && parseFloat(movQty) > 0 && (
                  <div style={{ padding: '8px 12px', background: movType === 'reception' ? '#E0F2EB' : '#FEF3DC', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600 }}>Nouveau stock</span>
                    <span style={{ fontWeight: 800 }}>
                      {movType === 'reception'
                        ? (movItem.current_qty + parseFloat(movQty)).toFixed(1)
                        : Math.max(0, movItem.current_qty - parseFloat(movQty)).toFixed(1)
                      } {movItem.unit}
                    </span>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Note (optionnel)</label>
                  <input className="form-input" type="text"
                    placeholder={movType === 'reception' ? 'ex: Livraison fournisseur' : 'ex: Service du matin'}
                    value={movNote} onChange={e => setMovNote(e.target.value)} />
                </div>
              </div>
            )}

            {/* BOUTON VALIDER */}
            {movItem && movQty && (
              <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
                onClick={saveMouvement} disabled={movSaving || movDone}>
                {movSaving
                  ? <Spinner size={18} />
                  : movDone
                    ? <><Check size={18} /> Enregistre !</>
                    : movType === 'reception'
                      ? <><TrendingUp size={18} /> Enregistrer la reception</>
                      : <><TrendingDown size={18} /> Enregistrer la consommation</>
                }
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
