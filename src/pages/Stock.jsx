import { useState, useEffect, useRef } from 'react'
import { Check, TrendingUp, TrendingDown, Settings, X, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_CONFIG = {
  ok:       { dot: '#1A5C4A', bg: '#E0F2EB', color: '#1A5C4A' },
  low:      { dot: '#D4892A', bg: '#FEF3DC', color: '#8A5200' },
  critical: { dot: '#B03A1A', bg: '#FDEEEC', color: '#8B2A1E' },
}
function getStatus(i) {
  if (i.current_qty <= i.min_qty * 0.5) return 'critical'
  if (i.current_qty <= i.min_qty)       return 'low'
  return 'ok'
}

export default function Stock() {
  const { profile } = useAuth()
  const isManager = hasRole(profile, 'manager')

  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch]         = useState('')

  // Inventaire — édition inline
  const [editId, setEditId]         = useState(null)
  const [editVal, setEditVal]       = useState('')
  const [saving, setSaving]         = useState(null)
  const editRef = useRef(null)

  // Mouvement — sheet bas de page
  const [movSheet, setMovSheet]     = useState(null) // { item, mode: 'reception'|'usage' }
  const [movQty, setMovQty]         = useState('')
  const [movNote, setMovNote]       = useState('')
  const [movPrice, setMovPrice]     = useState('')
  const [movSaving, setMovSaving]   = useState(false)
  const [movFournisseur, setMovFournisseur] = useState('')
  const [formats, setFormats]           = useState({}) // { itemId: [formats] }
  const [movFormat, setMovFormat]       = useState(null)
  const [formatQty, setFormatQty]       = useState('1')
  const [facture, setFacture]       = useState(null)  // File object
  const [factureUploading, setFactureUploading] = useState(false)
  const [movDone, setMovDone]       = useState(false)

  // Seuils
  const [seuilItem, setSeuilItem]   = useState(null)
  const [seuilForm, setSeuilForm]   = useState({ min_qty: '', ideal_qty: '' })
  const [seuilSaving, setSeuilSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])
  useEffect(() => { if (editRef.current) editRef.current.focus() }, [editId])

  async function fetchItems() {
    const [{ data: si }, { data: mp }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active', true).order('category').order('name'),
      supabase.from('matiere_premiere').select('matiere, prix, quantite, unite, actif'),
    ])
    // Map des matières actives
    const mpMap = {}
    const mpActif = new Set()
    for (const m of (mp || [])) {
      mpMap[m.matiere] = m.quantite > 0 ? parseFloat(m.prix||0) / parseFloat(m.quantite) : null
      if (m.actif !== false) mpActif.add(m.matiere)
    }
    // Exclure les items dont la matière est désactivée dans Catalogue
    const enriched = (si || [])
      .filter(item => !item.matiere_ref || mpActif.has(item.matiere_ref))
      .map(item => ({
        ...item,
        prixUnitaire: item.matiere_ref ? (mpMap[item.matiere_ref] || null) : null,
      }))
    setItems(enriched)
    setLoading(false)
  }

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category))).sort()]
  const alerts     = items.filter(i => getStatus(i) !== 'ok')
  const filtered   = items
    .filter(i => activeCategory === 'all' || i.category === activeCategory)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()))

  // ── INVENTAIRE INLINE ────────────────────────────────────────────────
  function startEdit(item) {
    setEditId(item.id)
    setEditVal(String(item.current_qty))
  }

  async function saveEdit(item) {
    const newQty = parseFloat(editVal)
    if (isNaN(newQty) || newQty === item.current_qty) { setEditId(null); return }
    setSaving(item.id)
    const delta = newQty - item.current_qty
    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', item.id),
      supabase.from('stock_movements').insert({ item_id: item.id, type: 'adjustment', qty: delta, note: 'Inventaire', done_by: profile?.id }),
    ])
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, current_qty: newQty } : i))
    setEditId(null)
    setSaving(null)
  }

  // ── MOUVEMENT SHEET ──────────────────────────────────────────────────
  function openSheet(item, mode) {
    setMovSheet({ item, mode })
    setMovQty(''); setMovNote(''); setMovPrice(''); setMovFournisseur(''); setFacture(null); setMovDone(false); setMovFormat(null); setFormatQty('1')
    fetchFormats(item.id, item.name)
  }

  async function fetchFormats(itemId, itemName) {
    if (formats[itemId] !== undefined) return
    // Normalise accents pour le matching
    const { data } = await supabase
      .from('matiere_formats')
      .select('*')
      .eq('actif', true)
      .order('poids')
    if (!data) return
    // Matching souple : normalise les deux côtés
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
    const matched = data.filter(f => norm(f.matiere) === norm(itemName))
    setFormats(prev => ({ ...prev, [itemId]: matched }))
  }

  async function saveMouvement() {
    if (!movSheet || !movQty) return
    setMovSaving(true)
    const qty    = parseFloat(movQty)
    const delta  = movSheet.mode === 'reception' ? qty : -qty
    const newQty = Math.max(0, movSheet.item.current_qty + delta)
    let note     = movNote || null
    if (movSheet.mode === 'reception' && movPrice) note = [note, `Prix: ${movPrice} DT`].filter(Boolean).join(' — ')

    // Upload facture si présente
    let facture_url = null
    if (facture && movSheet.mode === 'reception') {
      setFactureUploading(true)
      const ext  = facture.name.split('.').pop()
      const path = `${Date.now()}_${movSheet.item.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('factures').upload(path, facture)
      if (!upErr) facture_url = path
      setFactureUploading(false)
    }

    await Promise.all([
      supabase.from('stock_items').update({ current_qty: newQty, updated_at: new Date().toISOString() }).eq('id', movSheet.item.id),
      supabase.from('stock_movements').insert({
        item_id: movSheet.item.id, type: movSheet.mode, qty: delta,
        note, done_by: profile?.id,
        fournisseur: movFournisseur || null,
        facture_url,
      }),
    ])
    setItems(prev => prev.map(i => i.id === movSheet.item.id ? { ...i, current_qty: newQty } : i))
    setMovSaving(false)
    setMovDone(true)
    setTimeout(() => setMovSheet(null), 1200)
  }

  // ── SEUILS ───────────────────────────────────────────────────────────
  async function saveSeuil() {
    if (!seuilItem) return
    setSeuilSaving(true)
    const update = { min_qty: parseFloat(seuilForm.min_qty) || 0, ideal_qty: parseFloat(seuilForm.ideal_qty) || 0, updated_at: new Date().toISOString() }
    await supabase.from('stock_items').update(update).eq('id', seuilItem.id)
    setItems(prev => prev.map(i => i.id === seuilItem.id ? { ...i, ...update } : i))
    setSeuilSaving(false)
    setSeuilItem(null)
  }

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
                  <span style={{ fontSize: '0.68rem', color: st.color, opacity: 0.7 }}>min {item.min_qty}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* CATEGORIES */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: 4, marginBottom: '1rem', scrollbarWidth: 'none', marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          {categories.map(cat => {
            const cnt = cat === 'all' ? items.length : items.filter(i => i.category === cat).length
            const hasAlert = cat !== 'all' && items.filter(i => i.category === cat).some(i => getStatus(i) !== 'ok')
            return (
              <button key={cat} className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {hasAlert && '⚠️ '}{cat === 'all' ? 'Tout' : cat} <span style={{ opacity: 0.65 }}>({cnt})</span>
              </button>
            )
          })}
        </div>

        {/* LISTE */}
        <div className="card">
          {filtered.map((item, idx) => {
            const st      = STATUS_CONFIG[getStatus(item)]
            const isEditing = editId === item.id
            const isSaving  = saving === item.id

            return (
              <div key={item.id} style={{ padding: '0.75rem 1rem', borderBottom: idx < filtered.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>

                {/* DOT STATUS */}
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />

                {/* NOM */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: 1 }}>min {item.min_qty} {item.unit}</div>
                </div>

                {/* STOCK ACTUEL — tap pour éditer */}
                <div
                  onClick={() => !isEditing && startEdit(item)}
                  style={{ cursor: 'pointer', flexShrink: 0, minWidth: 64, textAlign: 'right' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        ref={editRef}
                        type="number" min="0" step="0.5"
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') setEditId(null) }}
                        style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', border: '2px solid var(--outside-orange)', borderRadius: 'var(--radius-sm)', padding: '3px 4px', fontFamily: 'var(--font-body)', outline: 'none', background: '#FFF8F5' }}
                      />
                      <button
                        onClick={e => { e.stopPropagation(); saveEdit(item) }}
                        disabled={isSaving}
                        style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--outside-green)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        {isSaving ? <Spinner size={12} /> : <Check size={13} color="white" />}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: st.color, lineHeight: 1 }}>{item.current_qty}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 700 }}>{item.unit}</div>
                    </div>
                  )}
                </div>

                {/* BOUTONS MOUVEMENT */}
                {!isEditing && (
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => openSheet(item, 'reception')}
                      title="Réception"
                      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', background: '#E0F2EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={15} color="#1A5C4A" />
                    </button>
                    <button
                      onClick={() => openSheet(item, 'usage')}
                      title="Consommation"
                      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', background: '#FEF3DC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown size={15} color="#8A5200" />
                    </button>
                    {isManager && (
                      <button
                        onClick={() => { setSeuilItem(item); setSeuilForm({ min_qty: item.min_qty, ideal_qty: item.ideal_qty }) }}
                        style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--outside-cream)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Settings size={14} color="var(--muted)" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <p style={{ fontSize: '0.72rem', color: 'var(--muted)', textAlign: 'center', marginTop: '0.75rem', fontWeight: 600 }}>
          Tap sur la quantité pour modifier · ↑ réception · ↓ consommation
        </p>
      </div>

      {/* ── SHEET MOUVEMENT ─────────────────────────────────────────────── */}
      {movSheet && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(29,58,58,0.45)', zIndex: 500, backdropFilter: 'blur(2px)' }} onClick={() => setMovSheet(null)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', padding: '1.25rem', zIndex: 600, boxShadow: 'var(--shadow-lg)', maxWidth: 560, margin: '0 auto' }}>

            {/* HANDLE */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--outside-cream2)', margin: '0 auto 1rem' }} />

            {movDone ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem 0', gap: '8px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E0F2EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={24} color="#1A5C4A" />
                </div>
                <div style={{ fontWeight: 800, color: 'var(--outside-dark)' }}>Enregistré !</div>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{movSheet.item.name}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)' }}>Stock actuel</span>
                      <span style={{ fontWeight: 800, color: STATUS_CONFIG[getStatus(movSheet.item)].color }}>
                        {movSheet.item.current_qty} {movSheet.item.unit}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setMovSheet(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* TYPE TOGGLE */}
                <div className="tabs" style={{ marginBottom: '1rem' }}>
                  <button className={`tab-btn${movSheet.mode === 'reception' ? ' active' : ''}`} onClick={() => setMovSheet(s => ({ ...s, mode: 'reception' }))}>
                    <TrendingUp size={14} style={{ display: 'inline', marginRight: 5 }} /> Réception
                  </button>
                  <button className={`tab-btn${movSheet.mode === 'usage' ? ' active' : ''}`} onClick={() => setMovSheet(s => ({ ...s, mode: 'usage' }))}>
                    <TrendingDown size={14} style={{ display: 'inline', marginRight: 5 }} /> Consommation
                  </button>
                </div>

                {/* FORMAT (si disponible) */}
                {formats[movSheet.item.id]?.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Format</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: movFormat ? '0.75rem' : 0 }}>
                      {formats[movSheet.item.id].map(f => {
                        const ppu = (parseFloat(f.prix) / parseFloat(f.poids)).toFixed(4)
                        const sel = movFormat?.id === f.id
                        return (
                          <button key={f.id}
                            onClick={() => {
                              setMovFormat(f)
                              setMovQty(String(f.poids))
                              setMovPrice(String(f.prix))
                              setFormatQty('1')
                            }}
                            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', border: `2px solid ${sel ? 'var(--outside-orange)' : 'var(--outside-cream2)'}`, background: sel ? '#FFF8F5' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: sel ? 'var(--outside-orange)' : 'var(--ink)' }}>{f.label}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: 2 }}>{f.poids} {movSheet.item.unit} · {parseFloat(f.prix).toFixed(2)} DT</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--outside-green)', fontWeight: 700 }}>{ppu} DT/{movSheet.item.unit}</div>
                          </button>
                        )
                      })}
                      <button
                        onClick={() => { setMovFormat(null); setMovQty(''); setMovPrice(''); setFormatQty('1') }}
                        style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', border: `2px solid ${!movFormat ? 'var(--outside-orange)' : 'var(--outside-cream2)'}`, background: !movFormat ? '#FFF8F5' : 'white', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)' }}>
                        Autre
                      </button>
                    </div>

                    {/* Quantité de formats */}
                    {movFormat && (
                      <div style={{ background: movSheet.mode === 'reception' ? 'var(--outside-cream)' : '#FEF3DC', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>
                          Nombre de {movFormat.label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => {
                              const n = Math.max(1, parseInt(formatQty||1) - 1)
                              setFormatQty(String(n))
                              setMovQty(String(n * movFormat.poids))
                              if (movSheet.mode === 'reception') setMovPrice(String((n * parseFloat(movFormat.prix)).toFixed(2)))
                            }}
                            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'white', fontSize: '1.3rem', fontWeight: 800, cursor: 'pointer', color: 'var(--outside-dark)' }}>−</button>
                          <input type="number" min="1"
                            value={formatQty}
                            onChange={e => {
                              const n = Math.max(1, parseInt(e.target.value)||1)
                              setFormatQty(String(n))
                              setMovQty(String(n * movFormat.poids))
                              if (movSheet.mode === 'reception') setMovPrice(String((n * parseFloat(movFormat.prix)).toFixed(2)))
                            }}
                            style={{ width: 60, textAlign: 'center', fontWeight: 800, fontSize: '1.2rem', border: `2px solid ${movSheet.mode === 'reception' ? 'var(--outside-orange)' : 'var(--outside-amber)'}`, borderRadius: 'var(--radius-sm)', padding: '4px', fontFamily: 'var(--font-body)', outline: 'none' }} />
                          <button
                            onClick={() => {
                              const n = parseInt(formatQty||1) + 1
                              setFormatQty(String(n))
                              setMovQty(String(n * movFormat.poids))
                              if (movSheet.mode === 'reception') setMovPrice(String((n * parseFloat(movFormat.prix)).toFixed(2)))
                            }}
                            style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'white', fontSize: '1.3rem', fontWeight: 800, cursor: 'pointer', color: 'var(--outside-dark)' }}>+</button>
                          <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                            = <strong style={{ color: movSheet.mode === 'reception' ? 'var(--outside-green)' : 'var(--outside-amber)' }}>{parseInt(formatQty||1) * movFormat.poids} {movSheet.item.unit}</strong>
                            {movSheet.mode === 'reception' && (
                              <div style={{ fontSize: '0.72rem' }}>{(parseInt(formatQty||1) * parseFloat(movFormat.prix)).toFixed(2)} DT</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* QUANTITE */}
                <div className="form-group">
                  <label className="form-label">Quantité ({movSheet.item.unit})</label>
                  <input className="form-input" type="number" min="0" step="0.5"
                    autoFocus={!formats[movSheet.item.id]?.length}
                    placeholder="ex: 500"
                    value={movQty} onChange={e => setMovQty(e.target.value)}
                    style={{ fontSize: '1.2rem', fontWeight: 800, textAlign: 'center' }} />
                </div>

                {/* PREVIEW */}
                {movQty && parseFloat(movQty) > 0 && (
                  <div style={{ padding: '8px 14px', background: movSheet.mode === 'reception' ? '#E0F2EB' : '#FEF3DC', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Nouveau stock</span>
                    <span style={{ fontWeight: 800, color: movSheet.mode === 'reception' ? '#1A5C4A' : '#8A5200' }}>
                      {Math.max(0, movSheet.item.current_qty + (movSheet.mode === 'reception' ? parseFloat(movQty) : -parseFloat(movQty))).toFixed(1)} {movSheet.item.unit}
                    </span>
                  </div>
                )}

                {/* PRIX (réception + manager) */}
                {movSheet.mode === 'reception' && isManager && (
                  <div className="form-group">
                    <label className="form-label">Prix d'achat (DT) <span style={{ opacity: 0.6, fontWeight: 600 }}>optionnel</span></label>
                    <input className="form-input" type="number" min="0" step="0.1" placeholder="ex: 38.00"
                      value={movPrice} onChange={e => setMovPrice(e.target.value)} />
                  </div>
                )}

                {/* FOURNISSEUR (réception) */}
                {movSheet.mode === 'reception' && (
                  <div className="form-group">
                    <label className="form-label">Fournisseur <span style={{ opacity: 0.6, fontWeight: 600 }}>optionnel</span></label>
                    <input className="form-input" type="text"
                      placeholder="ex: Metro, Carrefour..."
                      value={movFournisseur} onChange={e => setMovFournisseur(e.target.value)} />
                  </div>
                )}

                {/* FACTURE (réception + manager) */}
                {movSheet.mode === 'reception' && isManager && (
                  <div className="form-group">
                    <label className="form-label">
                      Facture <span style={{ opacity: 0.6, fontWeight: 600 }}>photo ou PDF</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1rem', border: `2px dashed ${facture ? 'var(--outside-green)' : 'var(--outside-cream2)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', background: facture ? '#F0FFF8' : 'white' }}>
                      <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                        onChange={e => setFacture(e.target.files?.[0] || null)} />
                      <span style={{ fontSize: '1.2rem' }}>{facture ? '✅' : '📄'}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: facture ? 'var(--outside-green)' : 'var(--muted)' }}>
                        {facture ? facture.name : 'Appuyer pour ajouter une facture'}
                      </span>
                      {facture && (
                        <button onClick={e => { e.preventDefault(); setFacture(null) }}
                          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontWeight: 800 }}>✕</button>
                      )}
                    </label>
                  </div>
                )}

                {/* NOTE */}
                <div className="form-group">
                  <label className="form-label">Note <span style={{ opacity: 0.6, fontWeight: 600 }}>optionnel</span></label>
                  <input className="form-input" type="text"
                    placeholder={movSheet.mode === 'reception' ? 'ex: Livraison Metro' : 'ex: Service matin'}
                    value={movNote} onChange={e => setMovNote(e.target.value)} />
                </div>

                <button className="btn btn-primary btn-lg"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={saveMouvement}
                  disabled={!movQty || parseFloat(movQty) <= 0 || movSaving}>
                  {movSaving || factureUploading ? <Spinner size={18} /> : movSheet.mode === 'reception'
                    ? <><TrendingUp size={18} /> Enregistrer la réception</>
                    : <><TrendingDown size={18} /> Enregistrer la consommation</>
                  }
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── SHEET SEUILS ────────────────────────────────────────────────── */}
      {seuilItem && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(29,58,58,0.45)', zIndex: 500, backdropFilter: 'blur(2px)' }} onClick={() => setSeuilItem(null)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0', padding: '1.25rem', zIndex: 600, boxShadow: 'var(--shadow-lg)', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--outside-cream2)', margin: '0 auto 1rem' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>Seuils d'alerte</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>{seuilItem.name}</div>
              </div>
              <button onClick={() => setSeuilItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Minimum ({seuilItem.unit})<span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--outside-amber)' }}>→ Alerte Bas</span></label>
                <input className="form-input" type="number" min="0" step="0.5"
                  value={seuilForm.min_qty} onChange={e => setSeuilForm(p => ({ ...p, min_qty: e.target.value }))}
                  style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }} />
              </div>
              <div>
                <label className="form-label">Idéal ({seuilItem.unit})<span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--outside-green)' }}>→ Objectif</span></label>
                <input className="form-input" type="number" min="0" step="0.5"
                  value={seuilForm.ideal_qty} onChange={e => setSeuilForm(p => ({ ...p, ideal_qty: e.target.value }))}
                  style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }} />
              </div>
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              onClick={saveSeuil} disabled={seuilSaving}>
              {seuilSaving ? <Spinner size={18} /> : <Check size={18} />} Enregistrer
            </button>
          </div>
        </>
      )}
    </>
  )
}
