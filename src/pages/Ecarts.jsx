import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'

const fN  = (n, d=1) => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})
const fDT = n => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' DT'
const toNumber = value => value == null ? null : parseFloat(value)

export default function Ecarts() {
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [requestedFrom, setRequestedFrom] = useState('')
  const [requestedTo,   setRequestedTo]   = useState('')
  const [inventoryDates, setInventoryDates] = useState([])
  const [periods,     setPeriods]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [rows,        setRows]        = useState([])
  const [loaded,      setLoaded]      = useState(false)
  const [expanded,    setExpanded]    = useState(null)
  const [dlMenu,      setDlMenu]      = useState(false)
  const [sortBy,      setSortBy]      = useState('ecart_abs')
  const [error,       setError]       = useState('')
  const [intervalle,  setIntervalle]  = useState(null)
  const [consoDetail, setConsoDetail] = useState({}) // { matiere_norm: [{produit, nb_ventes, grammage, total}] }
  const [loadingDetail, setLoadingDetail] = useState(null) // matiere en cours de chargement

  useEffect(()=>{ loadPeriods() },[])

  async function loadPeriods() {
    setLoading(true); setError('')
    const { data, error: datesError } = await supabase
      .from('stock_inventaires')
      .select('date_inventaire')
      .order('date_inventaire', { ascending: false })
    if (datesError) {
      setError(datesError.message); setLoading(false); return
    }
    const dates = [...new Set((data || []).map(row => row.date_inventaire))]
    setInventoryDates(dates)
    const available = dates.slice(0, 7).map((to, index) => ({
      from: dates[index + 1], to,
      label: index === 0 ? 'Dernier inventaire' : `${dates[index + 1]} → ${to}`,
    })).filter(period => period.from)
    setPeriods(available)
    if (available[0]) {
      setRequestedFrom(available[0].from); setRequestedTo(available[0].to)
      await charger(available[0].from, available[0].to, { from: available[0].from, to: available[0].to })
    }
    else { setError('Deux inventaires distincts sont nécessaires pour calculer les écarts.'); setLoading(false) }
  }

  async function charger(from = dateFrom, to = dateTo, requested = { from, to }) {
    setLoading(true); setLoaded(false); setError(''); setIntervalle(null)
    setExpanded(null); setConsoDetail({})

    try {
      if (!from || !to || from >= to) throw new Error('Sélectionnez un intervalle entre deux inventaires.')
      setDateFrom(from); setDateTo(to); setIntervalle({ from, to, requestedFrom: requested.from, requestedTo: requested.to })
      const { data, error: varianceError } = await supabase.rpc('get_consumption_variance', { p_from: from, p_to: to })
      if (varianceError) throw varianceError
      const result = (data || []).map(row => ({
        matiere: row.matiere, unite: row.unite || '', k: row.material_key,
        stockDebut: toNumber(row.stock_debut), recu: toNumber(row.receptions) || 0,
        perdus: toNumber(row.pertes_declarees) || 0, stockFin: toNumber(row.stock_fin),
        consoTheo: toNumber(row.conso_theorique) || 0, consoReelle: toNumber(row.conso_reelle),
        stockTheoFin: toNumber(row.stock_theorique_fin), ecart: toNumber(row.ecart),
        ecartPct: toNumber(row.ecart_pct), coutTheo: toNumber(row.cout_theorique) || 0,
        coutEcart: toNumber(row.cout_ecart), prixUnit: toNumber(row.prix_unitaire) || 0,
        hasInventaire: row.has_inventaire, diagnostic: row.diagnostic,
      }))

      result.sort((a,b)=>{
      if (sortBy==='nom') return a.matiere.localeCompare(b.matiere)
      if (sortBy==='cout') return (b.coutTheo||0)-(a.coutTheo||0)
      // ecart_abs: d'abord avec inventaire, trié par écart absolu
      if (!a.hasInventaire&&b.hasInventaire) return 1
      if (a.hasInventaire&&!b.hasInventaire) return -1
      return Math.abs(b.ecart||0)-Math.abs(a.ecart||0)
      })
      setRows(result); setLoaded(true)
    } catch (e) {
      setRows([])
      setError(e?.message || 'Impossible de calculer les écarts.')
    } finally {
      setLoading(false)
    }
  }

  async function calculerPeriode(from = requestedFrom, to = requestedTo) {
    setError('')
    if (!from || !to || from > to) {
      setError('Sélectionnez une période valide.')
      return
    }

    const opening = inventoryDates.find(date => date <= from)
    const closing = inventoryDates.find(date => date <= to && date > opening)
    if (!opening) {
      setError(`Aucun inventaire disponible avant le ${from}.`)
      return
    }
    if (!closing) {
      setError(`Aucun inventaire de clôture disponible entre le ${from} et le ${to}. Le calcul sera possible après le prochain inventaire.`)
      return
    }

    setRequestedFrom(from); setRequestedTo(to)
    await charger(opening, closing, { from, to })
  }

  function appliquerRaccourci(type) {
    const today = new Date()
    const reference = type === 'previous' ? subMonths(today, 1) : today
    const from = format(startOfMonth(reference), 'yyyy-MM-dd')
    const to = format(type === 'previous' ? endOfMonth(reference) : today, 'yyyy-MM-dd')
    setRequestedFrom(from); setRequestedTo(to)
    calculerPeriode(from, to)
  }

  const totalCoutTheo  = rows.reduce((s,r)=>s+(r.coutTheo||0),0)
  const totalPertes    = rows.reduce((s,r)=>s+Math.max(r.coutEcart||0,0),0)
  const totalAnomalies = rows.reduce((s,r)=>s+Math.abs(Math.min(r.coutEcart||0,0)),0)
  const sansInv        = rows.filter(r=>!r.hasInventaire).length
  const avecInv        = rows.filter(r=>r.hasInventaire).length
  const couverture     = rows.length ? Math.round(avecInv / rows.length * 100) : 0
  const consoSansRecette = rows.filter(r=>r.diagnostic==='conso_sans_recette').length

  async function loadConsoDetail(r) {
    if (consoDetail[r.k] !== undefined || !intervalle) return // déjà chargé (même vide)
    setLoadingDetail(r.matiere)

    const { data, error: detailError } = await supabase.rpc('get_consumption_variance_detail', {
      p_from: intervalle.from, p_to: intervalle.to, p_matiere: r.matiere,
    })
    if (detailError) {
      setError(detailError.message); setLoadingDetail(null); return
    }
    const sorted = (data || []).map(row => ({
      produit: row.produit, nb_ventes: toNumber(row.nb_ventes) || 0,
      grammage: toNumber(row.grammage_unitaire) || 0, total: toNumber(row.qte_conso) || 0,
    }))
    setConsoDetail(prev => ({ ...prev, [r.k]: sorted }))
    setLoadingDetail(null)
  }

  function ecartColor(r) {
    if (!r.hasInventaire||r.ecart===null) return null
    if (r.diagnostic==='conso_sans_recette') return {bg:'#F3E8FF',color:'#6B21A8'}
    const p=parseFloat(r.ecartPct||0)
    if (Math.abs(p)<5) return {bg:'#EAF3DE',color:'#3B6D11'}
    if (p>0) return {bg:'#FCEBEB',color:'#A32D2D'}
    return {bg:'#FEF3DC',color:'#8A5200'}
  }

  function downloadCSV() {
    const header=['Matière','Diagnostic','Unité','Stock début','Réceptions','Pertes','Stock fin','Conso théo.','Conso réelle nette','Écart','Écart %','Coût théo.','Coût écart']
    const data=rows.map(r=>[r.matiere,r.diagnostic,r.unite,r.stockDebut??'',r.recu,r.perdus,r.stockFin??'',r.consoTheo,r.consoReelle??'',r.ecart??'',r.ecartPct??'',r.coutTheo,r.coutEcart??''])
    const csv=[header,...data].map(row=>row.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(';')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}))
    a.download=`ecarts_${dateFrom}_${dateTo}.csv`; a.click()
  }

  function downloadPDF() {
    const rowsHTML = rows.map(r => {
      const col = ecartColor(r)
      const ecartBadge = r.diagnostic === 'conso_sans_recette'
        ? `<span style="background:#F3E8FF;color:#6B21A8;padding:2px 8px;border-radius:10px;font-weight:500;font-size:11px">Sans recette</span>`
        : r.hasInventaire && r.ecartPct!=null
          ? `<span style="background:${col?.bg};color:${col?.color};padding:2px 8px;border-radius:10px;font-weight:500;font-size:11px">${parseFloat(r.ecartPct)>0?'+':''}${r.ecartPct}%</span>`
          : `<span style="color:#888;font-size:11px">Sans inv.</span>`
      return `<tr>
        <td style="font-weight:500;padding:6px 8px">${r.matiere}</td>
        <td style="text-align:center;padding:6px 8px">${r.stockDebut??'—'}</td>
        <td style="text-align:center;padding:6px 8px;color:#0F6E56">+${r.recu}</td>
        <td style="text-align:center;padding:6px 8px">${r.stockFin??'—'}</td>
        <td style="text-align:center;padding:6px 8px;color:#185FA5">${fN(r.consoTheo,0)}</td>
        <td style="text-align:center;padding:6px 8px;font-weight:500">${fN(r.consoReelle,0)}</td>
        <td style="text-align:center;padding:6px 8px">${ecartBadge}</td>
        <td style="text-align:right;padding:6px 8px">${fDT(r.coutTheo)}</td>
        <td style="text-align:right;padding:6px 8px;color:${r.coutEcart>0?'#A32D2D':r.coutEcart<0?'#8A5200':'#888'}">${r.coutEcart!=null?fDT(r.coutEcart):'—'}</td>
      </tr>`
    }).join('')

    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Écarts ${dateFrom} → ${dateTo}</title>
<style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:Arial,sans-serif;margin:15px;color:#1D3A3A;font-size:11px}
h2{margin:0 0 4px;font-size:15px}
.sub{color:#666;margin-bottom:12px}
.kpi{display:flex;gap:12px;margin-bottom:12px}
.kpi div{background:#f5f5f5;border-radius:6px;padding:8px 12px;flex:1}
.kpi strong{display:block;font-size:14px}
.kpi span{font-size:10px;color:#666;text-transform:uppercase}
table{border-collapse:collapse;width:100%;font-size:10px}
th{background:#1D3A3A!important;color:white!important;padding:5px 8px;text-align:left;font-weight:500}
td{border-bottom:1px solid #eee;vertical-align:middle}
tr:nth-child(even) td{background:#fafafa}
@media print{@page{size:A4 landscape;margin:8mm}body{margin:0}}
</style></head><body>
<h2>Écarts stock — ${dateFrom} → ${dateTo}</h2>
<div class="sub">Généré le ${format(new Date(),'d MMMM yyyy',{locale:fr})}</div>
<div class="kpi">
  <div><strong>${fDT(totalCoutTheo)}</strong><span>Coût théorique</span></div>
  <div><strong style="color:#A32D2D">${fDT(totalPertes)}</strong><span>Surconsommation</span></div>
  <div><strong style="color:#8A5200">${fDT(totalAnomalies)}</strong><span>Sous-conso. à vérifier</span></div>
  <div><strong>${couverture}%</strong><span>Couverture inventaire</span></div>
</div>
<table>
<thead><tr>
  <th>Matière</th><th>Début</th><th>+Reçu</th><th>Fin</th><th>Conso théo.</th>
  <th>Conso réelle</th><th>Écart</th><th>Coût théo.</th><th>Coût écart</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
</body></html>`

    const w=window.open('','_blank')
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(()=>w.print(),600)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Écarts stock</h1>
        <p className="page-subtitle">Consommation théorique vs inventaire réel</p>
      </div>
      <div className="page-content">

        {/* FILTRES */}
        <div className="card" style={{padding:'0.75rem 1rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'0.68rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>Période à analyser</div>
          <div style={{display:'flex',gap:6,alignItems:'flex-end',flexWrap:'wrap',marginBottom:'0.75rem'}}>
            <label style={{fontSize:'0.68rem',color:'var(--muted)'}}>
              Du
              <input type="date" value={requestedFrom} onChange={e=>setRequestedFrom(e.target.value)}
                style={{display:'block',marginTop:3,padding:'0.4rem',border:'1px solid var(--outside-cream2)',borderRadius:6}} />
            </label>
            <label style={{fontSize:'0.68rem',color:'var(--muted)'}}>
              Au
              <input type="date" value={requestedTo} onChange={e=>setRequestedTo(e.target.value)}
                style={{display:'block',marginTop:3,padding:'0.4rem',border:'1px solid var(--outside-cream2)',borderRadius:6}} />
            </label>
            <button className="btn btn-primary btn-sm" disabled={loading||!requestedFrom||!requestedTo} onClick={()=>calculerPeriode()}>
              {loading?<Spinner size={14}/>:null} Calculer
            </button>
            <button className="btn btn-outline btn-sm" disabled={loading} onClick={()=>appliquerRaccourci('current')}>Ce mois</button>
            <button className="btn btn-outline btn-sm" disabled={loading} onClick={()=>appliquerRaccourci('previous')}>M-1</button>
          </div>
          <div style={{fontSize:'0.68rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginBottom:6}}>Intervalles récents disponibles</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'0.6rem'}}>
            {periods.map(p=>(
              <button key={p.label} className={`btn btn-sm ${dateFrom===p.from&&dateTo===p.to?'btn-primary':'btn-outline'}`}
                disabled={loading} onClick={()=>{setRequestedFrom(p.from);setRequestedTo(p.to);charger(p.from,p.to,{from:p.from,to:p.to})}}>{p.label}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <button className="btn btn-outline btn-sm" disabled={loading||!requestedFrom||!requestedTo} onClick={()=>calculerPeriode()}>
              {loading?<Spinner size={14}/>:'↻'} Actualiser
            </button>
            <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
              {[['ecart_abs','Écart'],['cout','Coût'],['nom','Nom']].map(([s,l])=>(
                <button key={s} className={`btn btn-sm ${sortBy===s?'btn-primary':'btn-outline'}`} onClick={()=>{setSortBy(s);setRows(r=>[...r].sort((a,b)=>{if(s==='nom')return a.matiere.localeCompare(b.matiere);if(s==='cout')return(b.coutTheo||0)-(a.coutTheo||0);if(!a.hasInventaire&&b.hasInventaire)return 1;if(a.hasInventaire&&!b.hasInventaire)return -1;return Math.abs(b.ecart||0)-Math.abs(a.ecart||0)}))}}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error&&(
          <div style={{background:'#FCEBEB',border:'1.5px solid #A32D2D',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#A32D2D'}}>
            <strong>Calcul impossible.</strong> {error}
          </div>
        )}

        {intervalle&&loaded&&(
          <div style={{background:'#E6F1FB',border:'1.5px solid #378ADD',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#185FA5'}}>
            Période demandée : <strong>{intervalle.requestedFrom} → {intervalle.requestedTo}</strong><br/>
            Inventaires utilisés pour le calcul : <strong>{intervalle.from} → {intervalle.to}</strong>.
          </div>
        )}

        {sansInv>0&&loaded&&(
          <div style={{background:'#FEF3DC',border:'1.5px solid #D4892A',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#8A5200'}}>
            <strong>ℹ {sansInv} matière{sansInv>1?'s':''} sans inventaire</strong> — les écarts réels ne sont pas disponibles. Coût théorique affiché uniquement.
          </div>
        )}

        {consoSansRecette>0&&loaded&&(
          <div style={{background:'#F3E8FF',border:'1.5px solid #9333EA',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#6B21A8'}}>
            <strong>{consoSansRecette} matière{consoSansRecette>1?'s':''} consommée{consoSansRecette>1?'s':''} sans consommation théorique</strong> — vérifier les recettes, unités ou saisies d'inventaire.
          </div>
        )}

        {loading&&<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div>}

        {loaded&&!loading&&(
          <>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:'1rem'}}>
              {[
                {label:'Coût théorique', value:fDT(totalCoutTheo), color:'var(--outside-dark)'},
                {label:'Surconsommation', value:fDT(totalPertes), color:'var(--danger)'},
                {label:'Sous-conso. à vérifier', value:fDT(totalAnomalies), color:'var(--outside-amber)'},
                {label:'Couverture inventaire', value:`${couverture}%`, color:couverture===100?'var(--outside-green)':'var(--outside-amber)'},
              ].map(k=>(
                <div key={k.label} className="card" style={{padding:'0.75rem'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'0.9rem',color:k.color,fontWeight:400}}>{k.value}</div>
                  <div style={{fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* EXPORT */}
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem',position:'relative'}}>
              <button className="btn btn-outline btn-sm" onClick={()=>setDlMenu(v=>!v)}><Download size={13}/> Exporter</button>
              {dlMenu&&(
                <>
                  <div style={{position:'absolute',top:32,right:0,zIndex:300,background:'var(--outside-dark)',borderRadius:'var(--radius-lg)',padding:6,boxShadow:'var(--shadow-lg)',minWidth:140}}>
                    <button onClick={()=>{downloadPDF();setDlMenu(false)}} style={{width:'100%',padding:'6px 10px',border:'none',background:'transparent',cursor:'pointer',color:'white',textAlign:'left',fontSize:'0.78rem'}}>📄 PDF impression</button>
                    <button onClick={()=>{downloadCSV();setDlMenu(false)}} style={{width:'100%',padding:'6px 10px',border:'none',background:'transparent',cursor:'pointer',color:'white',textAlign:'left',fontSize:'0.78rem'}}>📊 CSV (Excel)</button>
                  </div>
                  <div style={{position:'fixed',inset:0,zIndex:200}} onClick={()=>setDlMenu(false)}/>
                </>
              )}
            </div>

            {/* LISTE */}
            <div className="card">
              {rows.length===0?(
                <div style={{padding:'2rem',textAlign:'center',color:'var(--muted)'}}>Aucune donnée</div>
              ):rows.map((r,idx)=>{
                const col = ecartColor(r)
                const isOpen = expanded === r.matiere
                return (
                  <div key={r.matiere} style={{borderBottom:idx<rows.length-1?'1px solid var(--outside-cream)':'none'}}>
                    {/* LIGNE PRINCIPALE */}
                    <div style={{padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>{ const next=isOpen?null:r.matiere; setExpanded(next); if(next) loadConsoDetail(r) }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <div style={{fontWeight:700,fontSize:'0.88rem',flex:1,paddingRight:8}}>{r.matiere}</div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {r.diagnostic==='conso_sans_recette'?(
                            <div style={{fontWeight:700,fontSize:'0.72rem',color:col?.color,background:col?.bg,borderRadius:6,padding:'2px 8px'}}>Sans recette</div>
                          ):r.hasInventaire&&r.ecartPct!=null?(
                            <div style={{fontWeight:700,fontSize:'0.82rem',color:col?.color,background:col?.bg,borderRadius:6,padding:'2px 8px'}}>
                              {parseFloat(r.ecartPct)>0?'+':''}{r.ecartPct}%
                            </div>
                          ):<span style={{fontSize:'0.72rem',color:'var(--muted)'}}>Sans inv.</span>}
                          {isOpen?<ChevronUp size={14} style={{color:'var(--muted)',flexShrink:0}}/>:<ChevronDown size={14} style={{color:'var(--muted)',flexShrink:0}}/>}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:12,fontSize:'0.72rem',color:'var(--muted)',flexWrap:'wrap'}}>
                        <span>Théo: <strong style={{color:'var(--outside-dark)'}}>{fN(r.consoTheo,0)} {r.unite}</strong></span>
                        {r.hasInventaire&&<span>Réelle: <strong style={{color:'var(--outside-dark)'}}>{fN(r.consoReelle,0)} {r.unite}</strong></span>}
                        {r.hasInventaire&&<span>Écart conso: <strong style={{color:col?.color}}>{r.ecart>0?'+':''}{fN(r.ecart,0)} {r.unite}</strong></span>}
                        <span style={{marginLeft:'auto'}}>{fDT(r.coutTheo)}{r.coutEcart!=null&&Math.abs(r.coutEcart)>0.01&&<span style={{color:r.coutEcart>0?'var(--danger)':'var(--outside-amber)',fontWeight:700,marginLeft:4}}>({r.coutEcart>0?'+':''}{fDT(r.coutEcart)})</span>}</span>
                      </div>
                    </div>

                    {/* DÉTAIL (en cliquant) */}
                    {isOpen&&(
                      <div style={{borderTop:'1px solid var(--outside-cream)',background:'var(--outside-cream)',padding:'0.75rem 1rem'}}>
                        {/* CALCUL STOCK */}
                        <div style={{fontSize:'0.62rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginBottom:8,letterSpacing:'0.04em'}}>Calcul stock</div>
                        <div style={{display:'flex',flexDirection:'column',gap:5,fontSize:'0.78rem',marginBottom:'0.75rem'}}>
                          <div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{color:'var(--muted)'}}>Stock début</span>
                            <span style={{fontWeight:700}}>{r.stockDebut!=null?fN(r.stockDebut,0)+' '+r.unite:'non connu'}</span>
                          </div>
                          {r.recu>0&&<div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{color:'#0F6E56'}}>+ Réceptions</span>
                            <span style={{fontWeight:700,color:'#0F6E56'}}>+{fN(r.recu,0)} {r.unite}</span>
                          </div>}
                          <div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{color:'#185FA5'}}>− Conso théorique</span>
                            <span style={{fontWeight:700,color:'#185FA5'}}>−{fN(r.consoTheo,0)} {r.unite}</span>
                          </div>
                          {r.perdus>0&&<div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{color:'#993C1D'}}>− Pertes déclarées</span>
                            <span style={{fontWeight:700,color:'#993C1D'}}>−{fN(r.perdus,0)} {r.unite}</span>
                          </div>}
                          <div style={{borderTop:'1px solid var(--outside-cream2)',paddingTop:5,display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontWeight:700}}>= Stock théorique fin</span>
                            <span style={{fontWeight:700}}>{fN(r.stockTheoFin,0)} {r.unite}</span>
                          </div>
                          {r.hasInventaire&&<div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{color:'var(--muted)'}}>Stock physique saisi</span>
                            <span style={{fontWeight:700}}>{fN(r.stockFin,0)} {r.unite}</span>
                          </div>}
                          {r.hasInventaire&&<div style={{display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontWeight:700}}>Consommation réelle nette</span>
                            <span style={{fontWeight:700}}>{fN(r.consoReelle,0)} {r.unite}</span>
                          </div>}
                          {r.hasInventaire&&r.ecart!=null&&<div style={{borderTop:'1px solid var(--outside-cream2)',paddingTop:5,display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontWeight:700,color:col?.color}}>Écart de consommation</span>
                            <span style={{fontWeight:700,color:col?.color}}>{r.ecart>0?'+':''}{fN(r.ecart,0)} {r.unite} · {r.ecart>0?'+':''}{fDT(r.coutEcart)}</span>
                          </div>}
                          {!r.hasInventaire&&<div style={{padding:'6px 10px',background:'#FEF3DC',borderRadius:'var(--radius-sm)',fontSize:'0.72rem',color:'#8A5200',marginTop:4}}>
                            Faire un inventaire dans Stock pour voir l'écart réel
                          </div>}
                        </div>

                        {/* CONSO PAR PRODUIT */}
                        <div style={{marginTop:'0.75rem'}}>
                          <div style={{fontSize:'0.62rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginBottom:8,letterSpacing:'0.04em'}}>Conso théo. par produit</div>
                          {loadingDetail===r.matiere ? <div style={{display:'flex',justifyContent:'center',padding:'0.5rem'}}><Spinner size={16}/></div> : (
                            consoDetail[r.k]?.length > 0 ? (
                              <>
                                {/* HEADER */}
                                <div style={{display:'grid',gridTemplateColumns:'1fr 40px 50px 60px',gap:4,fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginBottom:4,padding:'0 2px'}}>
                                  <div>Produit</div>
                                  <div style={{textAlign:'center'}}>Ventes</div>
                                  <div style={{textAlign:'center'}}>/unité</div>
                                  <div style={{textAlign:'right'}}>Total</div>
                                </div>
                                {consoDetail[r.k].slice(0,8).map((d,i)=>(
                                  <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 40px 50px 60px',gap:4,fontSize:'0.78rem',padding:'4px 2px',borderBottom:i<Math.min(7,consoDetail[r.k].length-1)?'1px solid var(--outside-cream2)':'none',alignItems:'center'}}>
                                    <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'0.75rem'}}>{d.produit}</div>
                                    <div style={{textAlign:'center',fontWeight:700,color:'var(--muted)',fontSize:'0.75rem'}}>{Math.round(d.nb_ventes)}</div>
                                    <div style={{textAlign:'center',fontSize:'0.7rem',color:'#185FA5'}}>×{fN(d.grammage,0)}{r.unite}</div>
                                    <div style={{textAlign:'right',fontWeight:700,fontSize:'0.75rem'}}>{fN(d.total,0)} {r.unite}</div>
                                  </div>
                                ))}
                                {consoDetail[r.k].length > 8 && (
                                  <div style={{fontSize:'0.72rem',color:'var(--muted)',padding:'4px 2px',fontStyle:'italic'}}>+ {consoDetail[r.k].length-8} autres produits</div>
                                )}
                                {/* TOTAL */}
                                <div style={{borderTop:'1.5px solid var(--outside-cream2)',marginTop:4,paddingTop:4,display:'flex',justifyContent:'space-between',fontSize:'0.78rem',fontWeight:800}}>
                                  <span>Total</span>
                                  <span style={{color:'#185FA5'}}>{fN(r.consoTheo,0)} {r.unite}</span>
                                </div>
                              </>
                            ) : <div style={{fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>Aucune donnée disponible</div>
                          )}
                        </div>
                      </div>
                    )}
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
