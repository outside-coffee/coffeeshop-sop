import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronRight, Download, Filter, FileText } from 'lucide-react'

function fmt(n) {
  if (n == null) return '—'
  const v = parseFloat(n)
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)
}
function fmtDT(n) {
  if (n == null) return '—'
  const v = parseFloat(n)
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v) + ' DT'
}
function fmtDT2(n) {
  if (n == null) return '—'
  const v = parseFloat(n)
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' DT'
}
function pct(a, b) { return b === 0 ? null : ((a - b) / b * 100).toFixed(1) }
function ecartColor(p) {
  if (p == null) return 'var(--muted)'
  const v = parseFloat(p)
  if (v > 15)  return '#B03A1A'
  if (v > 5)   return '#D4892A'
  if (v < -5)  return '#1A5C4A'
  return 'var(--ink)'
}

const today = new Date()
const PERIODES = [
  { label: 'Ce mois',    from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
  { label: 'M-1',        from: format(startOfMonth(subMonths(today,1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(today,1)), 'yyyy-MM-dd') },
  { label: 'S en cours', from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
  { label: 'S-1',        from: format(startOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
]

export default function Ecarts() {
  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [dateFrom, setDateFrom] = useState(PERIODES[0].from)
  const [dateTo,   setDateTo]   = useState(PERIODES[0].to)
  const [matieres, setMatieres] = useState([])
  const [selected, setSelected] = useState(new Set()) // matières sélectionnées
  const [showFilter, setShowFilter] = useState(false)
  const [stockDebut, setStockDebut] = useState({})
  const [stockFin,   setStockFin]   = useState({})
  const [resultats,  setResultats]  = useState([])

  async function chargerMatieres() {
    setLoading(true)

    // 1. Ventes — pagination pour dépasser la limite 1000 lignes Supabase
    let ventes = [], page = 0
    while (true) {
      const { data: batch } = await supabase
        .from('transaction_line').select('produit, qte')
        .gte('date_vente', dateFrom).lte('date_vente', dateTo)
        .neq('numtable', 32)
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      ventes = ventes.concat(batch)
      if (batch.length < 1000) break
      page++
    }

    // 2. Composition
    const { data: compoAll } = await supabase.from('composition_produit')
      .select('nom_produit, matiere, quantite_m, unite, prix_achat, type')

    // 3. Matières premières
    const { data: mp } = await supabase.from('matiere_premiere')
      .select('matiere, unite, prix, quantite')

    if (!ventes || !compoAll || !mp) { setLoading(false); return }

    const mpMap = {}
    for (const m of mp) {
      // prix dans matiere_premiere = prix pour 'quantite' unités
      // → on ramène au prix par unité réelle (g, ml, unité...)
      const prixParUnite = m.quantite > 0 ? parseFloat(m.prix || 0) / parseFloat(m.quantite) : parseFloat(m.prix || 0)
      mpMap[m.matiere] = { ...m, prixParUnite }
    }

    const compoProduit = compoAll.filter(c => c.type === 'produit fini')
    const compoBase    = compoAll.filter(c => c.type === 'base')

    const baseMap = {}
    for (const c of compoBase) {
      if (!baseMap[c.nom_produit]) baseMap[c.nom_produit] = []
      baseMap[c.nom_produit].push(c)
    }

    // VenteMap avec trim+uppercase
    const venteMap = {}
    for (const v of ventes) {
      const k = v.produit.trim().toUpperCase()
      venteMap[k] = (venteMap[k] || 0) + v.qte
    }

    const normalizeStr = s => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

    const consoMap = {}
    for (const c of compoProduit) {
      const qteProd = venteMap[c.nom_produit.trim().toUpperCase()] || 0
      if (qteProd === 0) continue

      const nomMatiere = c.matiere.toUpperCase().trim()
      const baseKey    = Object.keys(baseMap).find(k => normalizeStr(k) === normalizeStr(nomMatiere))

      if (baseKey) {
        const baseIngredients = baseMap[baseKey]
        const qteBase  = parseFloat(c.quantite_m || 0)
        const ratio    = qteBase / 1000
        for (const bi of baseIngredients) {
          const matiere    = bi.matiere
          const consoTot   = qteProd * ratio * parseFloat(bi.quantite_m || 0)
          const prixUnit   = parseFloat(bi.prix_achat || mpMap[matiere]?.prixParUnite || 0)
          if (!consoMap[matiere]) consoMap[matiere] = { qte: 0, cout: 0, unite: bi.unite }
          consoMap[matiere].qte  += consoTot
          consoMap[matiere].cout += qteProd * ratio * prixUnit
        }
      } else {
        const matiere  = c.matiere
        const consoTot = qteProd * parseFloat(c.quantite_m || 0)
        const prixUnit = parseFloat(c.prix_achat || mpMap[matiere]?.prixParUnite || 0)
        if (!consoMap[matiere]) consoMap[matiere] = { qte: 0, cout: 0, unite: c.unite }
        consoMap[matiere].qte  += consoTot
        consoMap[matiere].cout += qteProd * prixUnit
      }
    }

    const list = Object.entries(consoMap)
      .filter(([, v]) => v.qte > 0.01)
      .map(([matiere, v]) => ({
        matiere,
        unite:        v.unite || mpMap[matiere]?.unite || '—',
        consoTheo:    parseFloat(v.qte.toFixed(2)),
        coutTheo:     parseFloat(v.cout.toFixed(3)),
        prixUnitaire: mpMap[matiere]?.prixParUnite || null,
      }))
      .sort((a, b) => b.coutTheo - a.coutTheo)

    const initStock = {}
    list.forEach(m => { initStock[m.matiere] = '' })

    setMatieres(list)
    setSelected(new Set(list.map(m => m.matiere))) // tout sélectionné par défaut
    setStockDebut(initStock)
    setStockFin(initStock)
    setLoading(false)
  }

  function toggleMatiere(matiere) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(matiere) ? n.delete(matiere) : n.add(matiere)
      return n
    })
  }

  function selectAll()  { setSelected(new Set(matieres.map(m => m.matiere))) }
  function selectNone() { setSelected(new Set()) }

  const matieresFiltrees = matieres.filter(m => selected.has(m.matiere))

  function calculerResultats() {
    const res = matieresFiltrees.map(m => {
      const debut       = parseFloat(stockDebut[m.matiere]) || 0
      const fin         = parseFloat(stockFin[m.matiere])   || 0
      const consoReelle = parseFloat((debut - fin).toFixed(2))
      const ecart       = parseFloat((consoReelle - m.consoTheo).toFixed(2))
      const pctVal      = pct(consoReelle, m.consoTheo)
      const coutEcart   = m.prixUnitaire ? parseFloat((ecart * m.prixUnitaire).toFixed(3)) : null
      return { ...m, stockDebut: debut, stockFin: fin, consoReelle, ecart, pctEcart: pctVal, coutEcart }
    })
    const sorted = [...res].sort((a, b) => Math.abs(b.coutEcart || 0) - Math.abs(a.coutEcart || 0))
    setResultats(sorted)
    setStep(3)
  }

  // ── EXPORT PDF ────────────────────────────────────────────────────────
  function exportPDF() {
    const periode = `${format(new Date(dateFrom + 'T00:00:00'), "d MMM", { locale: fr })} → ${format(new Date(dateTo + 'T00:00:00'), "d MMM yyyy", { locale: fr })}`
    const totalCoutTheo  = resultats.reduce((s, r) => s + r.coutTheo, 0)
    const totalCoutEcart = resultats.reduce((s, r) => s + (r.coutEcart || 0), 0)

    const rows = resultats.map(r => `
      <tr class="${Math.abs(parseFloat(r.pctEcart || 0)) > 10 ? (parseFloat(r.pctEcart) > 0 ? 'alert-high' : 'alert-low') : ''}">
        <td><strong>${r.matiere}</strong><br><small>${r.unite}</small></td>
        <td class="num">${fmt(r.consoTheo)}</td>
        <td class="num">${fmt(r.consoReelle)}</td>
        <td class="num ${parseFloat(r.ecart || 0) > 0 ? 'red' : 'green'}">${r.ecart >= 0 ? '+' : ''}${fmt(r.ecart)}</td>
        <td class="num ${parseFloat(r.pctEcart || 0) > 10 ? 'red' : parseFloat(r.pctEcart || 0) < -5 ? 'green' : ''}">${r.pctEcart ? (parseFloat(r.pctEcart) > 0 ? '+' : '') + r.pctEcart + '%' : '—'}</td>
        <td class="num">${fmtDT(r.coutTheo)}</td>
        <td class="num ${parseFloat(r.coutEcart || 0) > 0 ? 'red' : 'green'}">${r.coutEcart != null ? (r.coutEcart > 0 ? '+' : '') + fmtDT(r.coutEcart) : '—'}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Écarts — ${periode}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1D3A3A; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #1D3A3A; padding-bottom: 12px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #1D3A3A; }
  .header .periode { font-size: 12px; color: #5A7070; margin-top: 4px; }
  .logo { font-size: 18px; font-weight: 900; color: #C4521A; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  .summary-card { background: #F2EDE4; border-radius: 8px; padding: 10px 14px; }
  .summary-card .label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #5A7070; margin-bottom: 4px; }
  .summary-card .value { font-size: 16px; font-weight: 700; }
  .red { color: #B03A1A; }
  .green { color: #1A5C4A; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1D3A3A; color: white; padding: 7px 10px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
  th.num, td.num { text-align: right; }
  td { padding: 7px 10px; border-bottom: 1px solid #F2EDE4; font-size: 10.5px; }
  td small { color: #5A7070; font-size: 9px; }
  tr.alert-high { background: #FFF8F5; }
  tr.alert-low  { background: #F0FFF8; }
  tr:last-child td { border-bottom: none; }
  .total-row td { border-top: 2px solid #1D3A3A; font-weight: 700; background: #F2EDE4; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Outside ☕</div>
      <h1>Contrôle des écarts</h1>
      <div class="periode">${periode} · ${resultats.length} matières analysées</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#5A7070">
      Généré le ${format(new Date(), "d MMM yyyy 'à' HH:mm", { locale: fr })}
    </div>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="label">Coût théorique</div>
      <div class="value">${fmtDT2(totalCoutTheo)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Coût des écarts</div>
      <div class="value ${totalCoutEcart > 0 ? 'red' : 'green'}">${totalCoutEcart > 0 ? '+' : ''}${fmtDT2(totalCoutEcart)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Alertes > 10%</div>
      <div class="value ${resultats.filter(r => Math.abs(parseFloat(r.pctEcart||0))>10).length > 0 ? 'red' : 'green'}">${resultats.filter(r => Math.abs(parseFloat(r.pctEcart||0))>10).length} matière(s)</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Matière</th>
        <th class="num">Conso Théo.</th>
        <th class="num">Conso Réelle</th>
        <th class="num">Écart</th>
        <th class="num">% Écart</th>
        <th class="num">Coût Théo.</th>
        <th class="num">Coût Écart</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td><strong>TOTAL</strong></td>
        <td></td><td></td><td></td><td></td>
        <td class="num">${fmtDT2(totalCoutTheo)}</td>
        <td class="num ${totalCoutEcart > 0 ? 'red' : 'green'}">${totalCoutEcart > 0 ? '+' : ''}${fmtDT2(totalCoutEcart)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.onload = () => win.print()
  }

  // ── EXPORT CSV ────────────────────────────────────────────────────────
  function exportCSV() {
    const header = ['Matière','Unité','Conso Théo.','Conso Réelle','Écart','% Écart','Coût Théo. (DT)','Coût Écart (DT)','Stock Début','Stock Fin']
    const rows = resultats.map(r => [
      r.matiere, r.unite,
      fmt(r.consoTheo), fmt(r.consoReelle),
      `${r.ecart >= 0 ? '+' : ''}${fmt(r.ecart)}`,
      r.pctEcart ? `${r.pctEcart}%` : '—',
      fmtDT(r.coutTheo), r.coutEcart != null ? `${r.coutEcart > 0 ? '+' : ''}${fmtDT(r.coutEcart)}` : '—',
      r.stockDebut, r.stockFin,
    ])

    const totalCoutTheo  = resultats.reduce((s, r) => s + r.coutTheo, 0)
    const totalCoutEcart = resultats.reduce((s, r) => s + (r.coutEcart || 0), 0)

    const csv = [
      [`Contrôle des écarts — ${format(new Date(dateFrom + 'T00:00:00'), "d MMM", { locale: fr })} → ${format(new Date(dateTo + 'T00:00:00'), "d MMM yyyy", { locale: fr })}`],
      [],
      header,
      ...rows,
      [],
      ['TOTAL','','','','','', fmtDT(totalCoutTheo), `${totalCoutEcart > 0 ? '+' : ''}${fmtDT(totalCoutEcart)}`],
    ].map(row => row.join(';')).join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `ecarts_${dateFrom}_${dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const STEP_LABELS = ['1 · Inventaire début', '2 · Inventaire fin', '3 · Résultats']

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Contrôle des écarts</h1>
        <p className="page-subtitle">{format(new Date(), "EEE d MMM yyyy", { locale: fr })}</p>
      </div>

      <div className="page-content">

        {/* STEPS */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem', overflowX: 'auto', scrollbarWidth: 'none', marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
          {STEP_LABELS.map((label, i) => (
            <button key={i} onClick={() => i + 1 < step && setStep(i + 1)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: '0.8rem', whiteSpace: 'nowrap', flexShrink: 0, cursor: i + 1 < step ? 'pointer' : 'default', background: step === i + 1 ? 'var(--outside-orange)' : i + 1 < step ? 'var(--outside-cream2)' : 'var(--outside-cream)', color: step === i + 1 ? 'white' : 'var(--muted)' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ÉTAPE 1 ──────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>Période</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {PERIODES.map(p => (
                  <button key={p.label}
                    className={`btn btn-sm ${dateFrom === p.from && dateTo === p.to ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label">Du</label>
                  <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Au</label>
                  <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.75rem', textAlign: 'center' }}>
                {format(new Date(dateFrom + 'T00:00:00'), "d MMM", { locale: fr })} → {format(new Date(dateTo + 'T00:00:00'), "d MMM yyyy", { locale: fr })}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={chargerMatieres} disabled={loading}>
                {loading ? <Spinner size={16} /> : '📊 Charger les matières'}
              </button>
            </div>

            {matieres.length > 0 && (
              <>
                {/* FILTRE MATIÈRES */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>
                    {selected.size}/{matieres.length} matières sélectionnées
                  </div>
                  <button className={`btn btn-sm ${showFilter ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setShowFilter(s => !s)}>
                    <Filter size={13} /> Filtrer
                  </button>
                </div>

                {/* PANNEAU FILTRE */}
                {showFilter && (
                  <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800 }}>Choisir les matières</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={selectAll}>Tout</button>
                        <button className="btn btn-ghost btn-sm" onClick={selectNone}>Aucun</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
                      {matieres.map(m => (
                        <label key={m.matiere} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 4px', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}>
                          <input type="checkbox" checked={selected.has(m.matiere)}
                            onChange={() => toggleMatiere(m.matiere)}
                            style={{ width: 16, height: 16, accentColor: 'var(--outside-orange)', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600 }}>{m.matiere}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 800 }}>{fmtDT(m.coutTheo)}</span>
                        </label>
                      ))}
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}
                      onClick={() => setShowFilter(false)}>
                      Appliquer ({selected.size} matières)
                    </button>
                  </div>
                )}

                {/* TABLEAU ÉTAPE 1 */}
                <div className="card">
                  <div style={{ padding: '0.6rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Matière</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--outside-orange)', textAlign: 'right' }}>Conso théo.</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center' }}>Début</span>
                  </div>
                  {matieresFiltrees.map((m, idx) => (
                    <div key={m.matiere} style={{ padding: '0.7rem 1rem', borderBottom: idx < matieresFiltrees.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.matiere}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{m.unite} · {fmtDT(m.coutTheo)}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.85rem', color: 'var(--outside-orange)' }}>{fmt(m.consoTheo)}</div>
                      <input type="number" min="0" step="0.1" placeholder="0"
                        value={stockDebut[m.matiere] || ''}
                        onChange={e => setStockDebut(p => ({ ...p, [m.matiere]: e.target.value }))}
                        style={{ width: '100%', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-cream2)', borderRadius: 'var(--radius-sm)', padding: '4px 2px', fontFamily: 'var(--font-body)', color: 'var(--outside-dark)', outline: 'none', background: 'white' }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                  onClick={() => setStep(2)} disabled={selected.size === 0}>
                  Suivant : Inventaire fin <ChevronRight size={18} />
                </button>
              </>
            )}
          </>
        )}

        {/* ── ÉTAPE 2 ──────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
              Stock physique compté en fin de période — {matieresFiltrees.length} matières
            </div>
            <div className="card">
              <div style={{ padding: '0.6rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr 55px 70px', gap: '8px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Matière</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center' }}>Début</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--outside-orange)', textAlign: 'center' }}>Fin</span>
              </div>
              {matieresFiltrees.map((m, idx) => (
                <div key={m.matiere} style={{ padding: '0.7rem 1rem', borderBottom: idx < matieresFiltrees.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr 55px 70px', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.matiere}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{m.unite}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--muted)' }}>{stockDebut[m.matiere] || '0'}</div>
                  <input type="number" min="0" step="0.1" placeholder="0"
                    value={stockFin[m.matiere] || ''}
                    onChange={e => setStockFin(p => ({ ...p, [m.matiere]: e.target.value }))}
                    style={{ width: '100%', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-orange)', borderRadius: 'var(--radius-sm)', padding: '4px 2px', fontFamily: 'var(--font-body)', color: 'var(--outside-dark)', outline: 'none', background: '#FFF8F5' }} />
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              onClick={calculerResultats}>
              Calculer les écarts <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* ── ÉTAPE 3 ──────────────────────────────────────────── */}
        {step === 3 && (
          <>
            {/* RÉSUMÉ + EXPORT */}
            {(() => {
              const totalCoutTheo  = resultats.reduce((s, r) => s + r.coutTheo, 0)
              const totalCoutEcart = resultats.reduce((s, r) => s + (r.coutEcart || 0), 0)
              const nbAlerte       = resultats.filter(r => r.pctEcart && Math.abs(parseFloat(r.pctEcart)) > 10).length
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                    <div className="card" style={{ padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût théo.</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{fmtDT2(totalCoutTheo)}</div>
                    </div>
                    <div className="card" style={{ padding: '0.85rem' }}>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût écarts</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: totalCoutEcart > 0 ? '#B03A1A' : '#1A5C4A' }}>
                        {totalCoutEcart > 0 ? '+' : ''}{fmtDT2(Math.abs(totalCoutEcart))}
                      </div>
                    </div>
                    <div className="card" style={{ padding: '0.85rem', gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Alertes (&gt;10%)</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: nbAlerte > 0 ? '#B03A1A' : '#1A5C4A' }}>{nbAlerte} matière{nbAlerte > 1 ? 's' : ''}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>
                          {format(new Date(dateFrom + 'T00:00:00'), "d MMM", { locale: fr })} → {format(new Date(dateTo + 'T00:00:00'), "d MMM", { locale: fr })}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-outline btn-sm" onClick={exportCSV}>
                            <Download size={14} /> CSV
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={exportPDF}>
                            <FileText size={14} /> PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}

            {/* TABLEAU RÉSULTATS */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              {resultats.map((r, idx) => {
                const pctNum  = r.pctEcart ? parseFloat(r.pctEcart) : 0
                const isAlert = Math.abs(pctNum) > 10
                return (
                  <div key={r.matiere} style={{ padding: '0.85rem 1rem', borderBottom: idx < resultats.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', background: isAlert ? (pctNum > 0 ? '#FFF8F5' : '#F0FFF8') : 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                        {r.matiere} <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>{r.unite}</span>
                      </div>
                      {r.pctEcart && (
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: ecartColor(r.pctEcart), background: isAlert ? (pctNum > 0 ? '#FDEEEC' : '#E0F2EB') : 'var(--outside-cream)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {pctNum > 0 ? '+' : ''}{r.pctEcart}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px' }}>
                      {[
                        { l: 'Théo.',    v: fmt(r.consoTheo),   c: 'var(--muted)' },
                        { l: 'Réel',     v: fmt(r.consoReelle), c: 'var(--ink)' },
                        { l: 'Écart',    v: `${r.ecart >= 0 ? '+' : ''}${fmt(r.ecart)}`, c: ecartColor(r.pctEcart) },
                        { l: 'Coût éc.', v: r.coutEcart != null ? `${r.coutEcart > 0 ? '+' : ''}${fmtDT(r.coutEcart)}` : '—', c: ecartColor(r.pctEcart) },
                      ].map(cell => (
                        <div key={cell.l}>
                          <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase' }}>{cell.l}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 800, color: cell.c }}>{cell.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="btn btn-outline" style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setStep(1); setResultats([]) }}>
              Nouvelle analyse
            </button>
          </>
        )}
      </div>
    </>
  )
}
