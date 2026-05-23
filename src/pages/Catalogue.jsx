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
  const [fmtSaving, setFmtSaving] = useState(false)

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const [{ data: mp }, { data: fmt }] = await Promise.all([
      supabase.from('matiere_premiere').select('*').order('matiere'),
      supabase.from('matiere_formats').select('*').eq('actif', true).order('contenance'),
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

  const filtered = items.filter(i => !search || i.matiere.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {isManager && <button className="btn btn-primary btn-sm" onClick={() => { setEdit(null); setModal(true) }}><Plus size={14} /></button>}
      </div>

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
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{item.matiere}</div>
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
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)', padding: 2 }} onClick={e => { e.stopPropagation(); deleteItem(item.id) }}><Trash2 size={11} /></button>
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
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{fmt.format_nom}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem', marginLeft: 8 }}>{fmt.contenance} {fmt.unite}</span>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--outside-dark)' }}>{fmt.prix_achat} DT</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{(fmt.prix_achat / fmt.contenance).toFixed(4)} DT/{fmt.unite}</span>
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
    format_nom: format?.format_nom || '',
    contenance: format?.contenance || '',
    unite:      format?.unite || 'g',
    prix_achat: format?.prix_achat || '',
    actif:      true,
  })
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))
  const prixUnit = form.prix_achat && form.contenance ? (form.prix_achat / form.contenance).toFixed(4) : '—'
  return (
    <Modal open onClose={onClose} title={format ? 'Modifier le format' : 'Nouveau format'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.format_nom || !form.contenance || !form.prix_achat || saving}
          onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div style={{ fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 700, marginBottom: '0.75rem' }}>{matiere}</div>
      <div className="form-group"><label className="form-label">Nom du format</label><input className="form-input" value={form.format_nom} onChange={e => set('format_nom', e.target.value)} placeholder="ex: Nestle 395g" autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Contenance</label><input className="form-input" type="number" step="0.1" value={form.contenance} onChange={e => set('contenance', parseFloat(e.target.value))} placeholder="ex: 395" /></div>
        <div className="form-group"><label className="form-label">Unité</label>
          <select className="form-select" value={form.unite} onChange={e => set('unite', e.target.value)}>
            {['g','kg','ml','L','unite'].map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.01" value={form.prix_achat} onChange={e => set('prix_achat', parseFloat(e.target.value))} placeholder="ex: 3.10" /></div>
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
                  <input className="form-input" type="number" placeholder="ex: 395" value={form.poids} onChange={e => set('quantite', e.target.value)} />
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

function MatiereModal({ item, onClose, onSave, saving }) {
  const [form, setForm] = useState({ id: item?.id, matiere: item?.matiere || '', unite: item?.unite || 'g', quantite: item?.quantite || 1000, prix: item?.prix || '' })
  const set = (k,v) => setForm(p => ({ ...p, [k]: v }))
  return (
    <Modal open onClose={onClose} title={item ? 'Modifier' : 'Nouvelle matière'}
      footer={<>
        <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!form.matiere || saving} onClick={() => onSave(form)}>
          {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
        </button>
      </>}>
      <div className="form-group"><label className="form-label">Nom de la matière</label><input className="form-input" value={form.matiere} onChange={e => set('matiere', e.target.value)} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Quantité</label><input className="form-input" type="number" step="0.1" value={form.quantite_m} onChange={e => set('quantite_m', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Unité</label><input className="form-input" value={form.unite} onChange={e => set('unite', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Prix (DT)</label><input className="form-input" type="number" step="0.0001" value={form.prix_achat} onChange={e => set('prix_achat', e.target.value)} /></div>
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
  const [saving, setSaving]     = useState(false)

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
      const { data } = await supabase.from('produits').insert(form).select().single()
      if (data) setProduits(prev => [...prev, data])
    }
    setSaving(false); setModal(false); setEdit(null)
  }

  async function deleteProduit(id) {
    if (!window.confirm('Supprimer ce produit ?')) return
    await supabase.from('produits').delete().eq('id_produit', id)
    setProduits(prev => prev.filter(p => p.id_produit !== id))
  }

  const familles = ['all', ...Array.from(new Set(produits.map(p => p.famille))).filter(Boolean).sort()]
  const filtered = produits
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px', gap: 8, padding: '0.5rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', background: 'var(--outside-cream)' }}>
            {['Produit','Famille','Prix'].map(h => <div key={h} style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>{h}</div>)}
          </div>
          {filtered.map((p, idx) => (
            <div key={p.id_produit} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 70px', gap: 8, padding: '0.7rem 1rem', borderBottom: idx < filtered.length-1 ? '1.5px solid var(--outside-cream)' : 'none', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nom_produit}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.famille}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{p.prix} DT</span>
                {isManager && (
                  <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => { setEdit(p); setModal(true) }}><Edit2 size={12} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteProduit(p.id_produit)}><Trash2 size={12} /></button>
                  </div>
                )}
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
