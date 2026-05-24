import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, subWeeks, startOfWeek, endOfWeek, getISOWeek, getISOWeekYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'

// ── CONSTANTES ────────────────────────────────────────────────────────────
const DATE_CHG_TABLE = new Date('2026-03-19') // avant = table 22 = conso perso
const EXCLUS_QTE     = ['EXTRA', 'EAU 1/2', 'EAU 0.5']
const EXCLUS_TICKET  = ['EXTRA', 'EAU 1/2', 'EAU 0.5'] // + famille EXTRA + COOKIESIDE

const today     = new Date()
const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

const PERIODES = [
  { label: 'Ce mois',    from: format(startOfMonth(today), 'yyyy-MM-dd'),              to: format(yesterday, 'yyyy-MM-dd') },
  { label: 'M-1',        from: format(startOfMonth(subMonths(today,1)), 'yyyy-MM-dd'), to: format(endOfMonth(subMonths(today,1)), 'yyyy-MM-dd') },
  { label: 'S en cours', from: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(yesterday, 'yyyy-MM-dd') },
  { label: 'S-1',        from: format(startOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(subWeeks(today,1), { weekStartsOn: 1 }), 'yyyy-MM-dd') },
]

// ── FORMATTERS ────────────────────────────────────────────────────────────
const fmtN  = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)
const fmtDT = n => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' DT'
const fmtD  = (n, d=2) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
const fmtPct = n => (n * 100).toFixed(1) + '%'

// ── NETTOYAGE PRODUIT (reproduit R: str_trim + str_remove + str_squish) ──
function cleanProduit(s) {
  return s.trim()
          .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]+$/, '') // supprime non-alphanum en fin
          .replace(/\s+/g, ' ')                           // squish
          .trim()
}

// ── CALCUL NB_PERSONNE pour un ticket ─────────────────────────────────────
// = somme des lignes où le produit ne fait PAS partie des exclusions
// et la famille n'est pas EXTRA ni COOKIESIDE
function isPersonne(produit, famille) {
  const p = produit.toUpperCase()
  const f = (famille || '').toUpperCase()
  if (EXCLUS_TICKET.includes(p)) return false
  if (f === 'EXTRA' || f === 'COOKIESIDE') return false
  return true
}

// ── CALCUL QTE pour un produit ────────────────────────────────────────────
function calcQte(produit, famille, qte) {
  const p = produit.toUpperCase()
  const f = (famille || '').toUpperCase()
  if (p === 'EXTRA' || f === 'EXTRA') return 0
  if (p.includes('COMBO EXTRA')) return 0
  if (p.includes('COOKIE ')) return qte * 2
  return qte
}

// ── HELPER : agrège les lignes en totaux ─────────────────────────────────
function computeTotals(lines, prodsMap, consoPersoOnly) {
  const enriched = lines.map(l => {
    const dateVente    = new Date(l.date_vente + 'T00:00:00')
    const isConsoPerso = l.numtable === 32 || (l.numtable === 22 && dateVente < DATE_CHG_TABLE)
    if (consoPersoOnly && !isConsoPerso) return null
    if (!consoPersoOnly && isConsoPerso) return null
    const produit    = cleanProduit(l.produit)
    const info       = prodsMap[produit.toUpperCase()] || {}
    const famille    = info.famille || ''
    const heure      = l.heure ? parseInt(l.heure.split(':')[0]) : 12
    const prixU      = parseFloat(l.prix_unitaire || l.total_ttc || 0)
    const qteCalc    = calcQte(produit, famille, l.qte)
    const nbPers     = isPersonne(produit, famille) ? 1 : 0
    return { id_ticket: l.id_ticket_compact, prixU, qteCalc, nbPers, avant: heure < 14 }
  }).filter(Boolean)

  const tMap = {}
  for (const l of enriched) {
    if (!tMap[l.id_ticket]) tMap[l.id_ticket] = { ca: 0, qte: 0, nbPers: 0, ca_avant: 0, ca_apres: 0 }
    const t = tMap[l.id_ticket]
    t.ca += l.prixU; t.qte += l.qteCalc; t.nbPers += l.nbPers
    if (l.avant) t.ca_avant += l.prixU; else t.ca_apres += l.prixU
  }
  const tArr  = Object.values(tMap)
  const ca    = tArr.reduce((s, t) => s + t.ca, 0)
  const qte   = tArr.reduce((s, t) => s + t.qte, 0)
  const nb    = tArr.reduce((s, t) => s + t.nbPers, 0)
  return {
    ca:      parseFloat(ca.toFixed(2)),
    qte,
    nb,
    pm:      nb > 0 ? parseFloat((ca / nb).toFixed(2)) : 0,
    iv:      nb > 0 ? parseFloat((qte / nb).toFixed(2)) : 0,
    prix:    qte > 0 ? parseFloat((ca / qte).toFixed(2)) : 0,
    caAvant: parseFloat(tArr.reduce((s, t) => s + t.ca_avant, 0).toFixed(2)),
    caApres: parseFloat(tArr.reduce((s, t) => s + t.ca_apres, 0).toFixed(2)),
    nbJours: 0,
  }
}

export default function Performance() {
  const [loading, setLoading]     = useState(false)
  const [consoPersoOnly, setConsoPersoOnly] = useState(false)
  const [dateFrom, setDateFrom]   = useState(PERIODES[0].from)
  const [dateTo,   setDateTo]     = useState(PERIODES[0].to)
  const [view, setView]           = useState('jour')     // 'jour' | 'produit' | 'famille'
  const [sortBy, setSortBy]       = useState('ca')
  const [data, setData]           = useState(null)
  const [prev, setPrev]           = useState(null) // totaux mois précédent
  const [activeFamille, setActiveFamille] = useState('all')
  const [expandedFamille, setExpandedFamille] = useState(null)

  async function charger() {
    setLoading(true)
    setData(null)
    setPrev(null)
    setActiveFamille('all')

    // 1. Ventes — toutes tables sauf conso perso
    let lines = [], page = 0
    while (true) {
      const { data: batch } = await supabase
        .from('transaction_line')
        .select('produit, qte, total_ttc, prix_unitaire, id_ticket_compact, numtable, date_vente, heure')
        .gte('date_vente', dateFrom)
        .lte('date_vente', dateTo)
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      lines = lines.concat(batch)
      if (batch.length < 1000) break
      page++
    }

    // 2. Table produits
    const { data: produits } = await supabase.from('produits').select('nom_produit, famille, prix')
    const prodsMap = {}
    for (const p of (produits || [])) prodsMap[p.nom_produit.toUpperCase().trim()] = p

    // 3. Nettoyer + enrichir chaque ligne
    const enriched = lines
      .map(l => {
        const dateVente = new Date(l.date_vente + 'T00:00:00')
        const numtable  = l.numtable

        // Règle conso perso : table 32 toujours ; table 22 avant date_chg_table
        const isConsoPerso = numtable === 32 || (numtable === 22 && dateVente < DATE_CHG_TABLE)
        // Mode conso perso only : garder seulement la conso perso
        // Mode normal : exclure la conso perso
        if (consoPersoOnly && !isConsoPerso) return null
        if (!consoPersoOnly && isConsoPerso) return null

        const produit = cleanProduit(l.produit)
        const info    = prodsMap[produit.toUpperCase()] || {}
        const famille = info.famille || ''
        const heure   = l.heure ? parseInt(l.heure.split(':')[0]) : 12
        const partieJour = heure < 14 ? 'avant' : 'apres'
        const prixU   = parseFloat(l.prix_unitaire || l.total_ttc || 0)
        const qteCalc = calcQte(produit, famille, l.qte)
        const nbPers  = isPersonne(produit, famille) ? 1 : 0

        return {
          id_ticket:   l.id_ticket_compact,
          date_vente:  l.date_vente,
          produit,
          famille,
          prixU,
          qteRaw:      l.qte,
          qteCalc,
          nbPers,
          partieJour,
          cout:        parseFloat(info.cout || 0),
        }
      })
      .filter(Boolean)

    if (!enriched.length) {
      setLoading(false)
      setData({ jours: [], produits: [], familles: [], famillesDisp: [], total: null })
      return
    }

    // ── AGRÉGATION PAR TICKET ─────────────────────────────────────────
    const ticketMap = {}
    for (const l of enriched) {
      if (!ticketMap[l.id_ticket]) ticketMap[l.id_ticket] = {
        id_ticket: l.id_ticket, date_vente: l.date_vente,
        ca: 0, ca_avant: 0, ca_apres: 0, qte: 0, nbPers: 0
      }
      const t = ticketMap[l.id_ticket]
      t.ca     += l.prixU
      t.qte    += l.qteCalc
      t.nbPers += l.nbPers
      if (l.partieJour === 'avant') t.ca_avant += l.prixU
      else t.ca_apres += l.prixU
    }
    const tickets = Object.values(ticketMap)

    // ── AGRÉGATION PAR JOUR ───────────────────────────────────────────
    const jourMap = {}
    for (const t of tickets) {
      const d = t.date_vente
      if (!jourMap[d]) jourMap[d] = { date: d, ca: 0, ca_avant: 0, ca_apres: 0, qte: 0, nb: 0 }
      jourMap[d].ca      += t.ca
      jourMap[d].ca_avant += t.ca_avant
      jourMap[d].ca_apres += t.ca_apres
      jourMap[d].qte     += t.qte
      jourMap[d].nb      += t.nbPers
    }
    const jours = Object.values(jourMap).map(j => {
      const d = new Date(j.date + 'T00:00:00')
      return {
        ...j,
        ca: parseFloat(j.ca.toFixed(2)),
        jour: format(d, 'EEE', { locale: fr }),
        pm:   j.nb > 0 ? parseFloat((j.ca / j.nb).toFixed(2)) : 0,
        iv:   j.nb > 0 ? parseFloat((j.qte / j.nb).toFixed(2)) : 0,
        prix: j.qte > 0 ? parseFloat((j.ca / j.qte).toFixed(2)) : 0,
      }
    }).sort((a, b) => b.date.localeCompare(a.date))

    // ── AGRÉGATION PAR PRODUIT ────────────────────────────────────────
    const prodMap = {}
    for (const l of enriched) {
      const k = l.produit
      if (!prodMap[k]) prodMap[k] = { produit: k, famille: l.famille, ca: 0, qte: 0, tickets: new Set(), nbPers: 0 }
      prodMap[k].ca    += l.prixU
      prodMap[k].qte   += l.qteRaw  // vraie qté vendue pour la vue produit/famille
      prodMap[k].nbPers += l.nbPers
      prodMap[k].tickets.add(l.id_ticket)
    }
    const totalCA = Object.values(prodMap).reduce((s, p) => s + p.ca, 0)
    const prodList = Object.values(prodMap).map(p => ({
      ...p, tickets: p.tickets.size,
      ca: parseFloat(p.ca.toFixed(2)),
      pct: totalCA > 0 ? parseFloat((p.ca / totalCA * 100).toFixed(1)) : 0,
      pm:  p.nbPers > 0 ? parseFloat((p.ca / p.nbPers).toFixed(2)) : 0,
      iv:  p.nbPers > 0 ? parseFloat((p.qte / p.nbPers).toFixed(2)) : 0,
    }))

    // ── AGRÉGATION PAR FAMILLE ────────────────────────────────────────
    const famMap = {}
    for (const p of prodList) {
      const f = p.famille || 'Autre'
      if (!famMap[f]) famMap[f] = { famille: f, ca: 0, qte: 0, nbPers: 0, produits: [], tickets: new Set() }
      famMap[f].ca     += p.ca
      famMap[f].qte    += p.qte
      famMap[f].nbPers += p.nbPers
      famMap[f].produits.push(p)
      for (const t of (prodMap[p.produit]?.tickets || new Set())) famMap[f].tickets.add(t)
    }
    const famList = Object.values(famMap).map(f => ({
      ...f, tickets: f.tickets.size,
      ca: parseFloat(f.ca.toFixed(2)),
      pct: totalCA > 0 ? parseFloat((f.ca / totalCA * 100).toFixed(1)) : 0,
      pm:  f.nbPers > 0 ? parseFloat((f.ca / f.nbPers).toFixed(2)) : 0,
      iv:  f.nbPers > 0 ? parseFloat((f.qte / f.nbPers).toFixed(2)) : 0,
    }))

    // ── TOTAL ─────────────────────────────────────────────────────────
    const totalNb  = tickets.reduce((s, t) => s + t.nbPers, 0)
    const totalQte = tickets.reduce((s, t) => s + t.qte, 0)
    const famillesDisp = ['all', ...Array.from(new Set(prodList.map(p => p.famille))).sort()]

    setData({
      jours, produits: prodList, familles: famList, famillesDisp,
      total: {
        ca:     parseFloat(totalCA.toFixed(2)),
        qte:    totalQte,
        nb:     totalNb,
        pm:     totalNb > 0 ? parseFloat((totalCA / totalNb).toFixed(2)) : 0,
        iv:     totalNb > 0 ? parseFloat((totalQte / totalNb).toFixed(2)) : 0,
        prix:   totalQte > 0 ? parseFloat((totalCA / totalQte).toFixed(2)) : 0,
        caAvant: parseFloat(tickets.reduce((s, t) => s + t.ca_avant, 0).toFixed(2)),
        caApres: parseFloat(tickets.reduce((s, t) => s + t.ca_apres, 0).toFixed(2)),
        nbJours: jours.length,
        caJour:  jours.length > 0 ? parseFloat((totalCA / jours.length).toFixed(2)) : 0,
      }
    })

    // ── PÉRIODE PRÉCÉDENTE — même dates du mois précédent ───────────────
    const fromDate    = new Date(dateFrom + 'T00:00:00')
    const toDate      = new Date(dateTo   + 'T00:00:00')
    const prevFrom    = subMonths(fromDate, 1)
    const prevTo      = subMonths(toDate,   1)
    const prevFromStr = format(prevFrom, 'yyyy-MM-dd')
    const prevToStr   = format(prevTo,   'yyyy-MM-dd')
    const nbDays      = Math.round((toDate - fromDate) / 86400000) + 1

    let prevLines = [], p2 = 0
    while (true) {
      const { data: batch } = await supabase
        .from('transaction_line')
        .select('produit, qte, total_ttc, prix_unitaire, id_ticket_compact, numtable, date_vente, heure')
        .gte('date_vente', prevFromStr).lte('date_vente', prevToStr)
        .range(p2 * 1000, (p2 + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      prevLines = prevLines.concat(batch)
      if (batch.length < 1000) break
      p2++
    }
    const prevTotals = computeTotals(prevLines, prodsMap, consoPersoOnly)
    prevTotals.caJour = nbDays > 0 ? parseFloat((prevTotals.ca / nbDays).toFixed(2)) : 0
    prevTotals.label  = `${format(prevFrom, 'd MMM', { locale: fr })} → ${format(prevTo, 'd MMM', { locale: fr })}`
    setPrev(prevTotals)

    setLoading(false)
  }

  function sorted(list, key = sortBy) {
    return [...list].sort((a, b) => b[key] - a[key])
  }

  const produitsFiltres = data
    ? (activeFamille === 'all' ? data.produits : data.produits.filter(p => p.famille === activeFamille))
    : []

  const maxCA = data
    ? Math.max(...(view === 'produit' ? produitsFiltres : view === 'famille' ? data.familles : data.jours).map(x => x.ca), 1)
    : 1

  function exportCSV() {
    if (!data) return
    const periode = `${format(new Date(dateFrom+'T00:00:00'),"d MMM",{locale:fr})} → ${format(new Date(dateTo+'T00:00:00'),"d MMM yyyy",{locale:fr})}`
    let rows = [], header = []
    if (view === 'jour') {
      header = ['Date','Jour','CA','CA<14h','CA>14h','Tickets','QTE','PM','IV','Prix moy.']
      rows = sorted(data.jours, 'date').map(j => [j.date,j.jour,j.ca,j.ca_avant,j.ca_apres,j.nb,j.qte,j.pm,j.iv,j.prix])
    } else if (view === 'produit') {
      header = ['Produit','Famille','CA','%CA','QTE','Tickets','PM','IV']
      rows = sorted(produitsFiltres).map(p => [p.produit,p.famille,p.ca,p.pct+'%',p.qte,p.tickets,p.pm,p.iv])
    } else {
      header = ['Famille','CA','%CA','QTE','Tickets','PM','IV']
      rows = sorted(data.familles).map(f => [f.famille,f.ca,f.pct+'%',f.qte,f.tickets,f.pm,f.iv])
    }
    const csv = [`Performance ${view} — ${periode}`,'',header.join(';'),...rows.map(r=>r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href=url; a.download=`perf_${view}_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Performance</h1>
        <p className="page-subtitle">Analyse des ventes</p>
      </div>

      <div className="page-content">

        {/* PÉRIODE */}
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            {PERIODES.map(p => (
              <button key={p.label}
                className={`btn btn-sm ${dateFrom===p.from && dateTo===p.to ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}>{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div><label className="form-label">Du</label><input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div><label className="form-label">Au</label><input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
          </div>
          {/* SWITCHER CONSO PERSO */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: '1.5px solid var(--outside-cream)', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Conso perso uniquement</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Table 32 — équipe Outside</div>
            </div>
            <button onClick={() => setConsoPersoOnly(v => !v)}
              style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: consoPersoOnly ? 'var(--outside-orange)' : 'var(--outside-cream2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: consoPersoOnly ? 25 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={charger} disabled={loading}>
            {loading ? <Spinner size={16} /> : '📊 Analyser'}
          </button>
        </div>

        {data && (
          <>
            {/* KPIs avec évolution */}
            {prev && (
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '6px' }}>
                vs {prev.label}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px', marginBottom: '1rem' }}>
              {[
                { label: 'CA total',       value: fmtDT(data.total.ca),              prv: prev?.ca },
                { label: 'CA / jour',      value: fmtDT(data.total.caJour),           prv: prev?.caJour },
                { label: 'Panier moyen',   value: fmtDT(data.total.pm),              prv: prev?.pm },
                { label: 'Indice vente',   value: fmtD(data.total.iv) + ' art./ticket', prv: prev?.iv },
                { label: 'Prix moy. art.', value: fmtDT(data.total.prix),            prv: prev?.prix },
                { label: 'Tickets / jour', value: fmtD(data.total.nb / (data.total.nbJours || 1), 1), prv: prev?.nb != null && data.total.nbJours > 0 ? prev.nb / data.total.nbJours : null },
              ].map(k => {
                const diff  = k.prv > 0 ? ((k.val || parseFloat(k.value)) - k.prv) / k.prv * 100 : null
                const rawCur = k.label === 'CA total' ? data.total.ca
                  : k.label === 'CA / jour' ? data.total.caJour
                  : k.label === 'Panier moyen' ? data.total.pm
                  : k.label === 'Indice vente' ? data.total.iv
                  : k.label === 'Prix moy. art.' ? data.total.prix
                  : data.total.nbJours > 0 ? data.total.nb / data.total.nbJours : 0
                const d     = k.prv != null && k.prv > 0 ? ((rawCur - k.prv) / k.prv * 100) : null
                const isUp  = d > 0
                const color = d == null ? 'var(--muted)' : isUp ? '#1A5C4A' : '#B03A1A'
                return (
                  <div key={k.label} className="card" style={{ padding: '0.75rem' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '3px' }}>{k.label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--outside-dark)' }}>{k.value}</div>
                    {d != null && (
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color, marginTop: '3px' }}>
                        {isUp ? '▲' : '▼'} {Math.abs(d).toFixed(1)}%
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* CA avant/après 14h */}
            <div className="card" style={{ padding: '0.85rem 1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '8px' }}>Répartition avant / après 14h</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { label: 'Avant 14h', ca: data.total.caAvant, color: 'var(--outside-amber)' },
                  { label: 'Après 14h', ca: data.total.caApres, color: 'var(--outside-teal)' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, marginBottom: '3px' }}>{s.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: s.color }}>{fmtDT(s.ca)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{data.total.ca > 0 ? fmtD(s.ca/data.total.ca*100, 1) : '0'}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CONTROLS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '8px', flexWrap: 'wrap' }}>
              <div className="tabs" style={{ flex: 1, minWidth: 200 }}>
                <button className={`tab-btn${view==='jour' ? ' active' : ''}`} onClick={() => setView('jour')}>Jours</button>
                <button className={`tab-btn${view==='produit' ? ' active' : ''}`} onClick={() => setView('produit')}>Produits</button>
                <button className={`tab-btn${view==='famille' ? ' active' : ''}`} onClick={() => setView('famille')}>Familles</button>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {view !== 'jour' && [{k:'ca',l:'CA'},{k:'qte',l:'Qté'},{k:'tickets',l:'Tickets'}].map(s => (
                  <button key={s.k} className={`btn btn-sm ${sortBy===s.k ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSortBy(s.k)}>{s.l}</button>
                ))}
                <button className="btn btn-outline btn-sm" onClick={exportCSV}><Download size={13} /></button>
              </div>
            </div>

            {/* FILTRE FAMILLE */}
            {view === 'produit' && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '1rem', scrollbarWidth: 'none', marginLeft: '-1rem', marginRight: '-1rem', paddingLeft: '1rem', paddingRight: '1rem' }}>
                {(data.famillesDisp||[]).map(f => (
                  <button key={f}
                    className={`btn btn-sm ${activeFamille===f ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setActiveFamille(f)}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {f === 'all' ? 'Tout' : f} <span style={{ opacity: 0.65 }}>({f==='all' ? data.produits.length : data.produits.filter(p=>p.famille===f).length})</span>
                  </button>
                ))}
              </div>
            )}

            {/* VUE JOURS */}
            {view === 'jour' && (
              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Date','CA','Tickets','PM','IV','Prix moy.','<14h','>14h'].map((h, i) => (
                        <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '0.6rem ' + (i === 0 ? '1rem' : '0.75rem'), fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted(data.jours, 'date').map((j, idx, arr) => (
                      <tr key={j.date}>
                        <td style={{ padding: '0.65rem 1rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{format(new Date(j.date+'T00:00:00'),'d MMM',{locale:fr})}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{j.jour}</div>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 800, whiteSpace: 'nowrap' }}>{fmtDT(j.ca)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 700 }}>{fmtN(j.nb)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDT(j.pm)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 700 }}>{fmtD(j.iv)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDT(j.prix)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontSize: '0.78rem', color: 'var(--outside-amber)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDT(j.ca_avant)}</td>
                        <td style={{ padding: '0.65rem 1rem 0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontSize: '0.78rem', color: 'var(--outside-teal)', fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDT(j.ca_apres)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VUE PRODUITS — TABLEAU */}
            {view === 'produit' && (
              <div className="card" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.6rem 1rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>Produit</th>
                      <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>Famille</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>CA</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>%</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>Qté</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 1rem 0.6rem 0.75rem', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', background: 'var(--outside-cream)', borderBottom: '1.5px solid var(--outside-cream2)', whiteSpace: 'nowrap' }}>Prix moy.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted(produitsFiltres).map((p, idx, arr) => (
                      <tr key={p.produit} style={{ background: 'white' }}>
                        <td style={{ padding: '0.65rem 1rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', fontWeight: 700, fontSize: '0.85rem', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.produit}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', fontSize: '0.75rem', color: 'var(--outside-orange)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {p.famille}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                          {fmtDT(p.ca)}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700 }}>
                          {p.pct}%
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700 }}>
                          {fmtN(p.qte)}
                        </td>
                        <td style={{ padding: '0.65rem 1rem 0.65rem 0.75rem', borderBottom: idx < arr.length-1 ? '1.5px solid var(--outside-cream)' : 'none', textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {p.qte > 0 ? fmtDT(p.ca / p.qte) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* VUE FAMILLES */}
            {view === 'famille' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sorted(data.familles).map(f => {
                  const isOpen = expandedFamille === f.famille
                  return (
                    <div key={f.famille} className="card">
                      <div style={{ padding: '0.85rem 1rem', cursor: 'pointer' }} onClick={() => setExpandedFamille(isOpen ? null : f.famille)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{f.famille || 'Autre'}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600, marginTop: '1px' }}>
                              {f.produits.length} produits · {fmtN(f.qte)} qté · Prix moy. {f.qte > 0 ? fmtDT(f.ca / f.qte) : '—'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{fmtDT(f.ca)}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--outside-orange)', fontWeight: 800 }}>{f.pct}%</div>
                            </div>
                            {isOpen ? <ChevronUp size={16} color="var(--muted)" /> : <ChevronDown size={16} color="var(--muted)" />}
                          </div>
                        </div>
                        <div style={{ height: 6, background: 'var(--outside-cream2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${maxCA > 0 ? f.ca/maxCA*100 : 0}%`, background: 'var(--outside-orange)', borderRadius: 3 }} />
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ borderTop: '1.5px solid var(--outside-cream)' }}>
                          {[...f.produits].sort((a,b)=>b.ca-a.ca).map((p,i,arr)=>(
                            <div key={p.produit} style={{ padding: '0.6rem 1rem 0.6rem 1.5rem', borderBottom: i<arr.length-1 ? '1px solid var(--outside-cream)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.produit}</div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>Prix moy. {p.qte > 0 ? fmtDT(p.ca / p.qte) : '—'} · {fmtN(p.qte)} qté</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{fmtDT(p.ca)}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{p.pct}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
