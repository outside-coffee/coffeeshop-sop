import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, ChevronDown, ChevronUp } from 'lucide-react'

const fN  = (n, d=1) => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})
const fDT = n => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' DT'
const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''

const today = new Date()
const PERIODES = [
  { label:'Ce mois',   from:format(startOfMonth(today),'yyyy-MM-dd'),                               to:format(today,'yyyy-MM-dd') },
  { label:'M-1',       from:format(startOfMonth(subMonths(today,1)),'yyyy-MM-dd'),                  to:format(endOfMonth(subMonths(today,1)),'yyyy-MM-dd') },
  { label:'S en cours',from:format(startOfWeek(today,{weekStartsOn:1}),'yyyy-MM-dd'),               to:format(today,'yyyy-MM-dd') },
  { label:'S-1',       from:format(startOfWeek(subWeeks(today,1),{weekStartsOn:1}),'yyyy-MM-dd'),   to:format(endOfWeek(subWeeks(today,1),{weekStartsOn:1}),'yyyy-MM-dd') },
]

export default function Ecarts() {
  const [dateFrom,    setDateFrom]    = useState(PERIODES[0].from)
  const [dateTo,      setDateTo]      = useState(PERIODES[0].to)
  const [loading,     setLoading]     = useState(false)
  const [rows,        setRows]        = useState([])
  const [loaded,      setLoaded]      = useState(false)
  const [expanded,    setExpanded]    = useState(null)
  const [dlMenu,      setDlMenu]      = useState(false)
  const [sortBy,      setSortBy]      = useState('ecart_abs')
  const [consoDetail, setConsoDetail] = useState({}) // { matiere_norm: [{produit, nb_ventes, grammage, total}] }
  const [loadingDetail, setLoadingDetail] = useState(null) // matiere en cours de chargement

  useEffect(()=>{ charger() },[])

  async function charger() {
    setLoading(true); setExpanded(null)

    const [
      {data:consoData}, {data:mp}, {data:bases},
      {data:invFin}, {data:invAvant},
      {data:receptions}, {data:pertes},
      {data:stockItems}, {data:compoDetail},
    ] = await Promise.all([
      supabase.from('v_conso_theorique').select('matiere,qte_theo,cout_theo').gte('date_vente',dateFrom).lte('date_vente',dateTo),
      supabase.from('matiere_premiere').select('matiere,prix,quantite,unite,actif').eq('actif',true),
      supabase.from('composition_produit').select('nom_produit').eq('type','base'),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').gte('date_inventaire',dateFrom).lte('date_inventaire',dateTo).order('date_inventaire',{ascending:false}),
      supabase.from('stock_inventaires').select('item_name,qte_physique').lt('date_inventaire',dateFrom).order('date_inventaire',{ascending:false}),
      supabase.from('stock_movements').select('item_id,qty,stock_items(name,matiere_ref)').eq('type','reception').gte('created_at',dateFrom).lte('created_at',dateTo),
      supabase.from('stock_pertes').select('item_name,qte,matiere_ref').gte('date_perte',dateFrom).lte('date_perte',dateTo),
      supabase.from('stock_items').select('id,name,matiere_ref'),
      supabase.from('v_conso_theorique').select('matiere,date_vente,qte_theo').gte('date_vente',dateFrom).lte('date_vente',dateTo),
    ])

    const baseNames = new Set((bases||[]).map(b=>norm(b.nom_produit)))
    const mpMap={}, invFinMap={}, invAvantMap={}, recuMap={}, pertesMap={}

    for (const m of (mp||[])) if (!baseNames.has(norm(m.matiere))) mpMap[norm(m.matiere)]={prixUnit:m.quantite>0?m.prix/m.quantite:0,unite:m.unite,nom:m.matiere}
    for (const i of (invFin||[])) { const k=norm(i.item_name); if (!invFinMap[k]) invFinMap[k]=parseFloat(i.qte_physique||0) }
    const seenAvant=new Set()
    for (const i of (invAvant||[])) { const k=norm(i.item_name); if(!seenAvant.has(k)){invAvantMap[k]=parseFloat(i.qte_physique||0);seenAvant.add(k)} }
    for (const r of (receptions||[])) { const mRef=r.stock_items?.matiere_ref||r.stock_items?.name; if(mRef) recuMap[norm(mRef)]=(recuMap[norm(mRef)]||0)+parseFloat(r.qty||0) }
    for (const p of (pertes||[])) { const mRef=p.matiere_ref||p.item_name; pertesMap[norm(mRef)]=(pertesMap[norm(mRef)]||0)+parseFloat(p.qte||0) }

    // Conso théo agrégée par matière + détail par produit
    const consoTheoMap={}, consoByProduit={}
    for (const row of (consoData||[])) {
      const k=norm(row.matiere)
      consoTheoMap[k]={qte:(consoTheoMap[k]?.qte||0)+parseFloat(row.qte_theo||0),cout:(consoTheoMap[k]?.cout||0)+parseFloat(row.cout_theo||0),nom:row.matiere}
    }

    // Détail conso par produit (depuis compoDetail = v_conso_theorique avec date)
    const produitConsoByMatiere={}
    for (const row of (compoDetail||[])) {
      // On n'a pas nom_produit dans v_conso_theorique directement — on l'approxime depuis les compositions
    }

    const result=[]
    for (const k of Object.keys(consoTheoMap)) {
      const info=mpMap[k]; if(!info) continue
      const consoTheo = consoTheoMap[k].qte
      if (consoTheo===0) continue
      const stockDebut = invAvantMap[k]??null
      const stockFin   = invFinMap[k]??null
      const recu       = recuMap[k]||0
      const perdus     = pertesMap[k]||0

      // Stock théorique fin = début + réceptions − conso théo − pertes
      const debut = stockDebut??0
      const stockTheoFin = Math.max(0, debut + recu - consoTheo - perdus)

      // Écart = stock physique − stock théorique fin
      const ecart      = stockFin!==null ? stockFin - stockTheoFin : null
      const ecartPct   = stockTheoFin>0 && ecart!==null ? ((ecart/stockTheoFin)*100).toFixed(1) : null
      const prixUnit   = info.prixUnit||0
      const coutTheo   = consoTheoMap[k].cout||consoTheo*prixUnit
      const coutEcart  = ecart!==null ? ecart*prixUnit : null

      result.push({
        matiere:info.nom||consoTheoMap[k].nom||k, unite:info.unite||'', k,
        stockDebut, recu, consoTheo:parseFloat(consoTheo.toFixed(2)),
        perdus, stockTheoFin:parseFloat(stockTheoFin.toFixed(2)),
        stockFin, ecart:ecart!==null?parseFloat(ecart.toFixed(2)):null,
        ecartPct, coutTheo:parseFloat(coutTheo.toFixed(2)),
        coutEcart:coutEcart!==null?parseFloat(coutEcart.toFixed(2)):null,
        prixUnit, hasInventaire:stockFin!==null,
      })
    }

    result.sort((a,b)=>{
      if (sortBy==='nom') return a.matiere.localeCompare(b.matiere)
      if (sortBy==='cout') return (b.coutTheo||0)-(a.coutTheo||0)
      // ecart_abs: d'abord avec inventaire, trié par écart absolu
      if (!a.hasInventaire&&b.hasInventaire) return 1
      if (a.hasInventaire&&!b.hasInventaire) return -1
      return Math.abs(b.ecart||0)-Math.abs(a.ecart||0)
    })

    setRows(result); setLoading(false); setLoaded(true)
  }

  const totalCoutTheo  = rows.reduce((s,r)=>s+(r.coutTheo||0),0)
  const totalCoutEcart = rows.filter(r=>r.coutEcart!=null).reduce((s,r)=>s+(r.coutEcart||0),0)
  const sansInv        = rows.filter(r=>!r.hasInventaire).length
  const avecInv        = rows.filter(r=>r.hasInventaire).length

  async function loadConsoDetail(r) {
    if (consoDetail[r.k] !== undefined) return // déjà chargé (même vide)
    setLoadingDetail(r.matiere)

    // 1er essai: filtre eq exact
    let { data } = await supabase
      .from('v_conso_detail')
      .select('produit, nb_ventes, grammage_unitaire, qte_conso, matiere')
      .eq('matiere', r.matiere)
      .gte('date_vente', dateFrom)
      .lte('date_vente', dateTo)

    // 2ème essai si vide: charger toutes et filtrer côté JS (cas casse différente)
    if (!data || data.length === 0) {
      const { data: all } = await supabase
        .from('v_conso_detail')
        .select('produit, nb_ventes, grammage_unitaire, qte_conso, matiere')
        .gte('date_vente', dateFrom)
        .lte('date_vente', dateTo)
      const mNorm = norm(r.matiere)
      data = (all||[]).filter(row => norm(row.matiere) === mNorm)
    }

    // Agréger par produit
    const map = {}
    for (const row of (data||[])) {
      const key = row.produit
      if (!map[key]) map[key] = { produit: key, nb_ventes: 0, grammage: parseFloat(row.grammage_unitaire||0), total: 0 }
      map[key].nb_ventes += parseFloat(row.nb_ventes||0)
      map[key].total     += parseFloat(row.qte_conso||0)
    }
    const sorted = Object.values(map).sort((a,b)=>b.total-a.total)
    setConsoDetail(prev => ({ ...prev, [r.k]: sorted }))
    setLoadingDetail(null)
  }

  function ecartColor(r) {
    if (!r.hasInventaire||r.ecart===null) return null
    const p=parseFloat(r.ecartPct||0)
    if (Math.abs(p)<5) return {bg:'#EAF3DE',color:'#3B6D11'}
    if (p>0) return {bg:'#EAF3DE',color:'#3B6D11'}
    return {bg:'#FCEBEB',color:'#A32D2D'}
  }

  function downloadCSV() {
    const header=['Matière','Unité','Stock début','Réceptions','Conso théo.','Pertes','Stock théo. fin','Stock physique','Écart qté','Écart %','Coût théo.','Coût écart']
    const data=rows.map(r=>[r.matiere,r.unite,r.stockDebut??'',r.recu,r.consoTheo,r.perdus,r.stockTheoFin,r.stockFin??'',r.ecart??'',r.ecartPct??'',r.coutTheo,r.coutEcart??''])
    const csv=[header,...data].map(row=>row.map(c=>'"'+String(c)+'"').join(';')).join('\n')
    const a=document.createElement('a')
    a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'}))
    a.download=`ecarts_${dateFrom}_${dateTo}.csv`; a.click()
  }

  function downloadPDF() {
    const rowsHTML = rows.map(r => {
      const col = ecartColor(r)
      const ecartBadge = r.hasInventaire && r.ecartPct!=null
        ? `<span style="background:${col?.bg};color:${col?.color};padding:2px 8px;border-radius:10px;font-weight:500;font-size:11px">${parseFloat(r.ecartPct)>0?'+':''}${r.ecartPct}%</span>`
        : `<span style="color:#888;font-size:11px">Sans inv.</span>`
      return `<tr>
        <td style="font-weight:500;padding:6px 8px">${r.matiere}</td>
        <td style="text-align:center;padding:6px 8px">${r.stockDebut??'—'}</td>
        <td style="text-align:center;padding:6px 8px;color:#0F6E56">+${r.recu}</td>
        <td style="text-align:center;padding:6px 8px;color:#185FA5">−${fN(r.consoTheo,0)}</td>
        <td style="text-align:center;padding:6px 8px;color:#993C1D">−${r.perdus}</td>
        <td style="text-align:center;padding:6px 8px;font-weight:500">${fN(r.stockTheoFin,0)}</td>
        <td style="text-align:center;padding:6px 8px">${r.stockFin??'—'}</td>
        <td style="text-align:center;padding:6px 8px">${ecartBadge}</td>
        <td style="text-align:right;padding:6px 8px">${fDT(r.coutTheo)}</td>
        <td style="text-align:right;padding:6px 8px;color:${r.coutEcart>0?'#3B6D11':r.coutEcart<0?'#A32D2D':'#888'}">${r.coutEcart!=null?fDT(r.coutEcart):'—'}</td>
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
  <div><strong>${rows.length}</strong><span>Matières</span></div>
  <div><strong>${fDT(totalCoutTheo)}</strong><span>Coût théo.</span></div>
  <div><strong style="color:${totalCoutEcart>=0?'#3B6D11':'#A32D2D'}">${fDT(totalCoutEcart)}</strong><span>Coût écart</span></div>
  <div><strong>${avecInv}/${rows.length}</strong><span>Avec inventaire</span></div>
</div>
<table>
<thead><tr>
  <th>Matière</th><th>Début</th><th>+Reçu</th><th>−Conso</th><th>−Pertes</th>
  <th>Théo fin</th><th>Physique</th><th>Écart</th><th>Coût théo.</th><th>Coût écart</th>
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
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'0.6rem'}}>
            {PERIODES.map(p=>(
              <button key={p.label} className={`btn btn-sm ${dateFrom===p.from&&dateTo===p.to?'btn-primary':'btn-outline'}`}
                onClick={()=>{setDateFrom(p.from);setDateTo(p.to)}}>{p.label}</button>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:'0.6rem'}}>
            <input className="form-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{fontSize:'0.82rem'}}/>
            <input className="form-input" type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={{fontSize:'0.82rem'}}/>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <button className="btn btn-primary btn-sm" disabled={loading} onClick={charger}>
              {loading?<Spinner size={14}/>:'↻'} Calculer
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

        {sansInv>0&&loaded&&(
          <div style={{background:'#FEF3DC',border:'1.5px solid #D4892A',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#8A5200'}}>
            <strong>ℹ {sansInv} matière{sansInv>1?'s':''} sans inventaire</strong> — les écarts réels ne sont pas disponibles. Coût théorique affiché uniquement.
          </div>
        )}

        {loading&&<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div>}

        {loaded&&!loading&&(
          <>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
              {[
                {label:'Matières',   value:rows.length,            color:'var(--outside-dark)'},
                {label:'Coût théo.', value:fDT(totalCoutTheo),     color:'var(--outside-green)'},
                {label:'Coût écart', value:fDT(totalCoutEcart),    color:totalCoutEcart<0?'var(--danger)':totalCoutEcart>0?'var(--outside-green)':'var(--muted)'},
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
                    <div style={{padding:'0.75rem 1rem',cursor:'pointer'}} onClick={()=>setExpanded(isOpen?null:r.matiere)}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <div style={{fontWeight:700,fontSize:'0.88rem',flex:1,paddingRight:8}}>{r.matiere}</div>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          {r.hasInventaire&&r.ecartPct!=null?(
                            <div style={{fontWeight:700,fontSize:'0.82rem',color:col?.color,background:col?.bg,borderRadius:6,padding:'2px 8px'}}>
                              {parseFloat(r.ecartPct)>0?'+':''}{r.ecartPct}%
                            </div>
                          ):<span style={{fontSize:'0.72rem',color:'var(--muted)'}}>Sans inv.</span>}
                          {isOpen?<ChevronUp size={14} style={{color:'var(--muted)',flexShrink:0}}/>:<ChevronDown size={14} style={{color:'var(--muted)',flexShrink:0}}/>}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:12,fontSize:'0.72rem',color:'var(--muted)',flexWrap:'wrap'}}>
                        <span>Conso théo: <strong style={{color:'var(--outside-dark)'}}>{fN(r.consoTheo,0)} {r.unite}</strong></span>
                        {r.hasInventaire&&<span>Écart: <strong style={{color:col?.color}}>{r.ecart>0?'+':''}{fN(r.ecart,0)} {r.unite}</strong></span>}
                        <span style={{marginLeft:'auto'}}>{fDT(r.coutTheo)}{r.coutEcart!=null&&Math.abs(r.coutEcart)>0.01&&<span style={{color:r.coutEcart>0?'var(--outside-green)':'var(--danger)',fontWeight:700,marginLeft:4}}>({r.coutEcart>0?'+':''}{fDT(r.coutEcart)})</span>}</span>
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
                          {r.hasInventaire&&r.ecart!=null&&<div style={{borderTop:'1px solid var(--outside-cream2)',paddingTop:5,display:'flex',justifyContent:'space-between'}}>
                            <span style={{fontWeight:700,color:col?.color}}>Écart</span>
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
