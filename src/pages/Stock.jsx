import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { Plus, Save, TrendingDown, ShoppingCart, Download } from 'lucide-react'
import { format, startOfWeek, getWeek, getYear, subWeeks, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

const MOTIFS = [
  { value: 'casse',       label: 'Cassé',         color: '#E74C3C' },
  { value: 'perime',      label: 'Périmé',         color: '#E67E22' },
  { value: 'conso_staff', label: 'Conso. staff',   color: '#3D5A8A' },
  { value: 'erreur',      label: 'Erreur saisie',  color: '#8B6B8A' },
  { value: 'autre',       label: 'Autre',          color: '#7F8C8D' },
]

function periodeHebdo(d = new Date()) {
  return `${getYear(d)}-W${String(getWeek(d,{weekStartsOn:1})).padStart(2,'0')}`
}
function periodeMensuel(d = new Date()) { return format(d,'yyyy-MM') }
const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''

export default function Stock() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [tab, setTab] = useState('dashboard')
  return (
    <>
      <div className="page-header"><h1 className="page-title">Stock</h1></div>
      <div className="page-content">
        <div className="tabs" style={{marginBottom:'1.25rem'}}>
          <button className={`tab-btn${tab==='dashboard' ?' active':''}`} onClick={()=>setTab('dashboard')}>Vue d'ensemble</button>
          <button className={`tab-btn${tab==='mouvements'?' active':''}`} onClick={()=>setTab('mouvements')}>Mouvements</button>
          <button className={`tab-btn${tab==='inventaire'?' active':''}`} onClick={()=>setTab('inventaire')}>Inventaire</button>
        </div>
        {tab==='dashboard'  && <TabDashboard />}
        {tab==='mouvements' && <TabMouvements isManager={isManager} profile={profile} />}
        {tab==='inventaire' && <TabInventaire isManager={isManager} profile={profile} />}
      </div>
    </>
  )
}

// ── VUE D'ENSEMBLE ────────────────────────────────────────────────────────
function TabDashboard() {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  const [lastInv, setLastInv] = useState(null)

  useEffect(()=>{ load() },[])

  async function load() {
    const [{ data: si }, { data: mp }, { data: mpAll }, { data: pertes }, { data: invLast }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('matiere_premiere').select('matiere,prix,quantite').eq('actif',true).order('matiere'),
      supabase.from('matiere_premiere').select('matiere,actif'),
      supabase.from('stock_pertes').select('item_name,qte').gte('date_perte', format(startOfMonth(new Date()),'yyyy-MM-dd')),
      supabase.from('stock_inventaires').select('date_inventaire').order('date_inventaire',{ascending:false}).limit(1),
    ])
    const mpMap={}
    for (const m of (mp||[])) mpMap[norm(m.matiere)] = m.quantite>0 ? m.prix/m.quantite : 0
    const pertesMap={}
    for (const p of (pertes||[])) pertesMap[p.item_name]=(pertesMap[p.item_name]||0)+parseFloat(p.qte||0)

    // Lier stock_items aux matières actives uniquement
    const activeMp = new Set(Object.keys(mpMap))
    const filtered = (si||[]).filter(item => {
      const k = norm(item.matiere_ref||item.name)
      return !item.matiere_ref || activeMp.has(k) || true // garder tous mais calculer valeur 0 si inactif
    })
    setItems(filtered.map(item=>({
      ...item,
      prixUnit: mpMap[norm(item.matiere_ref||item.name)]||0,
      valeur:   (item.current_qty||0)*(mpMap[norm(item.matiere_ref||item.name)]||0),
      perdus:   pertesMap[item.name]||0,
      alerte:   (item.current_qty||0) <= (item.min_qty||0),
    })))
    // Dernier inventaire
    if (invLast?.[0]) setLastInv(invLast[0].date_inventaire)
    setLoading(false)
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div>
  const alertes = items.filter(i=>i.alerte)
  const valeurTotal = items.reduce((s,i)=>s+i.valeur,0)
  const categories = [...new Set(items.map(i=>i.category))].sort()

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
        {[
          {label:'Alertes',     value:alertes.length,          color:'var(--danger)',        icon:'⚠️'},
          {label:'Valeur stock',value:valeurTotal.toFixed(0)+' DT', color:'var(--outside-green)',icon:'💰'},
          {label:'Articles',    value:items.length,            color:'var(--outside-dark)',  icon:'📦'},
        ].map(k=>(
          <div key={k.label} className="card" style={{padding:'0.75rem'}}>
            <div style={{fontSize:'1.1rem',marginBottom:2}}>{k.icon}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',color:k.color}}>{k.value}</div>
            <div style={{fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* RAPPEL INVENTAIRE */}
      {(() => {
        if (!lastInv) return (
          <div style={{background:'#FEF3DC',border:'1.5px solid #D4892A',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:800,color:'#8A5200',fontSize:'0.82rem'}}>📋 Aucun inventaire enregistré</div>
              <div style={{fontSize:'0.72rem',color:'#8A5200',marginTop:2}}>Fais ton premier inventaire pour démarrer le suivi</div>
            </div>
          </div>
        )
        const daysSince = Math.floor((new Date() - new Date(lastInv+'T00:00:00')) / (1000*60*60*24))
        if (daysSince >= 7) return (
          <div style={{background:'#FEF3DC',border:'1.5px solid #D4892A',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:800,color:'#8A5200',fontSize:'0.82rem'}}>📋 Inventaire à faire</div>
              <div style={{fontSize:'0.72rem',color:'#8A5200',marginTop:2}}>Dernier inventaire : {format(new Date(lastInv+'T00:00:00'),'d MMM yyyy',{locale:fr})} ({daysSince}j)</div>
            </div>
          </div>
        )
        return (
          <div style={{background:'#E8F5E9',border:'1.5px solid #A3D4B0',borderRadius:'var(--radius-lg)',padding:'0.6rem 1rem',marginBottom:'1rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'0.75rem',color:'#1A5C4A',fontWeight:700}}>
              ✓ Inventaire à jour — {format(new Date(lastInv+'T00:00:00'),'d MMM yyyy',{locale:fr})} ({daysSince}j)
            </div>
          </div>
        )
      })()}

      {alertes.length>0 && (
        <div style={{background:'#FDEEEC',border:'1.5px solid #F5C6C0',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem'}}>
          <div style={{fontWeight:800,color:'var(--danger)',marginBottom:6,fontSize:'0.82rem'}}>⚠️ Stock bas</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {alertes.map(a=><span key={a.id} style={{background:'white',border:'1.5px solid #F5C6C0',borderRadius:'var(--radius-pill)',padding:'2px 8px',fontSize:'0.72rem',fontWeight:700,color:'var(--danger)'}}>{a.name} ({a.current_qty} {a.unit})</span>)}
          </div>
        </div>
      )}

      {categories.map(cat=>(
        <div key={cat} style={{marginBottom:'1rem'}}>
          <div className="section-label">{cat}</div>
          <div className="card">
            {items.filter(i=>i.category===cat).map((item,idx,arr)=>{
              const pct=item.ideal_qty>0?Math.min(100,(item.current_qty/item.ideal_qty)*100):0
              const bar=item.alerte?'var(--danger)':item.current_qty<item.ideal_qty*0.5?'var(--outside-amber)':'var(--outside-green)'
              return (
                <div key={item.id} style={{padding:'0.7rem 1rem',borderBottom:idx<arr.length-1?'1.5px solid var(--outside-cream)':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <div style={{fontWeight:700,fontSize:'0.85rem'}}>{item.name}</div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:800,fontSize:'0.85rem',color:item.alerte?'var(--danger)':'var(--outside-dark)'}}>
                        {parseFloat(item.current_qty||0).toFixed(0)} <span style={{fontWeight:400,fontSize:'0.7rem',color:'var(--muted)'}}>{item.unit}</span>
                      </div>
                      {item.hasInv && <div style={{fontSize:'0.6rem',color:'var(--muted)'}}>théorique</div>}
                    </div>
                  </div>
                  <div style={{height:4,background:'var(--outside-cream2)',borderRadius:2,overflow:'hidden',marginBottom:3}}>
                    <div style={{height:'100%',width:`${pct}%`,background:bar,borderRadius:2}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:'0.65rem',color:'var(--muted)'}}>
                    <span>min {item.min_qty} · idéal {item.ideal_qty} {item.unit}</span>
                    {item.prixUnit>0 && <span style={{color:'var(--outside-green)',fontWeight:700}}>{item.valeur.toFixed(2)} DT</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

// ── MOUVEMENTS ────────────────────────────────────────────────────────────
function TabMouvements({ isManager, profile }) {
  const [items, setItems]         = useState([])
  const [formats, setFormats]     = useState({})
  const [mouvements, setMouvements] = useState([])
  const [modal, setModal]         = useState(null) // 'reception' | 'perte'
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(new Date().getDate()-7)),'yyyy-MM-dd'))
  const [dateTo,   setDateTo]   = useState(format(new Date(),'yyyy-MM-dd'))

  useEffect(()=>{ loadData() },[dateFrom, dateTo])

  async function loadData() {
    setLoading(true)
    const [{ data: si }, { data: mvt }, { data: pertes }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('stock_movements').select('*,stock_items(name,unit)').eq('type','reception')
        .gte('created_at',dateFrom).lte('created_at',dateTo+'T23:59:59')
        .order('created_at',{ascending:false}),
      supabase.from('stock_pertes').select('*')
        .gte('date_perte',dateFrom).lte('date_perte',dateTo)
        .order('date_perte',{ascending:false}),
    ])

    const all = [
      ...(mvt||[]).map(m=>({...m, _type:'reception', _date: m.created_at, _name: m.stock_items?.name, _unit: m.stock_items?.unit })),
      ...(pertes||[]).map(p=>({...p, _type:'perte', _date: p.date_perte+'T00:00:00', _name: p.item_name, _unit: p.unite })),
    ].sort((a,b)=> new Date(b._date) - new Date(a._date))

    setItems(si||[])
    setMouvements(all)
    setLoading(false)
  }

  async function fetchFormats(item) {
    if (!item || formats[item.id]) return
    const { data } = await supabase.from('matiere_formats').select('*').eq('actif',true).order('poids')
    const matched = (data||[]).filter(f=>norm(f.matiere)===norm(item.matiere_ref||item.name))
    setFormats(prev=>({...prev,[item.id]:matched}))
  }

  async function saveReception(form) {
    const {item,qty,prix,fournisseur,note,factureFile} = form
    setSaving(true)
    let facture_url = null
    if (factureFile) {
      const ext  = factureFile.name.split('.').pop()
      const path = `receptions/${item.id}_${Date.now()}.${ext}`
      const { data } = await supabase.storage.from('factures').upload(path, factureFile)
      if (data) facture_url = data.path
    }
    const { error: mvtError } = await supabase.from('stock_movements').insert({item_id:item.id,qty:parseFloat(qty),type:'reception',note:note||null,fournisseur:fournisseur||null,facture_url,done_by:profile?.id,created_at:form.date_reception+'T12:00:00'})
    if (mvtError) { alert('Erreur mouvement: '+mvtError.message); setSaving(false); return }
    const { error: siError } = await supabase.from('stock_items').update({current_qty:parseFloat(item.current_qty||0)+parseFloat(qty),updated_at:new Date().toISOString()}).eq('id',item.id)
    if (siError) { alert('Erreur stock: '+siError.message); setSaving(false); return }
    await loadData(); setSaving(false); setModal(null)
  }

  async function savePerte({item,qte,motif,motif_detail,date_perte}) {
    setSaving(true)
    await supabase.from('stock_pertes').insert({item_name:item.name,matiere_ref:item.matiere_ref,qte:parseFloat(qte),unite:item.unit,motif,motif_detail:motif_detail||null,date_perte:date_perte||format(new Date(),'yyyy-MM-dd')})
    await supabase.from('stock_items').update({current_qty:Math.max(0,parseFloat(item.current_qty||0)-parseFloat(qte)),updated_at:new Date().toISOString()}).eq('id',item.id)
    await loadData(); setSaving(false); setModal(null)
  }

  return (
    <>
      {/* ACTIONS + FILTRES */}
      {isManager && (
        <div style={{display:'flex',gap:6,marginBottom:'0.75rem'}}>
          <button className="btn btn-primary" style={{flex:1}} onClick={()=>setModal('reception')}><ShoppingCart size={15}/> + Réception</button>
          <button className="btn" style={{flex:1,background:'var(--danger)',color:'white',border:'none',borderRadius:'var(--radius-md)',padding:'8px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}} onClick={()=>setModal('perte')}><TrendingDown size={15}/> − Perte</button>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:'1rem'}}>
        <input className="form-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{fontSize:'0.8rem'}}/>
        <input className="form-input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{fontSize:'0.8rem'}}/>
      </div>

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><Spinner size={24}/></div> : (
        <div className="card">
          {mouvements.length===0 ? (
            <div style={{padding:'2rem',textAlign:'center',color:'var(--muted)'}}>Aucun mouvement sur cette période</div>
          ) : mouvements.map((m,idx)=>{
            const isReception = m._type==='reception'
            const motif = m._type==='perte' ? MOTIFS.find(x=>x.value===m.motif) : null

return (
              <div key={m.id+'_'+m._type} style={{padding:'0.75rem 1rem',borderBottom:idx<mouvements.length-1?'1.5px solid var(--outside-cream)':'none',display:'flex',gap:10,alignItems:'center'}}>
                <div style={{width:36,height:36,borderRadius:'var(--radius-md)',background:isReception?'#E8F5E9':'#FDEEEC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {isReception ? <ShoppingCart size={16} style={{color:'var(--outside-green)'}}/> : <TrendingDown size={16} style={{color:'var(--danger)'}}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:'0.85rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m._name}</div>
                  <div style={{fontSize:'0.7rem',color:'var(--muted)'}}>
                    {isReception ? (
                      <>{m.fournisseur && `${m.fournisseur} · `}{m.note||''}</>
                    ) : (
                      <span style={{color:motif?.color||'var(--muted)',fontWeight:700}}>{motif?.label||m.motif}{m.motif_detail&&` · ${m.motif_detail}`}</span>
                    )}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:'0.9rem',color:isReception?'var(--outside-green)':'var(--danger)'}}>
                    {isReception?'+':'-'}{isReception?m.qty:m.qte} <span style={{fontSize:'0.65rem',fontWeight:400}}>{m._unit}</span>
                  </div>
                  <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>{format(new Date(m._date),'d MMM',{locale:fr})}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal==='reception' && <ReceptionModal items={items} formats={formats} fetchFormats={fetchFormats} onClose={()=>setModal(null)} onSave={saveReception} saving={saving}/>}
      {modal==='perte'     && <PerteModal items={items} onClose={()=>setModal(null)} onSave={savePerte} saving={saving}/>}
    </>
  )
}

// ── INVENTAIRE ────────────────────────────────────────────────────────────
function TabInventaire({ isManager, profile }) {
  const [items, setItems]           = useState([])
  const [inv, setInv]               = useState({})
  const [stockCalc, setStockCalc]   = useState({})
  const typeInv = 'hebdo'
  const [periodeDate, setPeriodeDate] = useState(new Date())
  const [loading, setLoading]       = useState(true)
  const [calcLoading, setCalcLoading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  const periode  = typeInv==='hebdo' ? periodeHebdo(periodeDate) : periodeMensuel(periodeDate)
  const dateFrom = typeInv==='hebdo'
    ? format(startOfWeek(periodeDate,{weekStartsOn:1}),'yyyy-MM-dd')
    : format(startOfMonth(periodeDate),'yyyy-MM-dd')
  const dateTo = typeInv==='hebdo'
    ? format(new Date(startOfWeek(periodeDate,{weekStartsOn:1}).getTime()+6*24*60*60*1000),'yyyy-MM-dd')
    : format(endOfMonth(periodeDate),'yyyy-MM-dd')

  useEffect(()=>{ load() },[periode])

  async function load() {
    setLoading(true)
    const prevPeriode = typeInv==='hebdo'
      ? periodeHebdo(subWeeks(periodeDate,1))
      : periodeMensuel(new Date(periodeDate.getFullYear(),periodeDate.getMonth()-1))

    const [
      {data:si},{data:existing},{data:prevInv},{data:fmtData},{data:mvt},{data:pertes},{data:mpActif}
    ] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('stock_inventaires').select('*').eq('periode',periode).eq('periode_type',typeInv),
      supabase.from('stock_inventaires').select('item_name,qte_physique').eq('periode',prevPeriode).eq('periode_type',typeInv),
      supabase.from('matiere_formats').select('*').eq('actif',true).order('poids'),
      supabase.from('stock_movements').select('item_id,qty').eq('type','reception').gte('created_at',dateFrom),
      supabase.from('stock_pertes').select('item_name,qte').gte('date_perte',dateFrom),
      supabase.from('matiere_premiere').select('matiere').eq('actif',true),
    ])

    const fmtMap={}
    for (const f of (fmtData||[])) { const k=norm(f.matiere); if(!fmtMap[k])fmtMap[k]=[]; fmtMap[k].push(f) }
    const prevMap={}, recuMap={}, pertesMap={}
    for (const i of (prevInv||[])) prevMap[i.item_name]=parseFloat(i.qte_physique||0)
    for (const m of (mvt||[])) recuMap[m.item_id]=(recuMap[m.item_id]||0)+parseFloat(m.qty||0)
    for (const p of (pertes||[])) pertesMap[p.item_name]=(pertesMap[p.item_name]||0)+parseFloat(p.qte||0)

    const activeMpNames = new Set((mpActif||[]).map(m=>norm(m.matiere)))

    const enriched=(si||[])
      .filter(item => {
        if (!item.matiere_ref) return true
        return activeMpNames.has(norm(item.matiere_ref))
      })
      .map(item=>{
        const receptions = recuMap[item.id]||0
        const perdus     = pertesMap[item.name]||0
        // Si inventaire précédent → utiliser comme début
        // Sinon → current_qty MOINS les réceptions de la période (pour éviter double comptage)
        const debut = prevMap[item.name] != null
          ? prevMap[item.name]
          : Math.max(0, parseFloat(item.current_qty||0) - receptions)
        return {
          ...item,
          debut,
          receptions,
          perdus,
          itemFmts: fmtMap[norm(item.matiere_ref||item.name)]||[],
        }
      })

    const invMap={}
    for (const i of (existing||[])) invMap[i.item_name]={qty_native:i.qte_physique,qty_formats:{}}

    setItems(enriched)
    setInv(invMap)
    setLoading(false)
    setCalcLoading(true)
    calcConso(enriched)
  }

  async function calcConso(enriched) {
    const {data:consoData} = await supabase
      .from('v_conso_theorique').select('matiere,qte_theo')
      .gte('date_vente',dateFrom).lte('date_vente',dateTo)
    const consoMap={}
    for (const row of (consoData||[])) { const k=norm(row.matiere); consoMap[k]=(consoMap[k]||0)+parseFloat(row.qte_theo||0) }
    const calc={}
    for (const item of enriched) {
      const conso=consoMap[norm(item.matiere_ref||item.name)]||0
      const hasCompo=consoMap[norm(item.matiere_ref||item.name)]!==undefined
      calc[item.name]={conso:parseFloat(conso.toFixed(2)),hasCompo,stockCalc:Math.max(0,item.debut+item.receptions-conso-item.perdus)}
    }
    setStockCalc(calc)
    setCalcLoading(false)
  }

  function setQty(name, val) { setInv(p=>({...p,[name]:{...(p[name]||{}),qty_native:val}})) }

  function setFormatQty(name, fmtId, nb, item) {
    setInv(p=>{
      const cur=p[name]||{qty_native:'',qty_formats:{}}
      const newFmts={...cur.qty_formats,[fmtId]:nb}
      const total=Object.entries(newFmts).reduce((s,[fid,n])=>{
        const f=item.itemFmts?.find(x=>x.id===parseInt(fid))
        return s+(f?parseFloat(n||0)*parseFloat(f.poids||0):0)
      },0)
      // Si au moins un format a été saisi (même 0), on garde la valeur
      const hasAnySaisie = Object.values(newFmts).some(n => n !== '' && n !== undefined)
      return {...p,[name]:{qty_native: hasAnySaisie ? String(parseFloat(total.toFixed(2))) : '',qty_formats:newFmts}}
    })
  }

  async function saveInventaire() {
    setSaving(true)
    for (const item of items) {
      const entry = inv[item.name]
      if (!entry) continue
      // Accepter 0 et les valeurs numériques, rejeter seulement undefined/''
      const qte = entry.qty_native
      if (qte===undefined||qte==='') continue
      const calc=stockCalc[item.name]
      const theo=calc?.stockCalc??(item.debut+item.receptions-item.perdus)
      await supabase.from('stock_inventaires').upsert({
        item_name:item.name,periode,periode_type:typeInv,
        date_inventaire:format(periodeDate,'yyyy-MM-dd'),
        qte_physique:parseFloat(qte),qte_theorique:parseFloat(theo.toFixed(2)),
        ecart:parseFloat((parseFloat(qte)-theo).toFixed(2)),created_by:profile?.id,
      },{onConflict:'item_name,periode,periode_type'})
      await supabase.from('stock_items').update({current_qty:parseFloat(qte),updated_at:new Date().toISOString()}).eq('id',item.id)
    }
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false),2500)
    load()
  }

  const nbSaisis=Object.values(inv).filter(v=>v.qty_native!==''&&v.qty_native!==undefined).length

  return (
    <>
      {/* NAV */}
      <div style={{display:'flex',gap:6,marginBottom:'1rem',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <div style={{fontSize:'0.75rem',fontWeight:700,color:'var(--outside-dark)'}}>Inventaire hebdomadaire</div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriodeDate(d=>subWeeks(d,1))}>←</button>
          <div style={{textAlign:'center',minWidth:140}}>
            <div style={{fontWeight:800,fontSize:'0.82rem'}}>{periode}</div>
            <div style={{fontSize:'0.65rem',color:'var(--muted)',fontWeight:600}}>
              {format(startOfWeek(periodeDate,{weekStartsOn:1}),'d MMM',{locale:fr})} → {format(new Date(startOfWeek(periodeDate,{weekStartsOn:1}).getTime()+6*24*60*60*1000),'d MMM yyyy',{locale:fr})}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriodeDate(d=>subWeeks(d,-1))}>→</button>
          <input type="date" className="form-input"
            value={format(periodeDate,'yyyy-MM-dd')}
            onChange={e=>{ if(e.target.value) setPeriodeDate(new Date(e.target.value+'T12:00:00')) }}
            style={{fontSize:'0.78rem',width:130,marginLeft:4}}
            title="Choisir une date dans la semaine"/>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {nbSaisis>0 && <span style={{fontSize:'0.72rem',color:'var(--outside-green)',fontWeight:700}}>{nbSaisis} article{nbSaisis>1?'s':''} saisi{nbSaisis>1?'s':''}</span>}
          {isManager && <button className="btn btn-primary btn-sm" disabled={saving||nbSaisis===0} onClick={saveInventaire}>
            {saving?<Spinner size={14}/>:saved?'✓ Sauvegardé':<><Save size={13}/> Sauvegarder</>}
          </button>}
        </div>
      </div>

      {/* DATE DERNIER INVENTAIRE */}
      {Object.keys(inv).length > 0 && (() => {
        const dates = Object.values(inv).filter(v=>v.qty_native!==undefined&&v.qty_native!=='')
        return dates.length > 0 ? (
          <div style={{fontSize:'0.72rem',color:'var(--muted)',marginBottom:6,fontStyle:'italic'}}>
            Inventaire en cours pour la période {periode}
          </div>
        ) : null
      })()}
      {calcLoading && (
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',background:'var(--outside-cream)',borderRadius:'var(--radius-md)',marginBottom:8,fontSize:'0.72rem',color:'var(--muted)',fontWeight:600}}>
          <Spinner size={11}/> Calcul consommation...
        </div>
      )}

      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={24}/></div> : (
        <div className="card">
{items.map((item,idx)=>{
            const qty      = inv[item.name]?.qty_native??''
            const calc     = stockCalc[item.name]
            const stCalc   = calc ? calc.stockCalc : (item.debut+item.receptions-item.perdus)
            const ecart    = qty!=='' ? parseFloat(qty)-stCalc : null
            const fmts     = item.itemFmts||[]
            const fmtQtys  = inv[item.name]?.qty_formats||{}
            const isNewCat = idx===0 || items[idx-1].category!==item.category
            const ecartColor = ecart===null ? 'var(--outside-cream2)' : Math.abs(ecart)<1 ? '#27AE60' : ecart<0 ? '#E74C3C' : '#E67E22'

            return (
              <div key={item.id}>
                {/* SÉPARATEUR CATÉGORIE */}
                {isNewCat && (
                  <div style={{padding:'5px 14px',background:'var(--outside-cream)',fontSize:'0.6rem',fontWeight:800,textTransform:'uppercase',color:'var(--outside-orange)',letterSpacing:'0.05em',borderTop:idx>0?'2px solid var(--outside-cream2)':'none'}}>
                    {item.category}
                  </div>
                )}

                {/* LIGNE ARTICLE */}
                <div style={{padding:'10px 14px',borderTop:'1px solid var(--outside-cream)',background:qty!==''?'white':'#FAFAFA'}}>
                  {/* NOM + STOCK CALC */}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:6}}>
                    <div style={{fontWeight:700,fontSize:'0.9rem',color:'var(--outside-dark)',flex:1,paddingRight:8}}>{item.name}</div>
                    <div style={{fontSize:'0.72rem',color:calc?.hasCompo?'var(--outside-dark)':'var(--muted)',fontWeight:600,flexShrink:0}}>
                      Calc: <strong>{stCalc.toFixed(0)}</strong> {item.unit}
                    </div>
                  </div>

                  {/* SAISIE */}
                  {fmts.length===0 ? (
                    /* Saisie directe */
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <input
                        type="number" min="0" step="0.1"
                        value={qty}
                        onChange={e=>setQty(item.name,e.target.value)}
                        placeholder="Saisir quantité"
                        inputMode="decimal"
                        style={{flex:1,textAlign:'center',fontWeight:800,fontSize:'1rem',
                          height:44,border:`2px solid ${ecartColor}`,borderRadius:'var(--radius-md)',
                          padding:'6px 8px',fontFamily:'var(--font-body)',outline:'none',background:'white'}}/>
                      <div style={{fontSize:'0.78rem',color:'var(--muted)',fontWeight:600,flexShrink:0}}>{item.unit}</div>
                      {ecart!==null && (
                        <div style={{minWidth:48,textAlign:'right',fontWeight:800,fontSize:'0.85rem',color:ecartColor,flexShrink:0}}>
                          {ecart>0?'+':''}{ecart.toFixed(0)}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Saisie par formats */
                    <div>
                      {fmts.map(fmt=>(
                        <div key={fmt.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                          <span style={{fontSize:'0.78rem',color:'var(--outside-dark)',fontWeight:600,flex:1}}>{fmt.label}</span>
                          <div style={{display:'flex',alignItems:'center',gap:0,background:'var(--outside-cream)',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1.5px solid var(--outside-cream2)'}}>
                            <button
                              onClick={()=>setFormatQty(item.name,fmt.id,String(Math.max(0,(parseInt(fmtQtys[fmt.id]||0)-1))),item)}
                              style={{width:40,height:40,border:'none',background:'transparent',fontWeight:800,cursor:'pointer',fontSize:'1.2rem',color:'var(--outside-dark)'}}>−</button>
                            <input
                              type="number" min="0" step="1"
                              value={fmtQtys[fmt.id]??''}
                              onChange={e=>setFormatQty(item.name,fmt.id,e.target.value,item)}
                              inputMode="numeric"
                              style={{width:48,textAlign:'center',fontWeight:800,fontSize:'1rem',
                                border:'none',borderLeft:'1.5px solid var(--outside-cream2)',borderRight:'1.5px solid var(--outside-cream2)',
                                padding:'6px 2px',fontFamily:'var(--font-body)',outline:'none',background:'white',height:40}}/>
                            <button
                              onClick={()=>setFormatQty(item.name,fmt.id,String((parseInt(fmtQtys[fmt.id]||0)+1)),item)}
                              style={{width:40,height:40,border:'none',background:'transparent',fontWeight:800,cursor:'pointer',fontSize:'1.2rem',color:'var(--outside-dark)'}}>+</button>
                          </div>
                        </div>
                      ))}
                      {/* Total + écart */}
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                        <div style={{fontSize:'0.78rem',color:qty?'var(--outside-green)':'var(--muted)',fontWeight:700}}>
                          {qty ? `= ${qty} ${item.unit}` : '—'}
                        </div>
                        {ecart!==null && (
                          <div style={{fontWeight:800,fontSize:'0.85rem',color:ecartColor}}>
                            Écart: {ecart>0?'+':''}{ecart.toFixed(0)} {item.unit}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── MODAL RÉCEPTION ───────────────────────────────────────────────────────
function ReceptionModal({items,formats,fetchFormats,onClose,onSave,saving}) {
  const [form,setForm]    = useState({item:null,qty:'',prix:'',fournisseur:'',note:'',factureFile:null,date_reception:format(new Date(),'yyyy-MM-dd')})
  const [fmtQtys,setFmtQtys] = useState({}) // { fmtId: nb }
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))

  useEffect(()=>{ if(form.item){fetchFormats(form.item);setFmtQtys({})} },[form.item])
  const fmts = form.item?(formats[form.item.id]||[]):[]

  function setFmtQty(fmtId, nb, fmtPoids, fmtPrix) {
    const newFmts = {...fmtQtys, [fmtId]: nb}
    setFmtQtys(newFmts)
    // Recalculer qty et prix depuis tous les formats
    const totalQty  = Object.entries(newFmts).reduce((s,[fid,n])=>{
      const f=fmts.find(x=>x.id===parseInt(fid)); return s+(f?parseFloat(n||0)*parseFloat(f.poids||0):0)
    },0)
    const totalPrix = Object.entries(newFmts).reduce((s,[fid,n])=>{
      const f=fmts.find(x=>x.id===parseInt(fid)); return s+(f?parseFloat(n||0)*parseFloat(f.prix||0):0)
    },0)
    set('qty',  totalQty>0  ? String(parseFloat(totalQty.toFixed(2)))  : '')
    set('prix', totalPrix>0 ? String(parseFloat(totalPrix.toFixed(2))) : '')
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle réception"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!form.item||!form.qty||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>

      <div className="form-group"><label className="form-label">Article</label>
        <select className="form-select" value={form.item?.id||''} onChange={e=>{const val=e.target.value;const it=items.find(i=>String(i.id)===String(val));set('item',it||null)}}>
          <option value="">— Choisir —</option>
          {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {/* FORMATS */}
      {fmts.length>0 && (
        <div className="form-group">
          <label className="form-label">Quantité reçue par format</label>
          {fmts.map(fmt=>(
            <div key={fmt.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{flex:1,fontSize:'0.82rem',fontWeight:600}}>{fmt.label} <span style={{color:'var(--muted)',fontSize:'0.7rem'}}>{fmt.poids} {form.item?.unit} · {parseFloat(fmt.prix).toFixed(2)} DT</span></span>
              <div style={{display:'flex',alignItems:'center',gap:0,background:'var(--outside-cream)',borderRadius:'var(--radius-md)',overflow:'hidden',border:'1.5px solid var(--outside-cream2)'}}>
                <button onClick={()=>setFmtQty(fmt.id,String(Math.max(0,(parseInt(fmtQtys[fmt.id]||0)-1))),fmt.poids,fmt.prix)}
                  style={{width:38,height:38,border:'none',background:'transparent',fontWeight:800,cursor:'pointer',fontSize:'1.1rem'}}>−</button>
                <input type="number" min="0" step="1" inputMode="numeric" value={fmtQtys[fmt.id]??''}
                  onChange={e=>setFmtQty(fmt.id,e.target.value,fmt.poids,fmt.prix)}
                  style={{width:44,textAlign:'center',fontWeight:800,fontSize:'0.95rem',border:'none',borderLeft:'1.5px solid var(--outside-cream2)',borderRight:'1.5px solid var(--outside-cream2)',padding:'4px 2px',fontFamily:'var(--font-body)',outline:'none',background:'white',height:38}}/>
                <button onClick={()=>setFmtQty(fmt.id,String((parseInt(fmtQtys[fmt.id]||0)+1)),fmt.poids,fmt.prix)}
                  style={{width:38,height:38,border:'none',background:'transparent',fontWeight:800,cursor:'pointer',fontSize:'1.1rem'}}>+</button>
              </div>
            </div>
          ))}
          {form.qty && <div style={{fontSize:'0.78rem',fontWeight:800,color:'var(--outside-green)',marginTop:4}}>= {form.qty} {form.item?.unit} · {form.prix} DT</div>}
        </div>
      )}

      {/* QUANTITÉ MANUELLE (si pas de format) */}
      {fmts.length===0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="form-group"><label className="form-label">Quantité ({form.item?.unit||''})</label>
            <input className="form-input" type="number" inputMode="decimal" value={form.qty} onChange={e=>set('qty',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Prix (DT)</label>
            <input className="form-input" type="number" step="0.01" value={form.prix} onChange={e=>set('prix',e.target.value)}/></div>
        </div>
      )}

      {/* Si formats mais saisie manuelle aussi possible */}
      {fmts.length>0 && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
          <div className="form-group"><label className="form-label">Qté totale ({form.item?.unit||''})</label>
            <input className="form-input" type="number" inputMode="decimal" value={form.qty} onChange={e=>set('qty',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Prix total (DT)</label>
            <input className="form-input" type="number" step="0.01" value={form.prix} onChange={e=>set('prix',e.target.value)}/></div>
        </div>
      )}

      <div className="form-group"><label className="form-label">Date de réception</label>
        <input className="form-input" type="date" value={form.date_reception} onChange={e=>set('date_reception',e.target.value)}/>
      </div>
      <div className="form-group"><label className="form-label">Fournisseur</label>
        <input className="form-input" value={form.fournisseur} onChange={e=>set('fournisseur',e.target.value)}/>
      </div>
      <div className="form-group"><label className="form-label">Note</label>
        <input className="form-input" value={form.note} onChange={e=>set('note',e.target.value)}/>
      </div>
      <div className="form-group"><label className="form-label">Facture <span style={{fontWeight:400,opacity:0.6}}>optionnel</span></label>
        <input type="file" className="form-input" accept="image/*,.pdf" onChange={e=>set('factureFile',e.target.files[0]||null)}/>
        {form.factureFile && <div style={{fontSize:'0.72rem',color:'var(--outside-green)',marginTop:4}}>✓ {form.factureFile.name}</div>}
      </div>
    </Modal>
  )
}

// ── MODAL PERTE ───────────────────────────────────────────────────────────
function PerteModal({items,onClose,onSave,saving}) {
  const [form,setForm]=useState({item:null,qte:'',motif:'',motif_detail:'',date_perte:format(new Date(),'yyyy-MM-dd')})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title="Déclarer une perte"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button style={{background:'var(--danger)',color:'white',borderRadius:'var(--radius-md)',padding:'8px 16px',fontWeight:700,border:'none',cursor:'pointer'}} disabled={!form.item||!form.qte||!form.motif||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:'−'} Enregistrer</button></>}>
      <div className="form-group"><label className="form-label">Article</label>
        <select className="form-select" value={form.item?.id||''} onChange={e=>{const val=e.target.value;set('item',items.find(i=>String(i.id)===String(val))||null)}}>
          <option value="">— Choisir —</option>
          {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        <div className="form-group"><label className="form-label">Quantité ({form.item?.unit||''})</label><input className="form-input" type="number" value={form.qte} onChange={e=>set('qte',e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date_perte} onChange={e=>set('date_perte',e.target.value)}/></div>
      </div>
      <div className="form-group"><label className="form-label">Motif</label>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {MOTIFS.map(m=>(
            <button key={m.value} onClick={()=>set('motif',m.value)}
              style={{padding:'6px 12px',borderRadius:'var(--radius-pill)',border:`2px solid ${form.motif===m.value?m.color:'var(--outside-cream2)'}`,background:form.motif===m.value?m.color:'white',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,color:form.motif===m.value?'white':m.color}}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group"><label className="form-label">Détail <span style={{fontWeight:400,opacity:0.6}}>optionnel</span></label>
        <input className="form-input" value={form.motif_detail} onChange={e=>set('motif_detail',e.target.value)} placeholder="Précision..."/>
      </div>
    </Modal>
  )
}