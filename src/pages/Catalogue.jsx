import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { Plus, Trash2, Save, Search, ChevronDown, ChevronUp, Edit2, X } from 'lucide-react'

// ── ONGLET MATIÈRES PREMIÈRES ─────────────────────────────────────────────
function MatieresTab() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [items, setItems]       = useState([])
  const [formats, setFormats]   = useState([]) // tous les formats
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(false)
  const [edit, setEdit]         = useState(null)
  const [saving, setSaving]     = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [fmtModal, setFmtModal] = useState(null) // { matiere, format? }
  const [fmtSaving, setFmtSaving]           = useState(false)
  const [showInactive, setShowInactive]         = useState(false)
  const [activeCategory, setActiveCategory]     = useState('all')
  const [formatsModal, setFormatsModal]         = useState(null)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const [{ data: mp }, { data: fmt }] = await Promise.all([
      supabase.from('matiere_premiere').select('*').order('matiere'),
      supabase.from('matiere_formats').select('*').eq('actif', true).order('poids'),
    ])
    setItems(mp || [])
    setFormats(fmt || [])
    setLoading(false)
  }

  async function saveFormat(form) {
    setFmtSaving(true)
    if (form.id) {
      await supabase.from('matiere_formats').update(form).eq('id', form.id)
      setFormats(prev => prev.map(f => f.id === form.id ? { ...f, ...form } : f))
    } else {
      const { data } = await supabase.from('matiere_formats').insert(form).select().single()
      if (data) setFormats(prev => [...prev, data])
    }
    setFmtSaving(false); setFmtModal(null)
  }

  async function deleteFormat(id) {
    await supabase.from('matiere_formats').update({ actif: false }).eq('id', id)
    setFormats(prev => prev.filter(f => f.id !== id))
  }

  async function saveItem(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('matiere_premiere').update(form).eq('id', form.id)
      setItems(prev => prev.map(i => i.id === form.id ? { ...i, ...form } : i))
    } else {
      const { data } = await supabase.from('matiere_premiere').insert(form).select().single()
      if (data) setItems(prev => [...prev, data].sort((a,b) => a.matiere.localeCompare(b.matiere)))
    }
    setSaving(false); setModal(false); setEdit(null)
  }

  async function deleteItem(id) {
    if (!window.confirm('Supprimer cette matière ?')) return
    await supabase.from('matiere_premiere').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function toggleActive(item) {
    const newVal = item.actif === false ? true : false
    if (!newVal) {
      // Vérifier si utilisée en composition avant de désactiver
      const { count } = await supabase
        .from('composition_produit')
        .select('*', { count: 'exact', head: true })
        .ilike('matiere', item.matiere)
      if (count > 0) {
        alert(`Impossible de désactiver "${item.matiere}" : utilisée dans ${count} composition(s).\nRetirez-la des recettes d'abord.`)
        return
      }
    }
    const { error } = await supabase.from('matiere_premiere').update({ actif: newVal }).eq('id', item.id)
    if (error) {
      alert(error.message || 'Erreur lors de la modification')
      return
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, actif: newVal } : i))
  }

  const filtered = items
    .filter(i => showInactive ? i.actif === false : i.actif !== false)
    .filter(i => activeCategory === 'all' || i.categorie === activeCategory)
    .filter(i => !search || i.matiere.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className={`btn btn-sm ${showInactive ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setShowInactive(v => !v)}>
          {showInactive ? '✓ Actives' : '✕ Inactives'}
        </button>
        {isManager && <button className="btn btn-primary btn-sm" onClick={() => { setEdit(null); setModal(true) }}><Plus size={14} /></button>}
      </div>

      {/* Filtre catégorie */}
      {!loading && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: 4, marginBottom: '0.75rem', scrollbarWidth: 'none', marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          {['all', ...Array.from(new Set(items.map(i => i.categorie).filter(Boolean))).sort()].map(cat => (
            <button key={cat}
              className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveCategory(cat)}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              {cat === 'all' ? 'Tout' : cat}
            </button>
          ))}
        </div>
      )}

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div> : (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 8, padding: '0.5rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', background: 'var(--outside-cream)' }}>
            {['Matière','Unité','Quantité','Prix'].map(h => <div key={h} style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</div>)}
          </div>
          {filtered.map((item, idx) => {
            const itemFormats = formats.filter(f => f.matiere === item.matiere)
            const isOpen = expanded === item.matiere
            return (
              <div key={item.id}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 28px', gap: 8, padding: '0.7rem 1rem', borderBottom: (!isOpen && idx < filtered.length-1) ? '1.5px solid var(--outside-cream)' : 'none', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : item.matiere)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', color: item.actif === false ? 'var(--muted)' : 'inherit', textDecoration: item.actif === false ? 'line-through' : 'none', opacity: item.actif === false ? 0.5 : 1 }}>{item.matiere}</div>
                    {itemFormats.length > 0 && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--outside-orange)', fontWeight: 700, marginTop: 1 }}>{itemFormats.length} format{itemFormats.length > 1 ? 's' : ''}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{item.unite}</div>
                  <div style={{ fontSize: '0.8rem' }}>{item.quantite}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.prix} DT</span>
                    {isManager && (
                      <>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)', padding: 2 }} onClick={e => { e.stopPropagation(); setEdit(item); setModal(true) }}><Edit2 size={11} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm"
                        style={{ color: item.actif === false ? 'var(--outside-green)' : 'var(--danger)', padding: 2 }}
                        title={item.actif === false ? 'Réactiver' : 'Désactiver'}
                        onClick={e => { e.stopPropagation(); toggleActive(item) }}>
                        {item.actif === false ? '✓' : '✕'}
                      </button>
                      </>
                    )}
                  </div>
                  {isOpen ? <ChevronUp size={14} color="var(--muted)" /> : <ChevronDown size={14} color="var(--muted)" />}
                </div>

                {/* FORMATS */}
                {isOpen && (
                  <div style={{ background: 'var(--outside-cream)', padding: '0.5rem 1rem 0.75rem', borderBottom: idx < filtered.length-1 ? '1.5px solid var(--outside-cream2)' : 'none' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 6 }}>Formats disponibles</div>
                    {itemFormats.length === 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', marginBottom: 6 }}>Aucun format défini</div>
                    )}
                    {itemFormats.map(fmt => (
                      <div key={fmt.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'white', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{fmt.label}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 8 }}>{fmt.poids} {matiere?.unite || ""}</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--outside-dark)' }}>{parseFloat(fmt.prix).toFixed(2)} DT</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{fmt.poids > 0 ? (parseFloat(fmt.prix) / parseFloat(fmt.poids)).toFixed(4) : '—'} DT/{matiere?.unite || ""}</span>
                        {isManager && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)', padding: 2 }} onClick={() => setFmtModal({ matiere: item.matiere, format: fmt })}><Edit2 size={11} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)', padding: 2 }} onClick={() => deleteFormat(fmt.id)}><Trash2 size={11} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isManager && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', color: 'var(--outside-green)', marginTop: 4 }}
                        onClick={() => setFmtModal({ matiere: item.matiere, format: null })}>
                        <Plus size={12} /> Ajouter un format
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && isManager && (
        <MatiereModal item={edit} onClose={() => { setModal(false); setEdit(null) }} onSave={saveItem} saving={saving} />
      )}
      {fmtModal && isManager && (
        <FormatModal matiere={fmtModal.matiere} format={fmtModal.format} onClose={() => setFmtModal(null)} onSave={saveFormat} saving={fmtSaving} />
      )}
    </>
  )
}

function FormatModal({ matiere, format, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id:         format?.id || null,
    matiere,
    label: format?.label || '',
    poids: format?.poids || '',
    unite:      format?.unite || 'g',
    prix: format?.prix || '',
    actif:      true,
  })
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))
  const prixUnit = form.prix && form.poids ? (parseFloat(form.prix)/parseFloat(form.poids)).toFixed(4) : '—'
  return (
    <Modal open onClose={onClose} title={format ? 'Modifier le format' : 'Nouveau format'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.label || !form.poids || !form.prix || saving}
          onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div style={{ fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 700, marginBottom: '0.75rem' }}>{matiere}</div>
      <div className="form-group"><label className="form-label">Nom du format</label><input className="form-input" value={form.label} onChange={e => set('label', e.target.value)} placeholder="ex: Nestle 395g" autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Contenance</label><input className="form-input" type="number" step="0.1" value={form.poids} onChange={e => set('poids', parseFloat(e.target.value))} placeholder="ex: 395" /></div>
        <div className="form-group"><label className="form-label">Unité</label>
          <select className="form-select" value={form.unite} onChange={e => set('unite', e.target.value)}>
            {['g','kg','ml','L','unite'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.01" value={form.prix} onChange={e => set('prix', parseFloat(e.target.value))} placeholder="ex: 3.10" /></div>
      </div>
      <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>
        Prix unitaire : <strong style={{ color: 'var(--ink)' }}>{prixUnit} DT/{form.unite}</strong>
      </div>
    </Modal>
  )
}

// ── MODAL FORMATS ────────────────────────────────────────────────────────
function FormatsModal({ matiere, onClose }) {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [formats, setFormats] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ label: '', poids: '', prix: '' })
  const [saving, setSaving]   = useState(false)
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => { fetchFormats() }, [])

  async function fetchFormats() {
    const { data } = await supabase.from('matiere_formats')
      .select('*').eq('matiere', matiere.matiere).eq('actif', true).order('quantite')
    setFormats(data || [])
    setLoading(false)
  }

  async function addFormat() {
    if (!form.label || !form.quantite || !form.prix) return
    setSaving(true)

    const { data } = await supabase.from('matiere_formats').insert({
      matiere:   matiere.matiere,
      label:     form.label,
      poids:     parseFloat(form.poids),
      prix:      parseFloat(form.prix),
      actif:     true,
    }).select().single()
    if (data) setFormats(prev => [...prev, data])
    setForm({ label: '', quantite: '', prix: '' })
    setSaving(false)
  }

  async function deleteFormat(id) {
    await supabase.from('matiere_formats').update({ actif: false }).eq('id', id)
    setFormats(prev => prev.filter(f => f.id !== id))
  }

  return (
    <Modal open onClose={onClose} title={`Formats — ${matiere.matiere}`}
      footer={<button className="btn btn-primary" onClick={onClose}>Fermer</button>}>
      
      {loading ? <Spinner size={20} /> : (
        <>
          {formats.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', padding: '1rem' }}>Aucun format défini</div>
          ) : (
            <div className="card" style={{ marginBottom: '1rem' }}>
              {formats.map((f, idx) => {
                const ppu = parseFloat(f.prix) / parseFloat(f.poids)
                return (
                  <div key={f.id} style={{ padding: '0.65rem 1rem', borderBottom: idx < formats.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{f.label}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 1 }}>
                        {f.poids} {matiere.unite} · <span style={{ fontWeight: 700, color: 'var(--outside-orange)' }}>{parseFloat(f.prix).toFixed(2)} DT</span>
                        <span style={{ marginLeft: 8 }}>→ {ppu.toFixed(4)} DT/{matiere.unite}</span>
                      </div>
                    </div>
                    {isManager && (
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteFormat(f.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isManager && (
            <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.6rem' }}>Ajouter un format</div>
              <div className="form-group" style={{ marginBottom: '0.6rem' }}>
                <input className="form-input" placeholder="ex: Nestle 395g" value={form.label} onChange={e => set('label', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.6rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.68rem' }}>Poids ({matiere.unite})</label>
                  <input className="form-input" type="number" placeholder="ex: 395" value={form.poids} onChange={e => set('poids', e.target.value)} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.68rem' }}>Prix (DT)</label>
                  <input className="form-input" type="number" step="0.01" placeholder="ex: 3.10" value={form.prix} onChange={e => set('prix', e.target.value)} />
                </div>
              </div>
              {form.poids && form.prix && (
                <div style={{ fontSize: '0.75rem', color: 'var(--outside-green)', fontWeight: 700, marginBottom: '0.6rem' }}>
                  Prix unitaire : {(parseFloat(form.prix)/parseFloat(form.quantite)).toFixed(4)} DT/{matiere.unite}
                </div>
              )}
              <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                disabled={!form.label || !form.poids || !form.prix || saving}
                onClick={addFormat}>
                {saving ? <Spinner size={14} /> : <Plus size={14} />} Ajouter
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

const CATEGORIES_MP = ['Cafe','Lait','Sucre','Pate a tartiner','Biscuit','Sirop','Topping','Eau','Jus','Soda','Fruit frais','Glace','Emballage','Nettoyage','Autre']

function MatiereModal({ item, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id:        item?.id,
    matiere:   item?.matiere   || '',
    code:      item?.code      || '',
    categorie: item?.categorie || 'Autre',
    unite:     item?.unite     || 'g',
    quantite:  item?.quantite  || 1000,
    prix:      item?.prix      || '',
  })
  const [historique, setHistorique] = useState([])
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!item?.matiere) return
    supabase.from('matiere_prix_historique')
      .select('prix, quantite, date_effet, note')
      .eq('matiere', item.matiere)
      .order('date_effet', { ascending: false })
      .limit(5)
      .then(({ data }) => setHistorique(data || []))
  }, [item?.matiere])
  return (
    <Modal open onClose={onClose} title={item ? 'Modifier' : 'Nouvelle matière'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.matiere || !form.code || saving} onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Nom de la matière</label><input className="form-input" value={form.matiere} onChange={e => set('matiere', e.target.value)} autoFocus /></div>
        <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="ex: CAFE_GRN" /></div>
      </div>
      <div className="form-group"><label className="form-label">Catégorie</label>
        <select className="form-select" value={form.categorie} onChange={e => set('categorie', e.target.value)}>
          {CATEGORIES_MP.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Unité</label>
          <select className="form-select" value={form.unite} onChange={e => set('unite', e.target.value)}>
            {['g','kg','ml','L','unite','Feuilles','bouteille'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Quantité réf.</label><input className="form-input" type="number" value={form.quantite} onChange={e => set('quantite', parseFloat(e.target.value))} /></div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.01" value={form.prix} onChange={e => set('prix', parseFloat(e.target.value))} /></div>
      </div>
      <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>
        Prix unitaire : <strong style={{ color: 'var(--ink)' }}>{form.prix && form.quantite ? (form.prix/form.quantite).toFixed(4) : '—'} DT/{form.unite}</strong>
      </div>

      {historique.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>Historique des prix</div>
          <div className="card" style={{ padding: 0 }}>
            {historique.map((h, i) => (
              <div key={i} style={{ padding: '6px 12px', borderBottom: i < historique.length-1 ? '1px solid var(--outside-cream)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{parseFloat(h.prix).toFixed(2)} DT</span>
                  <span style={{ color: 'var(--muted)', fontSize: '0.72rem', marginLeft: 6 }}>/ {h.quantite} {form.unite}</span>
                  <span style={{ color: 'var(--outside-green)', fontSize: '0.72rem', marginLeft: 6 }}>→ {h.quantite > 0 ? (h.prix/h.quantite).toFixed(4) : '—'} DT/{form.unite}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{h.date_effet}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── ONGLET COMPOSITION ────────────────────────────────────────────────────
function CompositionTab() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [modal, setModal]   = useState(false)
  const [editLine, setEditLine] = useState(null)
  const [saving, setSaving] = useState(false)
  const [matieres, setMatieres] = useState([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: comp }, { data: mp }] = await Promise.all([
      supabase.from('composition_produit').select('*').order('nom_produit').order('id'),
      supabase.from('matiere_premiere').select('matiere, unite').order('matiere'),
    ])
    setItems(comp || [])
    setMatieres(mp || [])
    setLoading(false)
  }

  async function saveLine(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('composition_produit').update(form).eq('id', form.id)
      setItems(prev => prev.map(i => i.id === form.id ? { ...i, ...form } : i))
    } else {
      const { data } = await supabase.from('composition_produit').insert(form).select().single()
      if (data) setItems(prev => [...prev, data])
    }
    setSaving(false); setModal(false); setEditLine(null)
  }

  async function deleteLine(id) {
    await supabase.from('composition_produit').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  // Grouper par produit
  const grouped = {}
  for (const c of items) {
    const k = `${c.type}|||${c.nom_produit}`
    if (!grouped[k]) grouped[k] = []
    grouped[k].push(c)
  }

  const filteredKeys = Object.keys(grouped).filter(k => {
    const [,name] = k.split('|||')
    return !search || name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Rechercher un produit..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isManager && <button className="btn btn-primary btn-sm" onClick={() => { setEditLine(null); setModal(true) }}><Plus size={14} /></button>}
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredKeys.map(k => {
            const [type, name] = k.split('|||')
            const lines = grouped[k]
            const isOpen = expanded === k
            const coutTotal = lines.reduce((s, l) => s + parseFloat(l.prix_achat || 0), 0)
            return (
              <div key={k} className="card">
                <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : k)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{name}</div>
                    <div style={{ fontSize: '0.65rem', marginTop: 2 }}>
                      <span style={{ color: type === 'base' ? '#3D5A8A' : type === 'produit fini' ? 'var(--outside-green)' : 'var(--outside-orange)', fontWeight: 800, background: type === 'base' ? '#EBF2FD' : type === 'produit fini' ? '#E0F2EB' : '#FEF3DC', padding: '1px 7px', borderRadius: 'var(--radius-pill)' }}>{type}</span>
                      <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{lines.length} ingrédient{lines.length > 1 ? 's' : ''} · {coutTotal.toFixed(3)} DT</span>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={15} color="var(--muted)" /> : <ChevronDown size={15} color="var(--muted)" />}
                </div>
                {isOpen && (
                  <div style={{ borderTop: '1.5px solid var(--outside-cream)', padding: '0.5rem 1rem' }}>
                    {lines.map(line => (
                      <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--outside-cream)', fontSize: '0.82rem' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700 }}>{line.matiere}</span>
                          <span style={{ color: 'var(--outside-orange)', marginLeft: 8, fontWeight: 700 }}>{line.quantite_m} {line.unite}</span>
                          <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{parseFloat(line.prix_achat||0).toFixed(3)} DT</span>
                        </div>
                        {isManager && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => { setEditLine(line); setModal(true) }}><Edit2 size={12} /></button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteLine(line.id)}><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {isManager && (
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--outside-green)' }}
                        onClick={() => { setEditLine({ nom_produit: name, type, matiere: '', quantite_m: '', unite: '', prix_achat: '' }); setModal(true) }}>
                        <Plus size={12} /> Ajouter un ingrédient
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal && isManager && (
        <CompoModal line={editLine} matieres={matieres} onClose={() => { setModal(false); setEditLine(null) }} onSave={saveLine} saving={saving} />
      )}
    </>
  )
}

function CompoModal({ line, matieres, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id: line?.id || null,
    nom_produit: line?.nom_produit || '',
    type:        line?.type || 'produit fini',
    matiere:     line?.matiere || '',
    quantite_m:  line?.quantite_m || '',
    unite:       line?.unite || 'g',
    prix_achat:  line?.prix_achat || '',
  })
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))

  // Auto-fill unite when matiere selected
  function selectMatiere(name) {
    const mp = matieres.find(m => m.matiere === name)
    setForm(p => ({ ...p, matiere: name, unite: mp?.unite || p.unite }))
  }

  return (
    <Modal open onClose={onClose} title={line?.id ? 'Modifier la ligne' : 'Ajouter un ingrédient'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.nom_produit || !form.matiere || saving} onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div className="form-group"><label className="form-label">Produit</label><input className="form-input" value={form.nom_produit} onChange={e => set('nom_produit', e.target.value)} placeholder="ex: LATTE" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Type</label>
          <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="produit fini">Produit fini</option>
            <option value="base">Base</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Matière</label>
          <select className="form-select" value={form.matiere} onChange={e => selectMatiere(e.target.value)}>
            <option value="">— Choisir —</option>
            {matieres.map(m => <option key={m.matiere} value={m.matiere}>{m.matiere}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Quantité</label><input className="form-input" type="number" step="0.1" value={form.quantite_m} onChange={e => set('quantite_m', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Unité</label><input className="form-input" value={form.unite} onChange={e => set('unite', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.0001" value={form.prix} onChange={e => set('prix', e.target.value)} /></div>
      </div>
    </Modal>
  )
}

// ── ONGLET PRODUITS ───────────────────────────────────────────────────────
function ProduitsTab() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [produits, setProduits] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [activeF, setActiveF]   = useState('all')
  const [modal, setModal]       = useState(false)
  const [edit, setEdit]         = useState(null)
  const [saving, setSaving]       = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => { fetchProduits() }, [])

  async function fetchProduits() {
    const { data } = await supabase.from('produits').select('*').order('famille').order('nom_produit')
    setProduits(data || [])
    setLoading(false)
  }

  async function saveProduit(form) {
    setSaving(true)
    if (form.id_produit) {
      await supabase.from('produits').update(form).eq('id_produit', form.id_produit)
      setProduits(prev => prev.map(p => p.id_produit === form.id_produit ? { ...p, ...form } : p))
    } else {
      // Générer id_produit depuis le nom (ex: "LATTE CARAMEL" → "LATTE_CARAMEL_001")
      const base = form.nom_produit.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
      const id_produit = base + '_' + Date.now().toString(36).toUpperCase()
      const { data, error } = await supabase.from('produits').insert({ ...form, id_produit }).select().single()
      if (error) { alert('Erreur: ' + error.message); setSaving(false); return }
      if (data) setProduits(prev => [...prev, data])
    }
    setSaving(false); setModal(false); setEdit(null)
  }

  async function deleteProduit(id) {
    if (!window.confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').delete().eq('id_produit', id)
    setProduits(prev => prev.filter(p => p.id_produit !== id))
  }

  async function toggleProduitActive(p) {
    const newVal = p.actif === false ? true : false
    await supabase.from('produits').update({ actif: newVal }).eq('id_produit', p.id_produit)
    setProduits(prev => prev.map(x => x.id_produit === p.id_produit ? { ...x, actif: newVal } : x))
  }

  const familles = ['all', ...Array.from(new Set(produits.map(p => p.famille))).filter(Boolean).sort()]
  const filtered = produits
    .filter(p => showInactive ? p.actif === false : p.actif !== false)
    .filter(p => activeF === 'all' || p.famille === activeF)
    .filter(p => !search || p.nom_produit.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isManager && <button className="btn btn-primary btn-sm" onClick={() => { setEdit(null); setModal(true) }}><Plus size={14} /></button>}
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: 4, marginBottom: '1rem', scrollbarWidth: 'none', marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
        {familles.map(f => (
          <button key={f} className={`btn btn-sm ${activeF === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveF(f)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            {f === 'all' ? 'Tout' : f} <span style={{ opacity: 0.65 }}>({f === 'all' ? produits.length : produits.filter(p => p.famille === f).length})</span>
          </button>
        ))}
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div> : (
        <div className="card">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) minmax(80px,120px) 70px', gap: 6, padding: '0.5rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', background: 'var(--outside-cream)' }}>
            {['Produit','Famille','Prix'].map(h => <div key={h} style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</div>)}
          </div>
          {filtered.map((p, idx) => (
            <div key={p.id_produit} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,1fr) minmax(80px,120px) 70px', gap: 6, padding: '0.7rem 1rem', borderBottom: idx < filtered.length-1 ? '1.5px solid var(--outside-cream)' : 'none', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: p.actif === false ? 0.4 : 1, textDecoration: p.actif === false ? 'line-through' : 'none' }}>{p.nom_produit}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.famille}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{p.prix} DT</span>
              <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                {isManager && <>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => { setEdit(p); setModal(true) }}><Edit2 size={12} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: p.actif === false ? 'var(--outside-green)' : 'var(--danger)' }}
                    title={p.actif === false ? 'Réactiver' : 'Désactiver'}
                    onClick={() => toggleProduitActive(p)}>
                    {p.actif === false ? '✓' : '✕'}
                  </button>
                </>}
              </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && isManager && (
        <ProduitModal produit={edit} familles={familles.filter(f => f !== 'all')} onClose={() => { setModal(false); setEdit(null) }} onSave={saveProduit} saving={saving} />
      )}
    </>
  )
}

function ProduitModal({ produit, familles, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    id_produit:  produit?.id_produit  || null,
    nom_produit: produit?.nom_produit || '',
    famille:     produit?.famille     || (familles[0] || ''),
    prix:        produit?.prix        || '',
  })
  const [newFam, setNewFam] = useState(false)
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <Modal open onClose={onClose} title={produit ? 'Modifier le produit' : 'Nouveau produit'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.nom_produit || saving} onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div className="form-group"><label className="form-label">Nom du produit</label><input className="form-input" value={form.nom_produit} onChange={e => set('nom_produit', e.target.value)} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group">
          <label className="form-label">Famille <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', fontSize: '0.7rem' }} onClick={() => setNewFam(n => !n)}>{newFam ? '←' : '+ Nouvelle'}</button></label>
          {newFam ? <input className="form-input" placeholder="ex: CLOUD" value={form.famille} onChange={e => set('famille', e.target.value)} /> :
            <select className="form-select" value={form.famille} onChange={e => set('famille', e.target.value)}>
              {familles.map(f => <option key={f}>{f}</option>)}
            </select>}
        </div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.5" value={form.prix} onChange={e => set('prix', parseFloat(e.target.value))} /></div>
      </div>
    </Modal>
  )
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────
export default function Catalogue() {
  const [tab, setTab] = useState('matieres')

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Catalogue</h1>
        <p className="page-subtitle">Matières · Compositions · Produits</p>
      </div>

      <div className="page-content">
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn${tab === 'matieres'     ? ' active' : ''}`} onClick={() => setTab('matieres')}>Matières</button>
          <button className={`tab-btn${tab === 'composition'  ? ' active' : ''}`} onClick={() => setTab('composition')}>Compositions</button>
          <button className={`tab-btn${tab === 'produits'     ? ' active' : ''}`} onClick={() => setTab('produits')}>Produits</button>
        </div>

        {tab === 'matieres'    && <MatieresTab />}
        {tab === 'composition' && <CompositionTab />}
        {tab === 'produits'    && <ProduitsTab />}
      </div>
    </>
  )
}
