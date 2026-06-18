import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { Plus, Save, Trash2, Edit2, TrendingUp, TrendingDown } from 'lucide-react'
import { format, subMonths, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

const CATEGORIES_CHARGES = ['Loyer','Electricite','Eau','Fournisseur','Marketing','Maintenance','Autre']
const ROLE_COLORS = { manager: '#C4521A', barista: '#1A5C4A', service_crew: '#3D5A8A', support_crew: '#8B6B8A' }

const fmtDT  = n => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0) + ' DT'
const fmtPct = n => (n || 0).toFixed(1) + '%'

// ── COMPOSANT OVERRIDE FOOD COST ─────────────────────────────────────────
function FoodCostOverride({ period, theorique, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState('')
  const [saving, setSaving]   = useState(false)

  async function save() {
    setSaving(true)
    const montant = parseFloat(val)
    if (isNaN(montant)) { setEditing(false); setSaving(false); return }
    await supabase.from('finance_food_cost').upsert({
      periode: period, cout_reel: montant, updated_at: new Date().toISOString()
    }, { onConflict: 'periode' })
    setSaving(false); setEditing(false); onUpdate()
  }

  async function reset() {
    await supabase.from('finance_food_cost').upsert({
      periode: period, cout_reel: null, updated_at: new Date().toISOString()
    }, { onConflict: 'periode' })
    setEditing(false); onUpdate()
  }

  if (editing) return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input type="number" step="0.01" autoFocus
        value={val} onChange={e => setVal(e.target.value)}
        placeholder={theorique}
        style={{ width: 90, textAlign: 'center', fontWeight: 800, border: '2px solid var(--outside-orange)', borderRadius: 'var(--radius-sm)', padding: '4px 6px', fontFamily: 'var(--font-body)', outline: 'none', fontSize: '0.9rem' }} />
      <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? <Spinner size={13} /> : '✓'}</button>
      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => { setVal(String(theorique)); setEditing(true) }}>
        <Edit2 size={12} /> Modifier
      </button>
    </div>
  )
}

export default function Finance() {
  const { profile } = useAuth()
  const isAdmin     = hasRole(profile, 'admin')
  const isManager   = hasRole(profile, 'manager')
  const [tab, setTab]     = useState('resultat')
  const [period, setPeriod] = useState(format(new Date(), 'yyyy-MM'))

  if (!isManager) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Accès manager uniquement</div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">Finance</h1>
            <p className="page-subtitle" style={{ textTransform: 'none' }}>{format(new Date(period + '-01'), 'MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* PÉRIODE */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => setPeriod(p => format(subMonths(new Date(p + '-01'), 1), 'yyyy-MM'))}>←</button>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="form-input" style={{ flex: 1, textAlign: 'center', fontWeight: 700 }} />
          <button className="btn btn-ghost btn-sm"
            onClick={() => setPeriod(p => format(new Date(new Date(p + '-01').setMonth(new Date(p + '-01').getMonth() + 1)), 'yyyy-MM'))}>→</button>
        </div>

        {/* TABS */}
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn${tab === 'resultat' ? ' active' : ''}`} onClick={() => setTab('resultat')}>Résultat</button>
          <button className={`tab-btn${tab === 'charges'  ? ' active' : ''}`} onClick={() => setTab('charges')}>Charges</button>
          <button className={`tab-btn${tab === 'salaires' ? ' active' : ''}`} onClick={() => setTab('salaires')}>Salaires</button>
          <button className={`tab-btn${tab === 'stock'    ? ' active' : ''}`} onClick={() => setTab('stock')}>Stock</button>
        </div>

        {tab === 'resultat' && <TabResultat period={period} isAdmin={isAdmin} />}
        {tab === 'charges'  && <TabCharges  period={period} isManager={isManager} />}
        {tab === 'salaires' && <TabSalaires period={period} isAdmin={isAdmin} />}
        {tab === 'stock'    && <TabCoutStock period={period} />}
      </div>
    </>
  )
}

// ── ONGLET RÉSULTAT ───────────────────────────────────────────────────────
function TabResultat({ period, isAdmin }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [period])

  async function fetchData() {
    setLoading(true)
    const dateFrom = `${period}-01`
    const dateTo   = format(endOfMonth(new Date(dateFrom)), 'yyyy-MM-dd')

    // CA — même logique exacte que Performance
    const DATE_CHG_DATE = new Date('2026-03-19T00:00:00')
    let ca = 0, pageCA = 0
    while (true) {
      const { data: batch } = await supabase
        .from('transaction_line')
        .select('prix_unitaire, total_ttc, numtable, date_vente')
        .gte('date_vente', dateFrom)
        .lte('date_vente', dateTo)
        .range(pageCA * 1000, (pageCA + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      for (const l of batch) {
        const dateVente    = new Date(l.date_vente + 'T00:00:00')
        const isConsoPerso = l.numtable === 32 || (l.numtable === 22 && dateVente < DATE_CHG_DATE)
        if (isConsoPerso) continue
        ca += parseFloat(l.prix_unitaire || l.total_ttc || 0)
      }
      if (batch.length < 1000) break
      pageCA++
    }
    ca = parseFloat(ca.toFixed(2))

    // Charges
    const { data: charges } = await supabase
      .from('finance_charges')
      .select('montant, categorie')
      .eq('periode', period)
    const totalCharges = (charges || []).reduce((s, c) => s + parseFloat(c.montant || 0), 0)
    const chargesParCat = {}
    for (const c of (charges || [])) {
      chargesParCat[c.categorie] = (chargesParCat[c.categorie] || 0) + parseFloat(c.montant || 0)
    }

    // Salaires + primes
    const [{ data: salaires }, { data: primes }] = await Promise.all([
      supabase.from('finance_salaires').select('salaire_base').eq('actif', true),
      supabase.from('finance_primes').select('montant').eq('periode', period),
    ])
    const totalSalaires = (salaires || []).reduce((s, x) => s + parseFloat(x.salaire_base || 0), 0)
    const totalPrimes   = (primes || []).reduce((s, x) => s + parseFloat(x.montant || 0), 0)
    const masseSalariale = totalSalaires + totalPrimes

    // Food cost — calcul théorique automatique depuis les ventes + compositions
    const { data: fc } = await supabase.from('finance_food_cost').select('*').eq('periode', period).maybeSingle()

    let foodCostTheo = 0
    try {
      // Récupérer les compositions et matières premières
      const [{ data: compo }, { data: mp }] = await Promise.all([
        supabase.from('composition_produit').select('nom_produit, matiere, quantite_m, prix_achat, type'),
        supabase.from('matiere_premiere').select('matiere, prix, quantite').or('actif.eq.true,actif.is.null'),
      ])

      // Ventes de la période
      let ventesFC = [], pageFC = 0
      while (true) {
        const { data: batch } = await supabase
          .from('transaction_line').select('produit, qte')
          .gte('date_vente', dateFrom).lte('date_vente', dateTo)
          .range(pageFC * 1000, (pageFC + 1) * 1000 - 1)
        if (!batch || batch.length === 0) break
        ventesFC = ventesFC.concat(batch)
        if (batch.length < 1000) break
        pageFC++
      }

      // Construire mpMap et baseMap
      const mpMap = {}
      for (const m of (mp || [])) {
        mpMap[m.matiere] = { prixParUnite: m.quantite > 0 ? m.prix / m.quantite : 0 }
      }
      const norm = s => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() || ''
      const baseMap = {}
      const produitMap = {}
      for (const c of (compo || [])) {
        const key = norm(c.nom_produit)
        if (c.type === 'base') {
          if (!baseMap[key]) baseMap[key] = []
          baseMap[key].push(c)
        } else {
          if (!produitMap[key]) produitMap[key] = []
          produitMap[key].push(c)
        }
      }

      // Calculer le coût théorique
      // prix_achat dans composition_produit = coût déjà calculé pour quantite_m
      // Donc : coût total = qte_vendue × prix_achat
      for (const v of ventesFC) {
        const prodKey = norm(v.produit)
        const ingredients = produitMap[prodKey] || []
        for (const c of ingredients) {
          const matiereNorm = norm(c.matiere)
          const baseKey = Object.keys(baseMap).find(k => k === matiereNorm)
          if (baseKey) {
            // Ingrédient = base → développer avec ratio
            const baseIngredients = baseMap[baseKey]
            const baseTotal = baseIngredients.reduce((s, bi) => s + parseFloat(bi.quantite_m || 0), 0)
            const ratio = baseTotal > 0 ? parseFloat(c.quantite_m) / baseTotal : 0
            for (const bi of baseIngredients) {
              // bi.prix_achat = coût pour bi.quantite_m → coût unitaire = prix_achat
              const prixUnit = parseFloat(bi.prix_achat || 0) || (mpMap[bi.matiere]?.prixParUnite * parseFloat(bi.quantite_m || 0))
              foodCostTheo += v.qte * ratio * (prixUnit / parseFloat(bi.quantite_m || 1)) * parseFloat(bi.quantite_m || 0)
            }
          } else {
            // Ingrédient direct : prix_achat = coût pour quantite_m de ce produit
            foodCostTheo += v.qte * parseFloat(c.prix_achat || 0)
          }
        }
      }
      foodCostTheo = parseFloat(foodCostTheo.toFixed(2))

      // Sauvegarder le food cost théorique dans finance_food_cost
      await supabase.from('finance_food_cost').upsert({
        periode: period,
        cout_theo: foodCostTheo,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'periode', ignoreDuplicates: false })
    } catch (e) {
      console.error('Food cost calc error:', e)
    }

    const foodCost = fc?.cout_reel ?? foodCostTheo

    const totalDepenses  = totalCharges + masseSalariale + foodCost
    const resultatBrut   = ca - foodCost
    const resultatNet    = ca - totalDepenses
    const margeBrute     = ca > 0 ? (resultatBrut / ca * 100) : 0
    const margeNette     = ca > 0 ? (resultatNet / ca * 100) : 0
    const tauxCharges    = ca > 0 ? (totalCharges / ca * 100) : 0
    const tauxSalaires   = ca > 0 ? (masseSalariale / ca * 100) : 0
    const tauxFoodCost   = ca > 0 ? (foodCost / ca * 100) : 0

    setData({ ca, totalCharges, masseSalariale, totalPrimes, foodCost, totalDepenses, resultatNet, resultatBrut, margeBrute, margeNette, tauxCharges, tauxSalaires, tauxFoodCost, chargesParCat, period })
    setLoading(false)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Spinner size={28} /></div>
  if (!data) return null

  const positif = data.resultatNet >= 0

  return (
    <>
      {/* KPIs PRINCIPAUX */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
        {[
          { label: 'CA Total',       value: fmtDT(data.ca),             color: 'var(--outside-dark)' },
          { label: 'Total dépenses', value: fmtDT(data.totalDepenses),  color: 'var(--danger)' },
          { label: 'Résultat net',   value: fmtDT(data.resultatNet),    color: positif ? 'var(--outside-green)' : 'var(--danger)', big: true },
          { label: 'Marge nette',    value: fmtPct(data.margeNette),    color: positif ? 'var(--outside-green)' : 'var(--danger)', big: true },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '0.85rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>{k.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: k.big ? '1.2rem' : '0.95rem', color: k.color, fontWeight: k.big ? 400 : 700 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* DÉCOMPOSITION */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--muted)' }}>
          Décomposition du résultat
        </div>
        {[
          { label: 'Chiffre d\'affaires', val: data.ca,             pct: 100,                  color: '#1A5C4A', plus: true },
          { label: 'Food cost',           val: data.foodCost,       pct: data.tauxFoodCost,    color: '#B03A1A' },
          { label: 'Charges fixes',       val: data.totalCharges,   pct: data.tauxCharges,     color: '#C4521A' },
          { label: 'Masse salariale',     val: data.masseSalariale, pct: data.tauxSalaires,    color: '#8B6B8A' },
        ].map((row, i, arr) => (
          <div key={row.label} style={{ padding: '0.75rem 1rem', borderBottom: i < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{row.label}</div>
              <div style={{ height: 4, background: 'var(--outside-cream2)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(row.pct, 100)}%`, background: row.color, borderRadius: 2 }} />
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontWeight: 800, color: row.color }}>{row.plus ? '+' : '-'}{fmtDT(row.val)}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{fmtPct(row.pct)}</div>
            </div>
          </div>
        ))}
        {/* RÉSULTAT */}
        <div style={{ padding: '0.85rem 1rem', background: positif ? '#E0F2EB' : '#FDEEEC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, color: positif ? '#1A5C4A' : '#B03A1A' }}>
            {positif ? '✓ Bénéfice' : '✗ Déficit'}
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: positif ? '#1A5C4A' : '#B03A1A' }}>
            {positif ? '+' : ''}{fmtDT(data.resultatNet)}
          </div>
        </div>
      </div>

      {/* FOOD COST */}
      <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '2px' }}>Food Cost</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--danger)' }}>{fmtDT(data.foodCost)}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
              {fmtPct(data.tauxFoodCost)} du CA · <span style={{ color: 'var(--outside-green)', fontWeight: 700 }}>Calculé automatiquement</span>
            </div>
          </div>
          <FoodCostOverride period={data.period} theorique={data.foodCost} onUpdate={fetchData} />
        </div>
      </div>

      {/* SEUIL DE RENTABILITÉ */}
      <div className="card" style={{ padding: '0.85rem 1rem' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Seuil de rentabilité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Charges fixes totales</div>
            <div style={{ fontWeight: 800 }}>{fmtDT(data.totalCharges + data.masseSalariale)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Marge sur coût variable</div>
            <div style={{ fontWeight: 800 }}>{fmtPct(100 - data.tauxFoodCost)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--outside-orange)', fontWeight: 700 }}>CA seuil rentabilité</div>
            <div style={{ fontWeight: 800, color: 'var(--outside-orange)' }}>
              {(100 - data.tauxFoodCost) > 0
                ? fmtDT((data.totalCharges + data.masseSalariale) / ((100 - data.tauxFoodCost) / 100))
                : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>CA actuel vs seuil</div>
            <div style={{ fontWeight: 800, color: positif ? 'var(--outside-green)' : 'var(--danger)' }}>
              {positif ? '▲ Au-dessus' : '▼ En dessous'}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ── ONGLET CHARGES ────────────────────────────────────────────────────────
function TabCharges({ period, isManager }) {
  const { profile } = useAuth()
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [edit, setEdit]       = useState(null)
  const [saving, setSaving]   = useState(false)

  useEffect(() => { fetchCharges() }, [period])

  async function fetchCharges() {
    setLoading(true)
    const { data } = await supabase.from('finance_charges')
      .select('*').eq('periode', period).order('categorie').order('label')
    setCharges(data || [])
    setLoading(false)
  }

  async function saveCharge(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('finance_charges').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id)
      setCharges(prev => prev.map(c => c.id === form.id ? { ...c, ...form } : c))
    } else {
      const { data } = await supabase.from('finance_charges').insert({ ...form, periode: period, created_by: profile?.id }).select().single()
      if (data) setCharges(prev => [...prev, data])
    }
    setSaving(false); setModal(false); setEdit(null)
  }

  async function deleteCharge(id) {
    await supabase.from('finance_charges').delete().eq('id', id)
    setCharges(prev => prev.filter(c => c.id !== id))
  }

  // Copier charges du mois précédent
  async function copierMoisPrecedent() {
    const prevPeriod = format(subMonths(new Date(period + '-01'), 1), 'yyyy-MM')
    const { data: prev } = await supabase.from('finance_charges').select('*').eq('periode', prevPeriod)
    if (!prev?.length) { alert('Aucune charge le mois précédent'); return }
    const toInsert = prev.map(({ id, periode, created_at, updated_at, ...rest }) => ({ ...rest, periode: period }))
    const { data } = await supabase.from('finance_charges').insert(toInsert).select()
    if (data) setCharges(prev2 => [...prev2, ...data])
  }

  const total = charges.reduce((s, c) => s + parseFloat(c.montant || 0), 0)
  const byCat = {}
  for (const c of charges) byCat[c.categorie] = (byCat[c.categorie] || 0) + parseFloat(c.montant || 0)

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setEdit(null); setModal(true) }}><Plus size={14} /> Ajouter</button>
        <button className="btn btn-outline btn-sm" onClick={copierMoisPrecedent}>↩ Copier M-1</button>
        <div style={{ marginLeft: 'auto', fontWeight: 800, color: 'var(--outside-dark)', alignSelf: 'center' }}>
          Total : {fmtDT(total)}
        </div>
      </div>

      {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div> : (
        <>
          {/* Résumé par catégorie */}
          {Object.keys(byCat).length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {Object.entries(byCat).map(([cat, val]) => (
                <div key={cat} style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '4px 10px', fontSize: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--outside-orange)' }}>{cat}</span>
                  <span style={{ fontWeight: 800, marginLeft: 6 }}>{fmtDT(val)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            {charges.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Aucune charge ce mois</div>
            ) : charges.map((c, idx) => (
              <div key={c.id} style={{ padding: '0.75rem 1rem', borderBottom: idx < charges.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{c.label}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--outside-orange)', fontWeight: 700 }}>{c.categorie}</div>
                  {c.note && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{c.note}</div>}
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--danger)' }}>{fmtDT(c.montant)}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => { setEdit(c); setModal(true) }}><Edit2 size={13} /></button>
                  <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deleteCharge(c.id)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal open onClose={() => { setModal(false); setEdit(null) }} title={edit ? 'Modifier la charge' : 'Nouvelle charge'}
          footer={<>
            <button className="btn btn-outline" onClick={() => { setModal(false); setEdit(null) }}>Annuler</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => saveCharge(edit || { label: '', categorie: 'Loyer', montant: 0 })}>
              {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
            </button>
          </>}>
          <ChargeForm form={edit || { label: '', categorie: 'Loyer', montant: 0 }} onChange={setEdit} />
        </Modal>
      )}
    </>
  )
}

function ChargeForm({ form, onChange }) {
  const set = (k, v) => onChange(p => ({ ...p, [k]: v }))
  return (
    <>
      <div className="form-group"><label className="form-label">Libellé</label><input className="form-input" value={form.label || ''} onChange={e => set('label', e.target.value)} autoFocus /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div className="form-group"><label className="form-label">Catégorie</label>
          <select className="form-select" value={form.categorie || 'Autre'} onChange={e => set('categorie', e.target.value)}>
            {CATEGORIES_CHARGES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Montant (DT)</label>
          <input className="form-input" type="number" step="0.01" value={form.montant || ''} onChange={e => set('montant', parseFloat(e.target.value) || 0)} />
        </div>
      </div>
      <div className="form-group"><label className="form-label">Note <span style={{ opacity: 0.6, fontWeight: 600 }}>optionnel</span></label>
        <input className="form-input" value={form.note || ''} onChange={e => set('note', e.target.value)} />
      </div>
    </>
  )
}

// ── ONGLET SALAIRES ───────────────────────────────────────────────────────
function TabSalaires({ period, isAdmin }) {
  const { profile } = useAuth()
  const [salaires, setSalaires] = useState([])
  const [primes, setPrimes]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [editSal, setEditSal]   = useState(null)
  const [editPrime, setEditPrime] = useState(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => { fetchData() }, [period])

  async function fetchData() {
    setLoading(true)
    const [{ data: sal }, { data: pri }] = await Promise.all([
      supabase.from('finance_salaires').select('*').eq('actif', true).order('staff_role'),
      supabase.from('finance_primes').select('*').eq('periode', period),
    ])
    setSalaires(sal || [])
    setPrimes(pri || [])
    setLoading(false)
  }

  async function saveSalaire(form) {
    setSaving(true)
    await supabase.from('finance_salaires').update({ salaire_base: form.salaire_base, updated_at: new Date().toISOString() }).eq('id', form.id)
    setSalaires(prev => prev.map(s => s.id === form.id ? { ...s, ...form } : s))
    setSaving(false); setEditSal(null)
  }

  async function savePrime(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('finance_primes').update({ montant: form.montant, motif: form.motif }).eq('id', form.id)
      setPrimes(prev => prev.map(p => p.id === form.id ? { ...p, ...form } : p))
    } else {
      const { data } = await supabase.from('finance_primes').insert({ ...form, periode: period, created_by: profile?.id }).select().single()
      if (data) setPrimes(prev => [...prev, data])
    }
    setSaving(false); setEditPrime(null)
  }

  async function deletePrime(id) {
    await supabase.from('finance_primes').delete().eq('id', id)
    setPrimes(prev => prev.filter(p => p.id !== id))
  }

  const totalSalaires = salaires.reduce((s, x) => s + parseFloat(x.salaire_base || 0), 0)
  const totalPrimes   = primes.reduce((s, x) => s + parseFloat(x.montant || 0), 0)
  const total         = totalSalaires + totalPrimes

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner size={24} /></div>

  return (
    <>
      {/* TOTAL */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '1rem' }}>
        {[
          { label: 'Salaires fixes', val: totalSalaires },
          { label: 'Primes',         val: totalPrimes },
          { label: 'Total masse',    val: total },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '0.75rem' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>{k.label}</div>
            <div style={{ fontWeight: 800, color: 'var(--outside-dark)', fontSize: '0.9rem' }}>{fmtDT(k.val)}</div>
          </div>
        ))}
      </div>

      {/* SALAIRES */}
      <div className="section-label">Salaires de base</div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        {salaires.map((s, idx) => (
          <div key={s.id} style={{ padding: '0.75rem 1rem', borderBottom: idx < salaires.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: ROLE_COLORS[s.staff_role] || 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {s.staff_name.charAt(0)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.staff_name}</div>
              <div style={{ fontSize: '0.68rem', color: ROLE_COLORS[s.staff_role], fontWeight: 700 }}>{s.staff_role}</div>
            </div>
            {editSal?.id === s.id ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="number" step="10" value={editSal.salaire_base}
                  onChange={e => setEditSal(p => ({ ...p, salaire_base: parseFloat(e.target.value) || 0 }))}
                  style={{ width: 90, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-orange)', borderRadius: 'var(--radius-sm)', padding: '4px', fontFamily: 'var(--font-body)', outline: 'none' }} />
                <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => saveSalaire(editSal)}>
                  {saving ? <Spinner size={14} /> : '✓'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditSal(null)}>✕</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{fmtDT(s.salaire_base)}</div>
                {isAdmin && <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => setEditSal({ ...s })}><Edit2 size={13} /></button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* PRIMES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div className="section-label" style={{ margin: 0 }}>Primes du mois</div>
        <button className="btn btn-primary btn-sm" onClick={() => setEditPrime({ staff_name: salaires[0]?.staff_name || '', montant: 0, motif: '' })}>
          <Plus size={14} />
        </button>
      </div>
      <div className="card">
        {primes.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>Aucune prime ce mois</div>
        ) : primes.map((p, idx) => (
          <div key={p.id} style={{ padding: '0.65rem 1rem', borderBottom: idx < primes.length-1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.staff_name}</div>
              {p.motif && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{p.motif}</div>}
            </div>
            <div style={{ fontWeight: 800, color: 'var(--outside-green)' }}>{fmtDT(p.montant)}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--muted)' }} onClick={() => setEditPrime({ ...p })}><Edit2 size={13} /></button>
              <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => deletePrime(p.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL PRIME */}
      {editPrime && (
        <Modal open onClose={() => setEditPrime(null)} title={editPrime.id ? 'Modifier la prime' : 'Ajouter une prime'}
          footer={<>
            <button className="btn btn-outline" onClick={() => setEditPrime(null)}>Annuler</button>
            <button className="btn btn-primary" disabled={saving} onClick={() => savePrime(editPrime)}>
              {saving ? <Spinner size={16} /> : <Save size={15} />} Enregistrer
            </button>
          </>}>
          <div className="form-group">
            <label className="form-label">Employé</label>
            <select className="form-select" value={editPrime.staff_name} onChange={e => setEditPrime(p => ({ ...p, staff_name: e.target.value }))}>
              {salaires.map(s => <option key={s.id} value={s.staff_name}>{s.staff_name} — {s.staff_role}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group"><label className="form-label">Montant (DT)</label>
              <input className="form-input" type="number" step="5" value={editPrime.montant || ''} onChange={e => setEditPrime(p => ({ ...p, montant: parseFloat(e.target.value) || 0 }))} autoFocus />
            </div>
            <div className="form-group"><label className="form-label">Motif</label>
              <input className="form-input" value={editPrime.motif || ''} onChange={e => setEditPrime(p => ({ ...p, motif: e.target.value }))} placeholder="ex: Performance" />
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ── TAB COÛT STOCK ────────────────────────────────────────────────────
function TabCoutStock({ period }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    const dateFrom = period + '-01'
    const dateTo   = format(endOfMonth(new Date(period + '-01')), 'yyyy-MM-dd')

    const [
      { data: receptions },
      { data: invDebut },
      { data: invFin },
      { data: mp },
      { data: si },
    ] = await Promise.all([
      supabase.from('stock_movements').select('item_id,qty,prix,stock_items(name,matiere_ref)')
        .eq('type','reception').gte('created_at', dateFrom).lte('created_at', dateTo+'T23:59:59'),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire')
        .lt('date_inventaire', dateFrom).order('date_inventaire',{ascending:false}).limit(2000),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire')
        .gte('date_inventaire', dateFrom).lte('date_inventaire', dateTo).order('date_inventaire',{ascending:false}).limit(2000),
      supabase.from('matiere_premiere').select('matiere,prix,quantite').eq('actif',true),
      supabase.from('stock_items').select('id,name,matiere_ref').eq('active',true),
    ])

    // Prix unitaire par matière
    const mpMap = {}
    for (const m of (mp||[])) mpMap[m.matiere?.toLowerCase().trim()] = m.quantite>0 ? m.prix/m.quantite : 0

    // Dernier inventaire début de période par article
    const invDebutMap = {}
    for (const inv of (invDebut||[])) if (!invDebutMap[inv.item_name]) invDebutMap[inv.item_name] = parseFloat(inv.qte_physique||0)

    // Dernier inventaire fin de période par article (le plus récent dans la période)
    const invFinMap = {}
    for (const inv of (invFin||[])) {
      if (!invFinMap[inv.item_name] || inv.date_inventaire > invFinMap[inv.item_name+'_date']) {
        invFinMap[inv.item_name] = parseFloat(inv.qte_physique||0)
        invFinMap[inv.item_name+'_date'] = inv.date_inventaire
      }
    }

    // Réceptions par matière
    const recuMap = {}, recuDT = {}
    for (const r of (receptions||[])) {
      const matRef = r.stock_items?.matiere_ref || r.stock_items?.name || ''
      const k = matRef.toLowerCase().trim()
      recuMap[k] = (recuMap[k]||0) + parseFloat(r.qty||0)
      recuDT[k]  = (recuDT[k]||0)  + parseFloat(r.prix||0)
    }

    // Construire lignes par matière
    const lignes = []
    const matieresSeen = new Set([...Object.keys(recuMap), ...(si||[]).map(s=>s.matiere_ref?.toLowerCase().trim()).filter(Boolean)])

    for (const k of matieresSeen) {
      const siItem = (si||[]).find(s=>s.matiere_ref?.toLowerCase().trim()===k)
      const nom = siItem?.matiere_ref || k
      const prixUnit = mpMap[k] || 0
      const stockDebut = invDebutMap[siItem?.name||''] ?? null
      const stockFin   = invFinMap[siItem?.name||'']   ?? null
      const recu = recuMap[k] || 0
      const recuDTVal = recuDT[k] || (recu * prixUnit)

      // Coût réel = stock début + réceptions − stock fin
      // Coût réel = réceptions + stock début - stock fin
      // Si pas de stock début → on utilise juste réceptions - variation stock fin
      let coutReel = recuDTVal // fallback
      let hasInv = false
      if (stockFin !== null) {
        hasInv = true
        if (stockDebut !== null) {
          // On a début et fin
          coutReel = Math.max(0, stockDebut + recu - stockFin) * prixUnit
        } else {
          // On a seulement fin → réceptions - stock fin restant
          coutReel = Math.max(0, recu - stockFin) * prixUnit
        }
      }

      if (recu===0 && stockDebut===null && stockFin===null) continue

      lignes.push({ nom, stockDebut, recu, stockFin, recuDTVal, coutReel, prixUnit, hasInv })
    }

    lignes.sort((a,b)=>b.coutReel-a.coutReel)

    const totalReceptions = lignes.reduce((s,l)=>s+l.recuDTVal,0)
    const totalCout       = lignes.reduce((s,l)=>s+l.coutReel,0)

    setData({ lignes, totalReceptions, totalCout })
    setLoading(false)
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={24}/></div>
  if (!data)   return null

  const fDT = n => parseFloat(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' DT'
  const fN  = n => parseFloat(n||0).toFixed(0)

  return (
    <div>
      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:'1rem'}}>
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--outside-green)'}}>{fDT(data.totalReceptions)}</div>
          <div style={{fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>Total réceptions</div>
        </div>
        <div className="card" style={{padding:'0.75rem'}}>
          <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',color:'var(--danger)'}}>{fDT(data.totalCout)}</div>
          <div style={{fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>Coût réel consommé</div>
        </div>
      </div>

      {/* NOTE */}
      <div style={{background:'var(--outside-cream)',borderRadius:'var(--radius-md)',padding:'8px 12px',fontSize:'0.72rem',color:'var(--muted)',marginBottom:'1rem'}}>
        Coût réel = Stock début + Réceptions − Stock fin. Sans inventaire → réceptions uniquement.
      </div>

      {/* TABLEAU PAR MATIÈRE — carte par ligne */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {data.lignes.map((l,i)=>(
          <div key={l.nom} className="card" style={{padding:'0.75rem 1rem'}}>
            {/* NOM + COÛT RÉEL */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontWeight:700,fontSize:'0.88rem'}}>{l.nom}</div>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:800,fontSize:'0.88rem',color:l.hasInv?'var(--danger)':'var(--muted)'}}>{fDT(l.coutReel)}</div>
                <div style={{fontSize:'0.6rem',color:'var(--muted)',fontWeight:600,textTransform:'uppercase'}}>Coût réel</div>
              </div>
            </div>
            {/* DÉTAIL STOCK */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
              <div style={{background:'var(--outside-cream)',borderRadius:'var(--radius-sm)',padding:'5px 8px',textAlign:'center'}}>
                <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--outside-dark)'}}>{l.stockDebut!==null?fN(l.stockDebut):'—'}</div>
                <div style={{fontSize:'0.62rem',color:'var(--outside-green)',fontWeight:600}}>{l.stockDebut!==null&&l.prixUnit>0?fDT(l.stockDebut*l.prixUnit):'—'}</div>
                <div style={{fontSize:'0.6rem',color:'var(--muted)',fontWeight:600}}>Début</div>
              </div>
              <div style={{background:'#EAF3DE',borderRadius:'var(--radius-sm)',padding:'5px 8px',textAlign:'center'}}>
                <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--outside-green)'}}>{l.recu>0?'+'+fN(l.recu):'—'}</div>
                <div style={{fontSize:'0.62rem',color:'var(--outside-green)',fontWeight:600}}>{l.recuDTVal>0?fDT(l.recuDTVal):'—'}</div>
                <div style={{fontSize:'0.6rem',color:'var(--muted)',fontWeight:600}}>Reçu</div>
              </div>
              <div style={{background:'var(--outside-cream)',borderRadius:'var(--radius-sm)',padding:'5px 8px',textAlign:'center'}}>
                <div style={{fontSize:'0.78rem',fontWeight:700,color:'var(--outside-dark)'}}>{l.stockFin!==null?fN(l.stockFin):'—'}</div>
                <div style={{fontSize:'0.62rem',color:'var(--outside-green)',fontWeight:600}}>{l.stockFin!==null&&l.prixUnit>0?fDT(l.stockFin*l.prixUnit):'—'}</div>
                <div style={{fontSize:'0.6rem',color:'var(--muted)',fontWeight:600}}>Fin</div>
              </div>
            </div>
            {!l.hasInv && <div style={{marginTop:6,fontSize:'0.65rem',color:'var(--muted)',fontStyle:'italic'}}>Sans inventaire — réceptions uniquement</div>}
          </div>
        ))}
        {/* TOTAL */}
        <div className="card" style={{padding:'0.75rem 1rem',background:'var(--outside-dark)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontWeight:800,fontSize:'0.82rem',color:'white'}}>Total réceptions</span>
            <span style={{fontWeight:800,fontSize:'0.88rem',color:'var(--outside-green)'}}>{fDT(data.totalReceptions)}</span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontWeight:800,fontSize:'0.82rem',color:'white'}}>Coût réel total</span>
            <span style={{fontWeight:800,fontSize:'0.88rem',color:'#FF9B9B'}}>{fDT(data.totalCout)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
