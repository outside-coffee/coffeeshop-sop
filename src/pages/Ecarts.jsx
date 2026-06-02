import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download } from 'lucide-react'

// ── HELPERS ───────────────────────────────────────────────────────────────
const f1 = n => n == null ? '—' : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fDT = n => n == null ? '—' : parseFloat(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DT'
const pct = (a, b) => b === 0 ? null : ((a - b) / b * 100).toFixed(1)
const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() || ''

function ecartColor(p) {
  if (p == null) return 'var(--muted)'
  const v = parseFloat(p)
  if (v > 15)  return '#B03A1A'
  if (v > 5)   return '#D4892A'
  if (v < -5)  return '#1A5C4A'
  return 'var(--ink)'
}

const today = new Date()
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

const PERIODES = [
  { label: 'Ce mois',    from: format(startOfMonth(today), 'yyyy-MM-dd'),            to: format(yesterday, 'yyyy-MM-dd') },
  { label: 'M-1',        from: format(startOfMonth(subMonths(today,1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(today,1)), 'yyyy-MM-dd') },
  { label: 'S en cours', from: format(startOfWeek(today, {weekStartsOn:1}), 'yyyy-MM-dd'), to: format(yesterday, 'yyyy-MM-dd') },
  { label: 'S-1',        from: format(startOfWeek(subWeeks(today,1), {weekStartsOn:1}), 'yyyy-MM-dd'), to: format(endOfWeek(subWeeks(today,1), {weekStartsOn:1}), 'yyyy-MM-dd') },
]

export default function Ecarts() {
  const [dateFrom, setDateFrom] = useState(PERIODES[0].from)
  const [dateTo,   setDateTo]   = useState(PERIODES[0].to)
  const [loading, setLoading]   = useState(false)
  const [resultats, setResultats] = useState([])
  const [loaded, setLoaded]     = useState(false)
  const [sortBy, setSortBy]     = useState('ecart_pct') // 'ecart_pct' | 'nom' | 'cout'
  const [filterActif, setFilterActif] = useState(true)

  // Charger automatiquement au montage
  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)

    // 1. Conso théorique depuis vue
    const { data: consoData } = await supabase
      .from('v_conso_theorique').select('matiere, qte_theo, cout_theo')
      .gte('date_vente', dateFrom).lte('date_vente', dateTo)

    // 2. Matières premières (prix unitaire)
    const { data: mp } = await supabase
      .from('matiere_premiere').select('matiere, prix, quantite, unite, actif')

    // 3. Inventaires dans la période — pour calculer conso réelle
    // Conso réelle = inv_debut - inv_fin + réceptions - pertes
    const { data: invData } = await supabase
      .from('stock_inventaires').select('item_name, qte_physique, date_inventaire')
      .gte('date_inventaire', dateFrom).lte('date_inventaire', dateTo)
      .order('date_inventaire', { ascending: true })

    // Inventaire précédant la période (stock début)
    const { data: invAvant } = await supabase
      .from('stock_inventaires').select('item_name, qte_physique, date_inventaire')
      .lt('date_inventaire', dateFrom)
      .order('date_inventaire', { ascending: false })

    // 4. Réceptions de la période
    const { data: receptions } = await supabase
      .from('stock_movements').select('item_id, qty, stock_items(name, matiere_ref)')
      .eq('type', 'reception')
      .gte('created_at', dateFrom).lte('created_at', dateTo)

    // 5. Pertes de la période
    const { data: pertes } = await supabase
      .from('stock_pertes').select('item_name, qte, matiere_ref')
      .gte('date_perte', dateFrom).lte('date_perte', dateTo)

    // 6. Stock items pour liens matiere_ref
    const { data: stockItems } = await supabase
      .from('stock_items').select('id, name, matiere_ref')

    // ── Construire les maps ───────────────────────────────────────────────
    const mpMap = {} // matiere_norm → { prixUnit, unite, actif }
    for (const m of (mp || [])) {
      mpMap[norm(m.matiere)] = {
        prixUnit: m.quantite > 0 ? m.prix / m.quantite : 0,
        unite: m.unite, actif: m.actif !== false, nom: m.matiere
      }
    }

    // Conso théorique agrégée par matière normalisée
    const consoTheoMap = {} // norm → { qte, cout }
    for (const row of (consoData || [])) {
      const k = norm(row.matiere)
      consoTheoMap[k] = {
        qte:  (consoTheoMap[k]?.qte  || 0) + parseFloat(row.qte_theo  || 0),
        cout: (consoTheoMap[k]?.cout || 0) + parseFloat(row.cout_theo || 0),
        nom:  row.matiere
      }
    }

    // Lien stock_item → matiere_ref
    const itemMatiereMap = {} // item_name_norm → matiere_norm
    for (const si of (stockItems || [])) {
      if (si.matiere_ref) itemMatiereMap[norm(si.name)] = norm(si.matiere_ref)
    }

    // Réceptions par matière
    const recuMap = {} // matiere_norm → qte
    for (const r of (receptions || [])) {
      const mRef = r.stock_items?.matiere_ref || r.stock_items?.name
      if (!mRef) continue
      const k = norm(mRef)
      recuMap[k] = (recuMap[k] || 0) + parseFloat(r.qty || 0)
    }

    // Pertes par matière
    const pertesMap = {} // matiere_norm → qte
    for (const p of (pertes || [])) {
      const mRef = p.matiere_ref || p.item_name
      const k = norm(mRef)
      pertesMap[k] = (pertesMap[k] || 0) + parseFloat(p.qte || 0)
    }

    // Inventaire le plus récent AVANT la période (stock début)
    const invDebutMap = {} // item_name_norm → qte
    const seenAvant = new Set()
    for (const i of (invAvant || [])) {
      const k = norm(i.item_name)
      if (!seenAvant.has(k)) { invDebutMap[k] = parseFloat(i.qte_physique || 0); seenAvant.add(k) }
    }

    // Dernier inventaire dans la période (stock fin)
    const invFinMap = {} // item_name_norm → qte
    for (const i of (invData || [])) {
      invFinMap[norm(i.item_name)] = parseFloat(i.qte_physique || 0)
    }

    // ── Calculer les écarts pour chaque matière avec conso théorique ─────
    const allMatieres = new Set([
      ...Object.keys(consoTheoMap),
      ...Object.keys(mpMap),
    ])

    const rows = []
    for (const k of allMatieres) {
      const info    = mpMap[k]
      if (!info) continue

      const consoTheo = consoTheoMap[k]?.qte || 0
      if (consoTheo === 0) continue // Pas de conso = pas pertinent

      // Conso réelle = stock début + réceptions - stock fin - pertes
      const stockDebut = invDebutMap[k] ?? null
      const stockFin   = invFinMap[k]   ?? null
      const recu       = recuMap[k]     || 0
      const perdus     = pertesMap[k]   || 0

      let consoReelle = null
      if (stockDebut !== null && stockFin !== null) {
        consoReelle = stockDebut + recu - stockFin - perdus
      } else if (stockFin !== null) {
        // Pas d'inventaire précédent — on utilise le stock calculé
        consoReelle = recu - stockFin - perdus
      }

      const ecart    = consoReelle !== null ? consoTheo - consoReelle : null
      const ecartPct = consoTheo > 0 && consoReelle !== null ? pct(consoTheo, consoReelle) : null
      const prixUnit = info.prixUnit || 0
      const coutTheo  = consoTheoMap[k]?.cout || consoTheo * prixUnit
      const coutEcart = ecart !== null ? ecart * prixUnit : null

      rows.push({
        matiere:      info.nom || consoTheoMap[k]?.nom || k,
        unite:        info.unite || '',
        actif:        info.actif,
        consoTheo:    parseFloat(consoTheo.toFixed(2)),
        consoReelle:  consoReelle !== null ? parseFloat(consoReelle.toFixed(2)) : null,
        stockDebut,
        stockFin,
        recu,
        ecart:        ecart !== null ? parseFloat(ecart.toFixed(2)) : null,
        ecartPct,
        coutTheo:     parseFloat(coutTheo.toFixed(3)),
        coutEcart:    coutEcart !== null ? parseFloat(coutEcart.toFixed(3)) : null,
        prixUnit,
        hasInventaire: stockFin !== null,
      })
    }

    // Tri
    rows.sort((a, b) => {
      if (sortBy === 'nom') return a.matiere.localeCompare(b.matiere)
      if (sortBy === 'cout') return (b.coutTheo || 0) - (a.coutTheo || 0)
      // Par défaut: écart % absolu décroissant, sans inventaire à la fin
      if (!a.hasInventaire && b.hasInventaire) return 1
      if (a.hasInventaire && !b.hasInventaire) return -1
      return Math.abs(parseFloat(b.ecartPct || 0)) - Math.abs(parseFloat(a.ecartPct || 0))
    })

    setResultats(rows)
    setLoading(false)
    setLoaded(true)
  }

  const displayed = filterActif ? resultats.filter(r => r.actif) : resultats
  const totalCoutTheo  = displayed.reduce((s, r) => s + (r.coutTheo || 0), 0)
  const totalCoutEcart = displayed.filter(r => r.coutEcart).reduce((s, r) => s + (r.coutEcart || 0), 0)
  const sansinventaire = displayed.filter(r => !r.hasInventaire).length

  function downloadCSV() {
    const rows = [['Matière','Unité','Conso théo.','Conso réelle','Écart qté','Écart %','Coût théo.','Coût écart']]
    for (const r of displayed) {
      rows.push([r.matiere, r.unite, r.consoTheo, r.consoReelle??'', r.ecart??'', r.ecartPct??'', r.coutTheo, r.coutEcart??''])
    }
    const csv = rows.map(r => r.map(c => '"'+String(c)+'"').join(';')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download=`ecarts_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Écarts</h1>
        <p className="page-subtitle">Consommation théorique vs réelle</p>
      </div>

      <div className="page-content">

        {/* FILTRES */}
        <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          {/* Périodes rapides */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {PERIODES.map(p => (
              <button key={p.label}
                className={`btn btn-sm ${dateFrom===p.from&&dateTo===p.to?'btn-primary':'btn-outline'}`}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Dates personnalisées */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ fontSize: '0.82rem' }}/>
            <input className="form-input" type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ fontSize: '0.82rem' }}/>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" disabled={loading} onClick={charger}>
              {loading ? <Spinner size={14}/> : '↻'} Calculer
            </button>
            <button className={`btn btn-sm ${filterActif?'btn-primary':'btn-outline'}`} onClick={() => setFilterActif(v=>!v)}>
              Actifs seulement
            </button>
            <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
              {['ecart_pct','cout','nom'].map(s => (
                <button key={s} className={`btn btn-sm ${sortBy===s?'btn-primary':'btn-outline'}`} onClick={() => setSortBy(s)}>
                  {s==='ecart_pct'?'% Écart':s==='cout'?'Coût':'Nom'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* MESSAGE SI PAS D'INVENTAIRE */}
        {loaded && sansinventaire > 0 && (
          <div style={{ background: '#FEF3DC', border: '1.5px solid #D4892A', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem' }}>
            <strong style={{ color: '#8A5200' }}>ℹ {sansinventaire} matière{sansinventaire>1?'s':''} sans inventaire</strong>
            <div style={{ color: '#8A5200', marginTop: 2, fontSize: '0.75rem' }}>
              La conso réelle ne peut pas être calculée sans inventaire physique dans la période.
              Fais un inventaire dans Stock → Inventaire pour voir les écarts réels.
            </div>
          </div>
        )}

        {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Spinner size={28}/></div>}

        {loaded && !loading && (
          <>
            {/* TOTAUX */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: '1rem' }}>
              {[
                { label: 'Matières analysées', value: displayed.length, color: 'var(--outside-dark)' },
                { label: 'Coût théorique', value: fDT(totalCoutTheo), color: 'var(--outside-green)' },
                { label: 'Coût écart total', value: fDT(totalCoutEcart), color: totalCoutEcart > 0 ? 'var(--danger)' : 'var(--outside-green)' },
              ].map(k => (
                <div key={k.label} className="card" style={{ padding: '0.75rem' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: k.color, fontWeight: 400 }}>{k.value}</div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* BOUTON EXPORT */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={downloadCSV}><Download size={13}/> CSV</button>
            </div>

            {/* TABLEAU */}
            <div className="card">
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px 60px', gap: 4, padding: '6px 12px', background: 'var(--outside-dark)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
                <div>Matière</div>
                <div style={{ textAlign: 'center' }}>Théo.</div>
                <div style={{ textAlign: 'center' }}>Réel</div>
                <div style={{ textAlign: 'center' }}>Écart%</div>
                <div style={{ textAlign: 'right' }}>Coût</div>
              </div>

              {displayed.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Aucune donnée — sélectionne une période et clique Calculer
                </div>
              ) : displayed.map((r, idx) => {
                const ep = r.ecartPct != null ? parseFloat(r.ecartPct) : null
                const color = ecartColor(ep)
                return (
                  <div key={r.matiere} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 50px 60px', gap: 4, padding: '7px 12px', borderTop: '1px solid var(--outside-cream)', alignItems: 'center' }}>
                    {/* NOM */}
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.matiere}</div>
                      {!r.hasInventaire && <div style={{ fontSize: '0.58rem', color: '#D4892A', fontWeight: 700 }}>Sans inventaire</div>}
                    </div>
                    {/* CONSO THEO */}
                    <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: 'var(--outside-dark)' }}>
                      {f1(r.consoTheo)}
                      <div style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>{r.unite}</div>
                    </div>
                    {/* CONSO REELLE */}
                    <div style={{ textAlign: 'center', fontSize: '0.78rem', fontWeight: 700, color: r.hasInventaire ? 'var(--outside-dark)' : 'var(--muted)' }}>
                      {r.hasInventaire ? f1(r.consoReelle) : '—'}
                      {r.hasInventaire && <div style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>{r.unite}</div>}
                    </div>
                    {/* ÉCART % */}
                    <div style={{ textAlign: 'center' }}>
                      {ep != null ? (
                        <div style={{ fontWeight: 800, fontSize: '0.78rem', color, background: color+'15', borderRadius: 4, padding: '1px 4px' }}>
                          {ep > 0 ? '+' : ''}{ep}%
                        </div>
                      ) : <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>—</span>}
                    </div>
                    {/* COÛT */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{fDT(r.coutTheo)}</div>
                      {r.coutEcart != null && Math.abs(r.coutEcart) > 0.01 && (
                        <div style={{ fontSize: '0.62rem', color: r.coutEcart > 0 ? 'var(--danger)' : 'var(--outside-green)', fontWeight: 700 }}>
                          {r.coutEcart > 0 ? '+' : ''}{fDT(r.coutEcart)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}
