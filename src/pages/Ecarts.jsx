import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download } from 'lucide-react'

const f1  = n => n==null?'—':parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1})
const fDT = n => n==null?'—':parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' DT'
const pct = (a,b) => b===0?null:((a-b)/b*100).toFixed(1)
const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''

function ecartColor(p) {
  if (p==null) return 'var(--muted)'
  const v=parseFloat(p)
  if (v>15)  return '#C0392B'
  if (v>5)   return '#E67E22'
  if (v<-5)  return '#1A5C4A'
  return '#27AE60'
}

const today     = new Date()
const yesterday = new Date(today); yesterday.setDate(today.getDate()-1)

const PERIODES = [
  { label:'Ce mois',  from:format(startOfMonth(today),'yyyy-MM-dd'), to:format(yesterday,'yyyy-MM-dd') },
  { label:'M-1',      from:format(startOfMonth(subMonths(today,1)),'yyyy-MM-dd'), to:format(endOfMonth(subMonths(today,1)),'yyyy-MM-dd') },
  { label:'S en cours',from:format(startOfWeek(today,{weekStartsOn:1}),'yyyy-MM-dd'), to:format(yesterday,'yyyy-MM-dd') },
  { label:'S-1',      from:format(startOfWeek(subWeeks(today,1),{weekStartsOn:1}),'yyyy-MM-dd'), to:format(endOfWeek(subWeeks(today,1),{weekStartsOn:1}),'yyyy-MM-dd') },
]

export default function Ecarts() {
  const [dateFrom, setDateFrom] = useState(PERIODES[0].from)
  const [dateTo,   setDateTo]   = useState(PERIODES[0].to)
  const [loading, setLoading]   = useState(false)
  const [rows, setRows]         = useState([])
  const [loaded, setLoaded]     = useState(false)
  const [sortBy, setSortBy]     = useState('ecart_pct')
  const [dlMenu, setDlMenu]     = useState(false)

  useEffect(()=>{ charger() },[])

  async function charger() {
    setLoading(true)

    const [
      {data:consoData},
      {data:mp},
      {data:invData},
      {data:invAvant},
      {data:receptions},
      {data:pertes},
      {data:stockItems},
      {data:bases},
    ] = await Promise.all([
      supabase.from('v_conso_theorique').select('matiere,qte_theo,cout_theo').gte('date_vente',dateFrom).lte('date_vente',dateTo),
      supabase.from('matiere_premiere').select('matiere,prix,quantite,unite,actif').eq('actif',true),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').gte('date_inventaire',dateFrom).lte('date_inventaire',dateTo).order('date_inventaire',{ascending:true}),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').lt('date_inventaire',dateFrom).order('date_inventaire',{ascending:false}),
      supabase.from('stock_movements').select('item_id,qty,stock_items(name,matiere_ref)').eq('type','reception').gte('created_at',dateFrom).lte('created_at',dateTo),
      supabase.from('stock_pertes').select('item_name,qte,matiere_ref').gte('date_perte',dateFrom).lte('date_perte',dateTo),
      supabase.from('stock_items').select('id,name,matiere_ref'),
      supabase.from('composition_produit').select('nom_produit').eq('type','base'),
    ])

    // Noms des bases à exclure
    const baseNames = new Set((bases||[]).map(b=>norm(b.nom_produit)))

    const mpMap={}
    for (const m of (mp||[])) {
      if (baseNames.has(norm(m.matiere))) continue // exclure les bases
      mpMap[norm(m.matiere)]={prixUnit:m.quantite>0?m.prix/m.quantite:0,unite:m.unite,actif:true,nom:m.matiere}
    }

    const consoTheoMap={}
    for (const row of (consoData||[])) {
      const k=norm(row.matiere)
      consoTheoMap[k]={qte:(consoTheoMap[k]?.qte||0)+parseFloat(row.qte_theo||0),cout:(consoTheoMap[k]?.cout||0)+parseFloat(row.cout_theo||0),nom:row.matiere}
    }

    const recuMap={}
    for (const r of (receptions||[])) {
      const mRef=r.stock_items?.matiere_ref||r.stock_items?.name
      if (mRef) recuMap[norm(mRef)]=(recuMap[norm(mRef)]||0)+parseFloat(r.qty||0)
    }

    const pertesMap={}
    for (const p of (pertes||[])) {
      const mRef=p.matiere_ref||p.item_name
      pertesMap[norm(mRef)]=(pertesMap[norm(mRef)]||0)+parseFloat(p.qte||0)
    }

    const invDebutMap={}
    const seen=new Set()
    for (const i of (invAvant||[])) {
      const k=norm(i.item_name)
      if (!seen.has(k)) { invDebutMap[k]=parseFloat(i.qte_physique||0); seen.add(k) }
    }

    const invFinMap={}
    for (const i of (invData||[])) invFinMap[norm(i.item_name)]=parseFloat(i.qte_physique||0)

    const result=[]
    for (const k of Object.keys(consoTheoMap)) {
      const info=mpMap[k]; if (!info) continue
      const consoTheo=consoTheoMap[k].qte; if (consoTheo===0) continue
      const stockDebut=invDebutMap[k]??null
      const stockFin=invFinMap[k]??null
      const recu=recuMap[k]||0
      const perdus=pertesMap[k]||0
      let consoReelle=null
      if (stockDebut!==null&&stockFin!==null) consoReelle=stockDebut+recu-stockFin-perdus
      else if (stockFin!==null) consoReelle=recu-stockFin-perdus
      const ecart=consoReelle!==null?consoTheo-consoReelle:null
      const ecartPct=consoTheo>0&&consoReelle!==null?pct(consoTheo,consoReelle):null
      const prixUnit=info.prixUnit||0
      const coutTheo=consoTheoMap[k].cout||consoTheo*prixUnit
      const coutEcart=ecart!==null?ecart*prixUnit:null
      result.push({
        matiere:info.nom||consoTheoMap[k].nom||k, unite:info.unite||'', actif:info.actif,
        consoTheo:parseFloat(consoTheo.toFixed(2)), consoReelle:consoReelle!==null?parseFloat(consoReelle.toFixed(2)):null,
        ecart:ecart!==null?parseFloat(ecart.toFixed(2)):null, ecartPct,
        coutTheo:parseFloat(coutTheo.toFixed(3)), coutEcart:coutEcart!==null?parseFloat(coutEcart.toFixed(3)):null,
        prixUnit, hasInventaire:stockFin!==null,
      })
    }

    result.sort((a,b)=>{
      if (sortBy==='nom') return a.matiere.localeCompare(b.matiere)
      if (sortBy==='cout') return (b.coutTheo||0)-(a.coutTheo||0)
      if (!a.hasInventaire&&b.hasInventaire) return 1
      if (a.hasInventaire&&!b.hasInventaire) return -1
      return Math.abs(parseFloat(b.ecartPct||0))-Math.abs(parseFloat(a.ecartPct||0))
    })

    setRows(result)
    setLoading(false); setLoaded(true)
  }

  const totalCoutTheo  = rows.reduce((s,r)=>s+(r.coutTheo||0),0)
  const totalCoutEcart = rows.filter(r=>r.coutEcart).reduce((s,r)=>s+(r.coutEcart||0),0)
  const sansInv        = rows.filter(r=>!r.hasInventaire).length

  function downloadCSV() {
    const header=[['Matière','Unité','Conso théo.','Conso réelle','Écart qté','Écart %','Coût théo.','Coût écart']]
    const data=rows.map(r=>[r.matiere,r.unite,r.consoTheo,r.consoReelle??'',r.ecart??'',r.ecartPct??'',r.coutTheo,r.coutEcart??''])
    const csv=[...header,...data].map(r=>r.map(c=>'"'+String(c)+'"').join(';')).join('\n')
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`ecarts_${dateFrom}_${dateTo}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function downloadPDF() {
    const title=`Écarts — ${dateFrom} → ${dateTo}`
    const rowsHTML=rows.map(r=>{
      const ep=r.ecartPct!=null?parseFloat(r.ecartPct):null
      const col=ecartColor(ep)
      return `<tr>
        <td style="font-weight:700">${r.matiere}</td>
        <td style="text-align:center">${f1(r.consoTheo)} ${r.unite}</td>
        <td style="text-align:center;color:${r.hasInventaire?'#333':'#aaa'}">${r.hasInventaire?f1(r.consoReelle):'—'} ${r.hasInventaire?r.unite:''}</td>
        <td style="text-align:center;font-weight:800;color:${col}">${ep!=null?(ep>0?'+':'')+ep+'%':'—'}</td>
        <td style="text-align:right">${fDT(r.coutTheo)}</td>
        <td style="text-align:right;color:${r.coutEcart>0?'#C0392B':r.coutEcart<0?'#27AE60':'#333'}">${r.coutEcart!=null?fDT(r.coutEcart):'—'}</td>
      </tr>`
    }).join('')

    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-family:Arial,sans-serif;margin:15px;color:#1D3A3A;font-size:11px}
  h2{margin:0 0 4px;font-size:15px}
  .sub{color:#666;font-size:11px;margin-bottom:10px}
  .kpi{display:flex;gap:12px;margin-bottom:12px}
  .kpi div{background:#f5f5f5;border-radius:6px;padding:8px 12px;flex:1}
  .kpi strong{display:block;font-size:14px}
  .kpi span{font-size:10px;color:#666;text-transform:uppercase}
  table{border-collapse:collapse;width:100%}
  th{background:#1D3A3A!important;color:white!important;padding:5px 8px;font-size:10px;text-align:left;font-weight:800}
  td{border-bottom:1px solid #eee;padding:5px 8px;vertical-align:middle}
  tr:nth-child(even) td{background:#fafafa}
  .sans-inv{color:#E67E22;font-size:9px;font-weight:700}
  @media print{@page{size:A4 landscape;margin:8mm}body{margin:0}}
</style></head><body>
<h2>${title}</h2>
<div class="sub">Généré le ${format(new Date(),'d MMMM yyyy',{locale:fr})}</div>
<div class="kpi">
  <div><strong>${rows.length}</strong><span>Matières</span></div>
  <div><strong>${fDT(totalCoutTheo)}</strong><span>Coût théo.</span></div>
  <div><strong style="color:${totalCoutEcart>0?'#C0392B':'#27AE60'}">${fDT(totalCoutEcart)}</strong><span>Coût écart</span></div>
</div>
<table>
<thead><tr><th>Matière</th><th>Conso théo.</th><th>Conso réelle</th><th>Écart %</th><th>Coût théo.</th><th>Coût écart</th></tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
</body></html>`

    const w=window.open('','_blank')
    w.document.write(html); w.document.close(); w.focus()
    setTimeout(()=>w.print(),500)
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Écarts</h1>
        <p className="page-subtitle">Consommation théorique vs réelle</p>
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
              {['ecart_pct','cout','nom'].map(s=>(
                <button key={s} className={`btn btn-sm ${sortBy===s?'btn-primary':'btn-outline'}`} onClick={()=>{setSortBy(s);charger()}}>
                  {s==='ecart_pct'?'% Écart':s==='cout'?'Coût':'Nom'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sansInv>0&&loaded&&(
          <div style={{background:'#FEF3DC',border:'1.5px solid #D4892A',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',fontSize:'0.78rem',color:'#8A5200'}}>
            <strong>ℹ {sansInv} matière{sansInv>1?'s':''} sans inventaire</strong> — faire un inventaire dans Stock pour voir les écarts réels.
          </div>
        )}

        {loading&&<div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div>}

        {loaded&&!loading&&(
          <>
            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
              {[
                {label:'Matières',    value:rows.length,           color:'var(--outside-dark)'},
                {label:'Coût théo.',  value:fDT(totalCoutTheo),    color:'var(--outside-green)'},
                {label:'Coût écart',  value:fDT(totalCoutEcart),   color:totalCoutEcart>0?'var(--danger)':'var(--outside-green)'},
              ].map(k=>(
                <div key={k.label} className="card" style={{padding:'0.75rem'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'0.95rem',color:k.color,fontWeight:400}}>{k.value}</div>
                  <div style={{fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* EXPORT */}
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'0.75rem',position:'relative'}}>
              <button className="btn btn-outline btn-sm" onClick={()=>setDlMenu(v=>!v)}><Download size={13}/> Exporter</button>
              {dlMenu&&(
                <div style={{position:'absolute',top:32,right:0,zIndex:200,background:'var(--outside-dark)',borderRadius:'var(--radius-lg)',padding:6,boxShadow:'var(--shadow-lg)',minWidth:140}}>
                  <button onClick={()=>{downloadPDF();setDlMenu(false)}} style={{width:'100%',padding:'6px 10px',border:'none',background:'transparent',cursor:'pointer',color:'white',textAlign:'left',fontSize:'0.78rem',display:'flex',gap:8}}>📄 PDF</button>
                  <button onClick={()=>{downloadCSV();setDlMenu(false)}} style={{width:'100%',padding:'6px 10px',border:'none',background:'transparent',cursor:'pointer',color:'white',textAlign:'left',fontSize:'0.78rem',display:'flex',gap:8}}>📊 CSV</button>
                </div>
              )}
              {dlMenu&&<div style={{position:'fixed',inset:0,zIndex:100}} onClick={()=>setDlMenu(false)}/>}
            </div>

            {/* LISTE */}
            <div className="card">
              {rows.length===0?(
                <div style={{padding:'2rem',textAlign:'center',color:'var(--muted)'}}>Aucune donnée</div>
              ):rows.map((r,idx)=>{
                const ep=r.ecartPct!=null?parseFloat(r.ecartPct):null
                const col=ecartColor(ep)
                return (
                  <div key={r.matiere} style={{padding:'0.75rem 1rem',borderBottom:idx<rows.length-1?'1px solid var(--outside-cream)':'none'}}>
                    {/* LIGNE 1 — nom + écart % */}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                      <div style={{fontWeight:700,fontSize:'0.88rem',flex:1,paddingRight:8}}>{r.matiere}</div>
                      {ep!=null?(
                        <div style={{fontWeight:800,fontSize:'0.85rem',color:col,background:col+'18',borderRadius:6,padding:'2px 8px',flexShrink:0}}>
                          {ep>0?'+':''}{ep}%
                        </div>
                      ):<span style={{fontSize:'0.75rem',color:'var(--muted)'}}>Sans inv.</span>}
                    </div>
                    {/* LIGNE 2 — théo / réel / coût */}
                    <div style={{display:'flex',gap:12,fontSize:'0.72rem',color:'var(--muted)',flexWrap:'wrap'}}>
                      <span>Théo: <strong style={{color:'var(--outside-dark)'}}>{f1(r.consoTheo)} {r.unite}</strong></span>
                      {r.hasInventaire&&<span>Réel: <strong style={{color:'var(--outside-dark)'}}>{f1(r.consoReelle)} {r.unite}</strong></span>}
                      <span style={{marginLeft:'auto'}}>
                        {fDT(r.coutTheo)}
                        {r.coutEcart!=null&&Math.abs(r.coutEcart)>0.01&&(
                          <span style={{color:r.coutEcart>0?'var(--danger)':'var(--outside-green)',fontWeight:700,marginLeft:4}}>
                            ({r.coutEcart>0?'+':''}{fDT(r.coutEcart)})
                          </span>
                        )}
                      </span>
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
