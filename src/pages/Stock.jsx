import { useState, useEffect } from 'react'
import { Plus, Minus, Check, TrendingUp, TrendingDown, ClipboardList, Search, ChevronRight, Settings, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner } from '../components/UI'
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
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('inventaire')

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('stock_items').select('*').eq('active', true).order('category').order('name')
    setItems(data || [])
    setLoading(false)
  }

  const alerts = items.filter(i => getStatus(i) !== 'ok')

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><Spinner size={32} /></div>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Stock</h1>
        <p className="page-subtitle">
          {format(new Date(), "EEE d MMM", { locale: fr })}
          {alerts.length > 0 ? ` · ⚠️ ${alerts.length} alerte${alerts.length > 1 ? 's' : ''}` : ' · Tout OK'}
        </p>
      </div>

      <div className="page-content">
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn${tab === 'inventaire' ? ' active' : ''}`} onClick={() => setTab('inventaire')}>
            <ClipboardList size={14} style={{ display: 'inline', marginRight: 5 }} />
            Inventaire
          </button>
          <button className={`tab-btn${tab === 'mouvement' ? ' active' : ''}`} onClick={() => setTab('mouvement')}>
            <TrendingUp size={14} style={{ display: 'inline', marginRight: 5 }} />
            Mouvement
          </button>
        </div>

        {tab === 'inventaire' && <TabInventaire items={items} setItems={setItems} alerts={alerts} />}
        {tab === 'mouvement'  && <TabMouvement  items={items} setItems={setItems} />}
      </div>
    </>
  )
}

// ── ONGLET INVENTAIRE ─────────────────────────────────────────────────────
function TabInventaire({ items, setItems, alerts }) {
  const { profile } = useAuth()
  const [activeCategory, setActiveCategory] = useState('all')
  const [editQty, setEditQty]       = useState({})
  const [saving, setSaving]         = useState(null)
  const [editSeuil, setEditSeuil]   = useState(null) // item en cours d'édition seuil
  const [seuilForm, setSeuilForm]   = useState({ min_qty: '', ideal_qty: '' })
  const [seuilSaving, setSeuilSaving] = useState(false)

  const isManager = hasRole(profile, 'manager')
  const categories = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const filtered   = items.filter(i => activeCategory === 'all' || i.category === activeCategory)

  // ── Inventaire ──────────────────────────────────────────────────────
  function adjustQty(id, delta) {
    setEditQty(prev => {
      const cur = prev[id] !== undefined ? prev[id] : items.find(i => i.id === id)?.current_qty || 0
      return { ...prev, [id]: Math.max(0, parseFloat((cur + delta).toFixed(1))) }
    })
  }

  function setQtyDirect(id, val) {
    setEditQty(prev => ({ ...prev, [id]: Math.max(0, parseFloat(val) || 0) }))
  }

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
      supabase.from('stock_movements').insert({ item_id: item.id, type: 'adjustment', qty: delta, note: 'Inventaire', done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_qty: newQty } : i))
    setEditQty(prev => { const n = {...prev}; delete n[item.id]; return n })
    setSaving(null)
  }

  // ── Seuils ──────────────────────────────────────────────────────────
  function openSeuil(item) {
    setEditSeuil(item)
    setSeuilForm({ min_qty: item.min_qty, ideal_qty: item.ideal_qty })
  }

  async function saveSeuil() {
    if (!editSeuil) return
    setSeuilSaving(true)
    const update = {
      min_qty:   parseFloat(seuilForm.min_qty)   || 0,
      ideal_qty: parseFloat(seuilForm.ideal_qty) || 0,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('stock_items').update(update).eq('id', editSeuil.id)
    setItems(prev => prev.map(i => i.id === editSeuil.id ? { ...i, ...update } : i))
    setSeuilSaving(false)
    setEditSeuil(null)
  }

  return (
    <>
      {/* ALERTES */}
      {alerts.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          {alerts.map(item => {
            const st = STATUS_CONFIG[getStatus(item)]
            return (
              <div key={item.id} style={{ background: st.bg, borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, color: st.color, flex: 1, fontSize: '0.875rem' }}>{item.name}</span>
                <span style={{ fontWeight: 800, color: st.color, fontSize: '0.875rem' }}>{item.current_qty} {item.unit}</span>
                <span style={{ fontSize: '0.68rem', color: st.color, opacity: 0.7 }}>min {item.min_qty}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* CATEGORIES */}
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

      {/* LISTE */}
      <div className="card">
        {filtered.map((item, idx) => {
          const st       = STATUS_CONFIG[getStatus(item)]
          const edited   = editQty[item.id] !== undefined
          const dispQty  = edited ? editQty[item.id] : item.current_qty
          const isSaving = saving === item.id

          return (
            <div key={item.id} style={{
              borderBottom: idx < filtered.length - 1 ? '1.5px solid var(--outside-cream)' : 'none',
            }}>
              {/* LIGNE PRINCIPALE */}
              <div style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '1px' }}>
                    min <span style={{ fontWeight: 800, color: getStatus(item) !== 'ok' ? st.color : 'var(--muted)' }}>{item.min_qty}</span>
                    {item.ideal_qty > 0 && <> · idéal {item.ideal_qty}</>}
                    <span style={{ color: 'var(--muted)' }}> {item.unit}</span>
                  </div>
                </div>

                {/* CONTROLES QUANTITE */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon"
                    style={{ width: 30, height: 30, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => adjustQty(item.id, -1)}><Minus size={13} /></button>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                    <input type="number" min="0" step="0.5" value={dispQty}
                      onChange={e => setQtyDirect(item.id, e.target.value)}
                      style={{ width: 52, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', border: `2px solid ${edited ? 'var(--outside-orange)' : 'var(--outside-cream2)'}`, borderRadius: 'var(--radius-sm)', padding: '3px 2px', fontFamily: 'var(--font-body)', background: edited ? '#FFF8F5' : 'white', color: 'var(--outside-dark)', outline: 'none' }} />
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700 }}>{item.unit}</span>
                  </div>

                  <button className="btn btn-ghost btn-icon"
                    style={{ width: 30, height: 30, background: 'var(--outside-cream)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => adjustQty(item.id, 1)}><Plus size={13} /></button>

                  {/* SAVE */}
                  <button className="btn btn-icon"
                    style={{ width: 30, height: 30, background: edited ? 'var(--outside-green)' : 'transparent', borderRadius: 'var(--radius-sm)', border: 'none', opacity: edited ? 1 : 0, pointerEvents: edited ? 'auto' : 'none', transition: 'all 0.15s' }}
                    onClick={() => saveItem(item)} disabled={isSaving}>
                    {isSaving ? <Spinner size={13} /> : <Check size={13} color="white" />}
                  </button>

                  {/* SEUILS — manager only */}
                  {isManager && (
                    <button className="btn btn-ghost btn-icon"
                      style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', opacity: 0.6 }}
                      onClick={() => openSeuil(item)} title="Modifier les seuils">
                      <Settings size={13} />
                    </button>
                  )}
                </div>
              </div>


            </div>
          )
        })}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: '0.75rem', fontWeight: 600 }}>
        Modifie la quantite puis ✓ pour sauvegarder
      </p>

      {/* MODAL SEUILS */}
      {editSeuil && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(29,58,58,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
          onClick={e => e.target === e.currentTarget && setEditSeuil(null)}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', width: '100%', maxWidth: 560, padding: '1.5rem 1.25rem', boxShadow: 'var(--shadow-lg)' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Seuils d'alerte</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px', fontWeight: 600 }}>{editSeuil.name}</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditSeuil(null)}><X size={18} /></button>
            </div>

            {/* STOCK ACTUEL */}
            <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>Stock actuel</span>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: STATUS_CONFIG[getStatus(editSeuil)].color }}>
                {editSeuil.current_qty} {editSeuil.unit}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label">
                  Seuil minimum ({editSeuil.unit})
                  <span style={{ fontSize: '0.65rem', display: 'block', fontWeight: 600, color: 'var(--outside-amber)', marginTop: '1px' }}>
                    → Alerte "Bas"
                  </span>
                </label>
                <input className="form-input" type="number" min="0" step="0.5"
                  value={seuilForm.min_qty}
                  onChange={e => setSeuilForm(p => ({ ...p, min_qty: e.target.value }))}
                  style={{ fontWeight: 800, textAlign: 'center', fontSize: '1.1rem' }} />
              </div>
              <div>
                <label className="form-label">
                  Stock idéal ({editSeuil.unit})
                  <span style={{ fontSize: '0.65rem', display: 'block', fontWeight: 600, color: 'var(--outside-green)', marginTop: '1px' }}>
                    → Barre de niveau
                  </span>
                </label>
                <input className="form-input" type="number" min="0" step="0.5"
                  value={seuilForm.ideal_qty}
                  onChange={e => setSeuilForm(p => ({ ...p, ideal_qty: e.target.value }))}
                  style={{ fontWeight: 800, textAlign: 'center', fontSize: '1.1rem' }} />
              </div>
            </div>

            {/* PREVIEW */}
            <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#B03A1A' }} />
                <span>En dessous de <strong style={{ color: 'var(--ink)' }}>{parseFloat(seuilForm.min_qty || 0) * 0.5} {editSeuil.unit}</strong> → Critique</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D4892A' }} />
                <span>En dessous de <strong style={{ color: 'var(--ink)' }}>{seuilForm.min_qty || 0} {editSeuil.unit}</strong> → Bas</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A5C4A' }} />
                <span>Au dessus → OK</span>
              </div>
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={saveSeuil} disabled={seuilSaving}>
              {seuilSaving ? <Spinner size={18} /> : <Check size={18} />} Enregistrer les seuils
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── ONGLET MOUVEMENT ──────────────────────────────────────────────────────
function TabMouvement({ items, setItems }) {
  const { profile } = useAuth()
  const [step, setStep]       = useState(1)
  const [movType, setMovType] = useState(null)
  const [movItem, setMovItem] = useState(null)
  const [search, setSearch]   = useState('')
  const [movQty, setMovQty]   = useState('')
  const [movNote, setMovNote] = useState('')
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState(false)

  const filtered   = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))
  const categories = [...new Set(filtered.map(i => i.category))].sort()

  async function saveMouvement() {
    if (!movItem || !movQty) return
    setSaving(true)
    const qty    = parseFloat(movQty)
    const delta  = movType === 'reception' ? qty : -qty
    const newQty = Math.max(0, movItem.current_qty + delta)
    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', movItem.id),
      supabase.from('stock_movements').insert({ item_id: movItem.id, type: movType, qty: delta, note: movNote || null, done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === movItem.id ? { ...i, current_qty: newQty } : i))
    setSaving(false)
    setDone(true)
  }

  function reset() {
    setStep(1); setMovType(null); setMovItem(null)
    setSearch(''); setMovQty(''); setMovNote(''); setDone(false)
  }

  // ÉTAPE 1 — TYPE
  if (step === 1) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <p style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600, textAlign: 'center', marginBottom: '4px' }}>
        Quel type de mouvement ?
      </p>
      {[
        { type: 'reception', icon: <TrendingUp size={22} color="#1A5C4A" />, bg: '#E0F2EB', label: 'Reception', sub: 'Livraison fournisseur, reappro...' },
        { type: 'usage',     icon: <TrendingDown size={22} color="#8A5200" />, bg: '#FEF3DC', label: 'Consommation', sub: 'Usage, casse, perte...' },
      ].map(opt => (
        <button key={opt.type} onClick={() => { setMovType(opt.type); setStep(2) }}
          style={{ background: 'white', border: '2px solid var(--outside-cream2)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', display: 'flex', gap: '14px', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: opt.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{opt.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--outside-dark)' }}>{opt.label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '2px' }}>{opt.sub}</div>
          </div>
          <ChevronRight size={18} color="var(--muted)" />
        </button>
      ))}
    </div>
  )

  // ÉTAPE 2 — PRODUIT
  if (step === 2) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)} style={{ padding: '4px 8px' }}>← Retour</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: movType === 'reception' ? '#1A5C4A' : '#8A5200' }}>
          {movType === 'reception' ? '📦 Reception' : '📉 Consommation'}
        </div>
      </div>
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input className="form-input" style={{ paddingLeft: '36px' }} placeholder="Rechercher..." value={search} autoFocus onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {categories.map(cat => (
          <div key={cat}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', padding: '4px 0', marginBottom: '4px' }}>{cat}</div>
            <div className="card">
              {filtered.filter(i => i.category === cat).map((item, idx, arr) => {
                const st = STATUS_CONFIG[getStatus(item)]
                return (
                  <button key={item.id} onClick={() => { setMovItem(item); setStep(3) }}
                    style={{ width: '100%', padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: idx < arr.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem' }}>{item.name}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: st.color }}>{item.current_qty} {item.unit}</div>
                    <ChevronRight size={15} color="var(--muted)" />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ÉTAPE 3 — QUANTITE
  if (step === 3) {
    const qty    = parseFloat(movQty) || 0
    const newQty = qty > 0 ? Math.max(0, movType === 'reception' ? movItem.current_qty + qty : movItem.current_qty - qty) : null

    if (done) return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', gap: '1rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E0F2EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={32} color="#1A5C4A" />
        </div>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--outside-dark)' }}>Enregistre !</div>
        <div style={{ fontSize: '0.875rem', color: 'var(--muted)', textAlign: 'center' }}>
          {movItem.name} : {newQty?.toFixed(1)} {movItem.unit}
        </div>
        <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={reset}>Nouveau mouvement</button>
      </div>
    )

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setStep(2)} style={{ padding: '4px 8px' }}>← Retour</button>
          <div style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: movType === 'reception' ? '#1A5C4A' : '#8A5200' }}>
            {movType === 'reception' ? '📦 Reception' : '📉 Consommation'}
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{movItem.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>Stock actuel</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: STATUS_CONFIG[getStatus(movItem)].color }}>
              {movItem.current_qty} {movItem.unit}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <label className="form-label">Quantite {movType === 'reception' ? 'recue' : 'consommee'} ({movItem.unit})</label>
          <input className="form-input" type="number" min="0" step="0.5" placeholder="ex: 500"
            value={movQty} onChange={e => setMovQty(e.target.value)} autoFocus
            style={{ fontSize: '1.2rem', fontWeight: 800, textAlign: 'center' }} />

          {newQty !== null && (
            <div style={{ marginTop: '0.75rem', padding: '10px 14px', background: movType === 'reception' ? '#E0F2EB' : '#FEF3DC', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Nouveau stock</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: movType === 'reception' ? '#1A5C4A' : '#8A5200' }}>
                {newQty.toFixed(1)} {movItem.unit}
              </span>
            </div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <label className="form-label">Note (optionnel)</label>
            <input className="form-input" type="text"
              placeholder={movType === 'reception' ? 'ex: Livraison Metro' : 'ex: Service matin'}
              value={movNote} onChange={e => setMovNote(e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
          onClick={saveMouvement} disabled={!movQty || qty <= 0 || saving}>
          {saving ? <Spinner size={18} /> : movType === 'reception'
            ? <><TrendingUp size={18} /> Enregistrer la reception</>
            : <><TrendingDown size={18} /> Enregistrer la consommation</>}
        </button>
      </div>
    )
  }
}
