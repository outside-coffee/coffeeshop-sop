import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ChevronRight, Download } from 'lucide-react'

// ── HELPERS ───────────────────────────────────────────────────────────────
function fmt(n) { return n == null ? '—' : parseFloat(n).toFixed(1) }
function fmtDT(n) { return n == null ? '—' : parseFloat(n).toFixed(3) + ' DT' }
function pct(a, b) { return b === 0 ? null : ((a - b) / b * 100).toFixed(1) }
function ecartColor(pctVal) {
  if (pctVal == null) return 'var(--muted)'
  const v = parseFloat(pctVal)
  if (v > 15)  return '#B03A1A'
  if (v > 5)   return '#D4892A'
  if (v < -5)  return '#1A5C4A'
  return 'var(--ink)'
}

export default function Ecarts() {
  const { profile } = useAuth()
  const [step, setStep]     = useState(1)
  const [loading, setLoading] = useState(false)

  // Période
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), 'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(endOfMonth(today),   'yyyy-MM-dd'))

  // Données
  const [matieres, setMatieres]         = useState([])  // liste matières avec conso théo + coût
  const [stockDebut, setStockDebut]     = useState({})  // { matiere: qty }
  const [stockFin, setStockFin]         = useState({})  // { matiere: qty }
  const [resultats, setResultats]       = useState([])

  // ── ÉTAPE 1 : charger les matières ──────────────────────────────────
  async function chargerMatieres() {
    setLoading(true)
    // Conso théorique = ventes de la période × composition
    // 1. Ventes par produit sur la période
    const { data: ventes } = await supabase
      .from('transaction_line')
      .select('produit, qte')
      .gte('date_vente', dateFrom)
      .lte('date_vente', dateTo)
      .neq('numtable', 32) // exclure conso perso

    // 2. Composition des produits
    const { data: compo } = await supabase
      .from('composition_produit')
      .select('nom_produit, matiere, quantite_m, unite, prix_achat')
      .eq('type', 'produit fini')

    // 3. Matières premières (unité + prix)
    const { data: mp } = await supabase
      .from('matiere_premiere')
      .select('matiere, unite, prix')

    if (!ventes || !compo || !mp) { setLoading(false); return }

    // Agrégation ventes par produit
    const venteMap = {}
    for (const v of ventes) {
      venteMap[v.produit] = (venteMap[v.produit] || 0) + v.qte
    }

    // Calcul conso théorique par matière
    const consoMap = {}
    for (const c of compo) {
      const qteProd = venteMap[c.nom_produit] || 0
      if (qteProd === 0) continue
      const consoTotale = qteProd * parseFloat(c.quantite_m || 0)
      const coutTotal   = qteProd * parseFloat(c.prix_achat || 0)
      if (!consoMap[c.matiere]) consoMap[c.matiere] = { qte: 0, cout: 0, unite: c.unite }
      consoMap[c.matiere].qte  += consoTotale
      consoMap[c.matiere].cout += coutTotal
    }

    // Enrichir avec l'unité depuis matiere_premiere si manquante
    const mpMap = {}
    for (const m of mp) mpMap[m.matiere] = m

    const list = Object.entries(consoMap)
      .filter(([, v]) => v.qte > 0)
      .map(([matiere, v]) => ({
        matiere,
        unite:       v.unite || mpMap[matiere]?.unite || '—',
        consoTheo:   parseFloat(v.qte.toFixed(2)),
        coutTheo:    parseFloat(v.cout.toFixed(3)),
        prixUnitaire: mpMap[matiere]?.prix || null,
      }))
      .sort((a, b) => a.matiere.localeCompare(b.matiere))

    // Init stocks à 0
    const initStock = {}
    list.forEach(m => { initStock[m.matiere] = '' })

    setMatieres(list)
    setStockDebut(initStock)
    setStockFin(initStock)
    setLoading(false)
  }

  // ── ÉTAPE 3 : calculer les résultats ─────────────────────────────────
  function calculerResultats() {
    const res = matieres.map(m => {
      const debut   = parseFloat(stockDebut[m.matiere]) || 0
      const fin     = parseFloat(stockFin[m.matiere])   || 0
      // Réceptions sur la période (depuis stock_movements)
      const consoReelle = debut - fin // simplifié sans réceptions
      const ecart   = consoReelle - m.consoTheo
      const pctVal  = pct(consoReelle, m.consoTheo)
      const coutEcart = m.prixUnitaire ? ecart * m.prixUnitaire : null

      return {
        ...m,
        stockDebut:  debut,
        stockFin:    fin,
        consoReelle: parseFloat(consoReelle.toFixed(2)),
        ecart:       parseFloat(ecart.toFixed(2)),
        pctEcart:    pctVal,
        coutEcart:   coutEcart != null ? parseFloat(coutEcart.toFixed(3)) : null,
      }
    })
    setResultats(res)
    setStep(3)
  }

  // ── RENDU ─────────────────────────────────────────────────────────────
  const stepLabels = ['1 · Inventaire début', '2 · Inventaire fin', '3 · Résultats']

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Contrôle des écarts</h1>
        <p className="page-subtitle">{format(new Date(), "EEE d MMM yyyy", { locale: fr })}</p>
      </div>

      <div className="page-content">
        {/* STEPS */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.25rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {stepLabels.map((label, i) => (
            <button key={i}
              onClick={() => i + 1 <= step && setStep(i + 1)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-pill)', border: 'none',
                fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: '0.8rem',
                whiteSpace: 'nowrap', flexShrink: 0, cursor: i + 1 <= step ? 'pointer' : 'default',
                background: step === i + 1 ? 'var(--outside-orange)' : i + 1 < step ? 'var(--outside-cream2)' : 'var(--outside-cream)',
                color: step === i + 1 ? 'white' : i + 1 < step ? 'var(--outside-dark)' : 'var(--muted)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ÉTAPE 1 ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
                Période + stock de début
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
              <div style={{ display: 'flex', gap: '6px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Ce mois', from: format(startOfMonth(today), 'yyyy-MM-dd'), to: format(endOfMonth(today), 'yyyy-MM-dd') },
                  { label: 'Semaine', from: format(new Date(today.getTime() - 6*86400000), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') },
                ].map(p => (
                  <button key={p.label} className="btn btn-outline btn-sm"
                    onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                onClick={chargerMatieres} disabled={loading}>
                {loading ? <Spinner size={16} /> : '📊 Charger les matières'}
              </button>
            </div>

            {matieres.length > 0 && (
              <>
                <div className="card">
                  <div style={{ padding: '0.75rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Matière</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', textAlign: 'right', minWidth: 80 }}>Conso. théo.</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', textAlign: 'right', minWidth: 90 }}>Stock début</span>
                  </div>
                  {matieres.map((m, idx) => (
                    <div key={m.matiere} style={{ padding: '0.75rem 1rem', borderBottom: idx < matieres.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{m.matiere}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--outside-orange)', fontWeight: 700 }}>{fmtDT(m.coutTheo)}</div>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--outside-orange)' }}>{fmt(m.consoTheo)}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{m.unite}</div>
                      </div>
                      <input type="number" min="0" step="0.1"
                        placeholder="0"
                        value={stockDebut[m.matiere] || ''}
                        onChange={e => setStockDebut(p => ({ ...p, [m.matiere]: e.target.value }))}
                        style={{ width: 80, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-cream2)', borderRadius: 'var(--radius-sm)', padding: '5px 4px', fontFamily: 'var(--font-body)', color: 'var(--outside-dark)', outline: 'none', background: 'white' }}
                      />
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

        {/* ── ÉTAPE 2 ─────────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div style={{ background: 'var(--outside-cream)', borderRadius: 'var(--radius-md)', padding: '8px 12px', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
              Saisir le stock physique comptabilisé en fin de période
            </div>
            <div className="card">
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1.5px solid var(--outside-cream)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>Matière</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right', minWidth: 80 }}>Stock début</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', textAlign: 'right', minWidth: 80 }}>Stock fin</span>
              </div>
              {matieres.map((m, idx) => (
                <div key={m.matiere} style={{ padding: '0.75rem 1rem', borderBottom: idx < matieres.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{m.matiere}<div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{m.unite}</div></div>
                  <div style={{ textAlign: 'right', minWidth: 80, fontWeight: 700, fontSize: '0.875rem', color: 'var(--muted)' }}>
                    {stockDebut[m.matiere] || '0'}
                  </div>
                  <input type="number" min="0" step="0.1"
                    placeholder="0"
                    value={stockFin[m.matiere] || ''}
                    onChange={e => setStockFin(p => ({ ...p, [m.matiere]: e.target.value }))}
                    style={{ width: 80, textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', border: '2px solid var(--outside-orange)', borderRadius: 'var(--radius-sm)', padding: '5px 4px', fontFamily: 'var(--font-body)', color: 'var(--outside-dark)', outline: 'none', background: '#FFF8F5' }}
                  />
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center', marginTop: '1rem' }}
              onClick={calculerResultats}>
              Calculer les écarts <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* ── ÉTAPE 3 : RÉSULTATS ──────────────────────────────────── */}
        {step === 3 && (
          <>
            {/* RÉSUMÉ */}
            {(() => {
              const totalCoutTheo  = resultats.reduce((s, r) => s + r.coutTheo, 0)
              const totalCoutEcart = resultats.reduce((s, r) => s + (r.coutEcart || 0), 0)
              const nbAlerte       = resultats.filter(r => r.pctEcart && parseFloat(r.pctEcart) > 10).length
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                  <div className="card" style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût théorique</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--outside-dark)' }}>{totalCoutTheo.toFixed(2)} DT</div>
                  </div>
                  <div className="card" style={{ padding: '0.85rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Coût des écarts</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: totalCoutEcart > 0 ? '#B03A1A' : '#1A5C4A' }}>{totalCoutEcart > 0 ? '+' : ''}{totalCoutEcart.toFixed(2)} DT</div>
                  </div>
                  <div className="card" style={{ padding: '0.85rem', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>Alertes (&gt;10% d'écart)</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: nbAlerte > 0 ? '#B03A1A' : '#1A5C4A' }}>
                      {nbAlerte} matière{nbAlerte > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* TABLEAU RÉSULTATS */}
            <div className="card" style={{ marginBottom: '1rem' }}>
              {resultats.map((r, idx) => {
                const pctNum    = r.pctEcart ? parseFloat(r.pctEcart) : 0
                const isAlert   = Math.abs(pctNum) > 10
                const ecartSign = r.ecart >= 0 ? '+' : ''

                return (
                  <div key={r.matiere} style={{
                    padding: '0.85rem 1rem',
                    borderBottom: idx < resultats.length - 1 ? '1.5px solid var(--outside-cream)' : 'none',
                    background: isAlert ? (pctNum > 0 ? '#FFF8F5' : '#F0FFF8') : 'white',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.matiere}</div>
                      {r.pctEcart && (
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: ecartColor(r.pctEcart), background: isAlert ? (pctNum > 0 ? '#FDEEEC' : '#E0F2EB') : 'var(--outside-cream)', padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
                          {r.pctEcart > 0 ? '+' : ''}{r.pctEcart}%
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                      {[
                        { l: 'Théo.',   v: `${fmt(r.consoTheo)} ${r.unite}`,   c: 'var(--muted)' },
                        { l: 'Réel',    v: `${fmt(r.consoReelle)} ${r.unite}`,  c: 'var(--ink)' },
                        { l: 'Écart',   v: `${ecartSign}${fmt(r.ecart)} ${r.unite}`, c: ecartColor(r.pctEcart) },
                        { l: 'Coût éc.', v: r.coutEcart != null ? `${r.coutEcart > 0 ? '+' : ''}${fmtDT(r.coutEcart)}` : '—', c: ecartColor(r.pctEcart) },
                      ].map(cell => (
                        <div key={cell.l}>
                          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase' }}>{cell.l}</div>
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
