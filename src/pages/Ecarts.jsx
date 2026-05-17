import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, subWeeks, startOfWeek, endOfWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronRight } from 'lucide-react'

function fmt(n)    { return n == null ? '—' : parseFloat(n).toFixed(1) }
function fmtDT(n)  { return n == null ? '—' : parseFloat(n).toFixed(3) + ' DT' }
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
  { label: 'Ce mois',   from: format(startOfMonth(today), 'yyyy-MM-dd'),              to: format(today, 'yyyy-MM-dd') },
  { label: 'M-1',       from: format(startOfMonth(subMonths(today,1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(today,1)), 'yyyy-MM-dd') },
  { label: 'S en cours',from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
  { label: 'S-1',       from: format(startOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
]

export default function Ecarts() {
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(PERIODES[0].from)
  const [dateTo,   setDateTo]   = useState(PERIODES[0].to)
  const [matieres, setMatieres] = useState([])
  const [stockDebut, setStockDebut] = useState({})
  const [stockFin,   setStockFin]   = useState({})
  const [resultats,  setResultats]  = useState([])

  async function chargerMatieres() {
    setLoading(true)

    // 1. Ventes hors conso perso
    const { data: ventes } = await supabase
      .from('transaction_line')
      .select('produit, qte')
      .gte('date_vente', dateFrom)
      .lte('date_vente', dateTo)
      .neq('numtable', 32)

    // 2. Composition TOUS types (produit fini + base + foam)
    const { data: compoAll } = await supabase
      .from('composition_produit')
      .select('nom_produit, matiere, quantite_m, unite, prix_achat, type')

    // 3. Matières premières
    const { data: mp } = await supabase
      .from('matiere_premiere')
      .select('matiere, unite, prix')

    if (!ventes || !compoAll || !mp) { setLoading(false); return }

    // Index MP
    const mpMap = {}
    for (const m of mp) mpMap[m.matiere] = m

    // Séparer composition par type
    const compoProduit = compoAll.filter(c => c.type === 'produit fini')
    const compoBase    = compoAll.filter(c => c.type === 'base')

    // Index base → ses matières
    // ex: "BASE NUTELLA" → [{ matiere: 'Lait', quantite_m: 1000 }, ...]
    const baseMap = {}
    for (const c of compoBase) {
      if (!baseMap[c.nom_produit]) baseMap[c.nom_produit] = []
      baseMap[c.nom_produit].push(c)
    }

    // Ventes par produit
    const venteMap = {}
    for (const v of ventes) {
      venteMap[v.produit] = (venteMap[v.produit] || 0) + v.qte
    }

    // Calcul conso théorique par matière finale
    // en décomposant les bases dans les produits
    const consoMap = {}

    for (const c of compoProduit) {
      const qteProd = venteMap[c.nom_produit] || 0
      if (qteProd === 0) continue

      const nomMatiere = c.matiere.toUpperCase().trim()

      // Si c'est une base → décomposer (matching insensible casse + accents)
      const normalizeBase = s => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
      const baseKey = Object.keys(baseMap).find(k => normalizeBase(k) === normalizeBase(nomMatiere))
      if (baseKey) {
        const baseMap2 = baseMap // alias pour closure
        const baseIngredients = baseMap[baseKey]
        // quantite_m dans composition = ml de base utilisés par produit
        const qteBase = parseFloat(c.quantite_m || 0)

        // Trouver la quantite totale de cette base (sa propre recette est pour combien?)
        // Convention : la base est définie pour 1000 unités → ratio
        const baseTotal = baseIngredients.reduce((s, bi) => s + parseFloat(bi.quantite_m || 0), 0)
        const ratio = baseTotal > 0 ? qteBase / 1000 : 0 // ratio par rapport à la recette de base (1000ml)

        for (const bi of baseIngredients) {
          const matiere = bi.matiere
          const consoTotale = qteProd * ratio * parseFloat(bi.quantite_m || 0)
          const prixUnit = parseFloat(bi.prix_achat || mpMap[matiere]?.prix || 0)
          const coutTotal = qteProd * ratio * prixUnit
          if (!consoMap[matiere]) consoMap[matiere] = { qte: 0, cout: 0, unite: bi.unite }
          consoMap[matiere].qte  += consoTotale
          consoMap[matiere].cout += coutTotal
        }
      } else {
        // Ingrédient direct
        const matiere = c.matiere
        const consoTotale = qteProd * parseFloat(c.quantite_m || 0)
        const prixUnit = parseFloat(c.prix_achat || mpMap[matiere]?.prix || 0)
        const coutTotal = qteProd * prixUnit
        if (!consoMap[matiere]) consoMap[matiere] = { qte: 0, cout: 0, unite: c.unite }
        consoMap[matiere].qte  += consoTotale
        consoMap[matiere].cout += coutTotal
      }
    }

    const list = Object.entries(consoMap)
      .filter(([, v]) => v.qte > 0.01)
      .map(([matiere, v]) => ({
        matiere,
        unite:       v.unite || mpMap[matiere]?.unite || '—',
        consoTheo:   parseFloat(v.qte.toFixed(2)),
        coutTheo:    parseFloat(v.cout.toFixed(3)),
        prixUnitaire: mpMap[matiere]?.prix || null,
      }))
      .sort((a, b) => b.coutTheo - a.coutTheo)

    const initStock = {}
    list.forEach(m => { initStock[m.matiere] = '' })

    setMatieres(list)
    setStockDebut(initStock)
    setStockFin(initStock)
    setLoading(false)
  }

  function calculerResultats() {
    const res = matieres.map(m => {
      const debut      = parseFloat(stockDebut[m.matiere]) || 0
      const fin        = parseFloat(stockFin[m.matiere])   || 0
      const consoReelle = parseFloat((debut - fin).toFixed(2))
      const ecart      = parseFloat((consoReelle - m.consoTheo).toFixed(2))
      const pctVal     = pct(consoReelle, m.consoTheo)
      const coutEcart  = m.prixUnitaire ? parseFloat((ecart * m.prixUnitaire).toFixed(3)) : null
      return { ...m, stockDebut: debut, stockFin: fin, consoReelle, ecart, pctEcart: pctVal, coutEcart }
    })
    const sorted = [...res].sort((a, b) => Math.abs(b.coutEcart || 0) - Math.abs(a.coutEcart || 0))
    setResultats(sorted)
    setStep(3)
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

              {/* RACCOURCIS */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {PERIODES.map(p => (
                  <button key={p.label}
                    className={`btn btn-sm ${dateFrom === p.from && dateTo === p.to ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* DATES MANUELLES */}
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

              {/* PERIODE AFFICHEE */}
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
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '0.75rem' }}>
                  {matieres.length} matières · saisir le stock de début de période
                </div>
                <div className="card">
                  <div style={{ padding: '0.6rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: '8px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Matière</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--outside-orange)', textAlign: 'right' }}>Conso théo.</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center' }}>Début</span>
                  </div>
                  {matieres.map((m, idx) => (
                    <div key={m.matiere} style={{ padding: '0.7rem 1rem', borderBottom: idx < matieres.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr 70px 70px', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.matiere}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{m.unite}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--outside-orange)' }}>{fmt(m.consoTheo)}</div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>{fmtDT(m.coutTheo)}</div>
                      </div>
                      <input type="number" min="0" step="0.1" placeholder="0"
                        value={stockDebut[m.matiere] || ''}
                        onChange={e => setStockDebut(p => ({ ...p, [m.matiere]: e.target.value }))}
                        style={{ width: '100%', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-cream2)', borderRadius: 'var(--radius-sm)', padding: '4px 2px', fontFamily: 'var(--font-body)', color: 'var(--outside-dark)', outline: 'none', background: 'white' }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
                  onClick={() => setStep(2)}>
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
              Stock physique compté en fin de période
            </div>
            <div className="card">
              <div style={{ padding: '0.6rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr 55px 70px', gap: '8px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Matière</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'center' }}>Début</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--outside-orange)', textAlign: 'center' }}>Fin</span>
              </div>
              {matieres.map((m, idx) => (
                <div key={m.matiere} style={{ padding: '0.7rem 1rem', borderBottom: idx < matieres.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr 55px 70px', gap: '8px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{m.matiere}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{m.unite}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: 'var(--muted)' }}>
                    {stockDebut[m.matiere] || '0'}
                  </div>
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
            {(() => {
              const totalCoutTheo  = resultats.reduce((s, r) => s + r.coutTheo, 0)
              const totalCoutEcart = resultats.reduce((s, r) => s + (r.coutEcart || 0), 0)
              const nbAlerte       = resultats.filter(r => r.pctEcart && Math.abs(parseFloat(r.pctEcart)) > 10).length
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                  <div className="card" style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût théo.</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>{totalCoutTheo.toFixed(2)} DT</div>
                  </div>
                  <div className="card" style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût écarts</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: totalCoutEcart > 0 ? '#B03A1A' : '#1A5C4A' }}>
                      {totalCoutEcart > 0 ? '+' : ''}{totalCoutEcart.toFixed(2)} DT
                    </div>
                  </div>
                  <div className="card" style={{ padding: '0.85rem', gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Alertes (&gt;10%)</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: nbAlerte > 0 ? '#B03A1A' : '#1A5C4A' }}>{nbAlerte} matière{nbAlerte > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>
                      {format(new Date(dateFrom + 'T00:00:00'), "d MMM", { locale: fr })} → {format(new Date(dateTo + 'T00:00:00'), "d MMM", { locale: fr })}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div className="card" style={{ marginBottom: '1rem' }}>
              {resultats.map((r, idx) => {
                const pctNum  = r.pctEcart ? parseFloat(r.pctEcart) : 0
                const isAlert = Math.abs(pctNum) > 10
                return (
                  <div key={r.matiere} style={{ padding: '0.85rem 1rem', borderBottom: idx < resultats.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', background: isAlert ? (pctNum > 0 ? '#FFF8F5' : '#F0FFF8') : 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.matiere} <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>{r.unite}</span></div>
                      {r.pctEcart && (
                        <div style={{ fontWeight: 800, fontSize: '0.8rem', color: ecartColor(r.pctEcart), background: isAlert ? (pctNum > 0 ? '#FDEEEC' : '#E0F2EB') : 'var(--outside-cream)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {pctNum > 0 ? '+' : ''}{r.pctEcart}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px' }}>
                      {[
                        { l: 'Théo.',    v: fmt(r.consoTheo),    c: 'var(--muted)' },
                        { l: 'Réel',     v: fmt(r.consoReelle),  c: 'var(--ink)' },
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
