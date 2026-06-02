import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { Plus, Save, TrendingDown, ShoppingCart } from 'lucide-react'
import { format, startOfWeek, getWeek, getYear, subWeeks, startOfMonth, endOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'

const MOTIFS = [
  { value: 'casse',       label: 'Cassé / Renversé', color: '#E74C3C' },
  { value: 'perime',      label: 'Périmé',            color: '#E67E22' },
  { value: 'conso_staff', label: 'Conso. staff',      color: '#3D5A8A' },
  { value: 'erreur',      label: 'Erreur de saisie',  color: '#8B6B8A' },
  { value: 'autre',       label: 'Autre',             color: '#7F8C8D' },
]

function periodeHebdo(d = new Date()) {
  return `${getYear(d)}-W${String(getWeek(d,{weekStartsOn:1})).padStart(2,'0')}`
}
function periodeMensuel(d = new Date()) { return format(d,'yyyy-MM') }

export default function Stock() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')
  const [tab, setTab] = useState('dashboard')
  return (
    <>
      <div className="page-header"><h1 className="page-title">Stock</h1></div>
      <div className="page-content">
        <div className="tabs" style={{ marginBottom:'1.25rem' }}>
          <button className={`tab-btn${tab==='dashboard' ?' active':''}`} onClick={()=>setTab('dashboard')}>Vue d'ensemble</button>
          <button className={`tab-btn${tab==='inventaire'?' active':''}`} onClick={()=>setTab('inventaire')}>Inventaire</button>
          <button className={`tab-btn${tab==='receptions'?' active':''}`} onClick={()=>setTab('receptions')}>Réceptions</button>
          <button className={`tab-btn${tab==='pertes'    ?' active':''}`} onClick={()=>setTab('pertes')}>Pertes</button>
        </div>
        {tab==='dashboard'  && <TabDashboard />}
        {tab==='inventaire' && <TabInventaire isManager={isManager} profile={profile} />}
        {tab==='receptions' && <TabReceptions isManager={isManager} profile={profile} />}
        {tab==='pertes'     && <TabPertes     isManager={isManager} profile={profile} />}
      </div>
    </>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function TabDashboard() {
  const [items, setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{ load() },[])

  async function load() {
    const [{ data: si }, { data: mp }, { data: pertes }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('matiere_premiere').select('matiere,prix,quantite').or('actif.eq.true,actif.is.null'),
      supabase.from('stock_pertes').select('item_name,qte').gte('date_perte', format(startOfMonth(new Date()),'yyyy-MM-dd')),
    ])
    const mpMap={}
    for (const m of (mp||[])) mpMap[m.matiere] = m.quantite>0 ? m.prix/m.quantite : 0
    const pertesMap={}
    for (const p of (pertes||[])) pertesMap[p.item_name]=(pertesMap[p.item_name]||0)+parseFloat(p.qte||0)
    setItems((si||[]).map(item=>({
      ...item,
      prixUnit: mpMap[item.matiere_ref]||0,
      valeur:   (item.current_qty||0)*(mpMap[item.matiere_ref]||0),
      perdus:   pertesMap[item.name]||0,
      alerte:   item.current_qty<=item.min_qty,
    })))
    setLoading(false)
  }

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div>
  const alertes=items.filter(i=>i.alerte)
  const valeurTotal=items.reduce((s,i)=>s+i.valeur,0)
  const categories=[...new Set(items.map(i=>i.category))].sort()

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:'1rem'}}>
        {[
          {label:'Alertes',value:alertes.length,color:'var(--danger)',icon:'⚠️'},
          {label:'Valeur stock',value:valeurTotal.toFixed(2)+' DT',color:'var(--outside-green)',icon:'💰'},
          {label:'Articles',value:items.length,color:'var(--outside-dark)',icon:'📦'},
        ].map(k=>(
          <div key={k.label} className="card" style={{padding:'0.75rem'}}>
            <div style={{fontSize:'1.2rem',marginBottom:2}}>{k.icon}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',color:k.color}}>{k.value}</div>
            <div style={{fontSize:'0.62rem',fontWeight:800,textTransform:'uppercase',color:'var(--muted)',marginTop:2}}>{k.label}</div>
          </div>
        ))}
      </div>
      {alertes.length>0 && (
        <div style={{background:'#FDEEEC',border:'1.5px solid #F5C6C0',borderRadius:'var(--radius-lg)',padding:'0.75rem 1rem',marginBottom:'1rem'}}>
          <div style={{fontWeight:800,color:'var(--danger)',marginBottom:6,fontSize:'0.82rem'}}>⚠️ {alertes.length} article{alertes.length>1?'s':''} en stock bas</div>
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
              const pct=item.ideal_qty>0?Math.min(100,item.current_qty/item.ideal_qty*100):0
              const barColor=item.alerte?'var(--danger)':item.current_qty<item.ideal_qty*0.5?'var(--outside-amber)':'var(--outside-green)'
              return (
                <div key={item.id} style={{padding:'0.7rem 1rem',borderBottom:idx<arr.length-1?'1.5px solid var(--outside-cream)':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                    <div style={{fontWeight:700,fontSize:'0.85rem'}}>{item.name}</div>
                    <div style={{fontWeight:800,fontSize:'0.85rem',color:item.alerte?'var(--danger)':'var(--outside-dark)'}}>{item.current_qty} <span style={{fontWeight:400,fontSize:'0.7rem',color:'var(--muted)'}}>{item.unit}</span></div>
                  </div>
                  <div style={{height:4,background:'var(--outside-cream2)',borderRadius:2,overflow:'hidden',marginBottom:3}}>
                    <div style={{height:'100%',width:`${pct}%`,background:barColor,borderRadius:2}}/>
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

// ── INVENTAIRE ────────────────────────────────────────────────────────────
function TabInventaire({ isManager, profile }) {
  const [items, setItems]       = useState([])
  const [inv, setInv]           = useState({})
  const [typeInv, setTypeInv]   = useState('hebdo')
  const [periodeDate, setPeriodeDate] = useState(new Date())
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const periode  = typeInv==='hebdo' ? periodeHebdo(periodeDate) : periodeMensuel(periodeDate)
  const dateFrom = typeInv==='hebdo'
    ? format(startOfWeek(periodeDate,{weekStartsOn:1}),'yyyy-MM-dd')
    : format(startOfMonth(periodeDate),'yyyy-MM-dd')
  const dateTo = typeInv==='hebdo'
    ? format(new Date(startOfWeek(periodeDate,{weekStartsOn:1}).getTime()+6*24*60*60*1000),'yyyy-MM-dd')
    : format(endOfMonth(periodeDate),'yyyy-MM-dd')

  useEffect(()=>{ loadData() },[periode])

  const [calcLoading, setCalcLoading] = useState(false)
  const [debugLog, setDebugLog]       = useState([])
  const addLog = msg => setDebugLog(prev => [...prev, msg])

  async function loadData() {
    setLoading(true)

    const prevPeriode = typeInv === 'hebdo'
      ? periodeHebdo(subWeeks(periodeDate, 1))
      : periodeMensuel(new Date(periodeDate.getFullYear(), periodeDate.getMonth()-1))

    // Phase 1 — données rapides (sans ventes)
    const [
      { data: si },
      { data: existing },
      { data: prevInv },
      { data: mpData },
      { data: mvt },
      { data: pertes },
    ] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('stock_inventaires').select('*').eq('periode',periode).eq('periode_type',typeInv),
      supabase.from('stock_inventaires').select('item_name,qte_physique').eq('periode',prevPeriode).eq('periode_type',typeInv),
      supabase.from('matiere_premiere').select('matiere,prix,quantite,unite').or('actif.eq.true,actif.is.null'),
      supabase.from('stock_movements').select('item_id,qty,type').eq('type','reception').gte('created_at',dateFrom),
      supabase.from('stock_pertes').select('item_name,qte').gte('date_perte',dateFrom),
    ])

    const prevInvMap = {}
    for (const i of (prevInv||[])) prevInvMap[i.item_name] = parseFloat(i.qte_physique||0)
    const mpMap = {}
    for (const m of (mpData||[])) mpMap[m.matiere] = { prixUnit: m.quantite>0?m.prix/m.quantite:0 }
    const receptionsMap = {}
    for (const m of (mvt||[])) receptionsMap[m.item_id] = (receptionsMap[m.item_id]||0) + parseFloat(m.qty||0)
    const pertesMap = {}
    for (const p of (pertes||[])) pertesMap[p.item_name] = (pertesMap[p.item_name]||0) + parseFloat(p.qte||0)

    // Affichage rapide avec stock théo = stock actuel (sans conso)
    const baseItems = (si||[]).map(item => ({
      ...item,
      stockDebut:  prevInvMap[item.name] ?? parseFloat(item.current_qty||0),
      receptions:  receptionsMap[item.id]||0,
      pertesDec:   pertesMap[item.name]||0,
      consoTheo:   0,
      hasCompo:    false,
      stockTheo:   parseFloat(((prevInvMap[item.name] ?? parseFloat(item.current_qty||0)) + (receptionsMap[item.id]||0) - (pertesMap[item.name]||0)).toFixed(2)),
      prixUnit:    mpMap[item.matiere_ref]?.prixUnit || 0,
    }))

    const invMap = {}
    for (const i of (existing||[])) invMap[i.item_name] = i.qte_physique

    setItems(baseItems)
    setInv(invMap)
    setLoading(false)

    // Phase 2 — calcul conso théorique en arrière-plan
    setCalcLoading(true)
    calcConsoTheo(baseItems, mpMap)
  }

  async function calcConsoTheo(baseItems, mpMap) {
    // Utilise la vue SQL v_conso_theorique — 1 seule requête rapide
    addLog('Période: '+dateFrom+' → '+dateTo)
    const { data: consoData, error: consoError } = await supabase
      .from('v_conso_theorique')
      .select('matiere, qte_theo')
      .gte('date_vente', dateFrom)
      .lte('date_vente', dateTo)
    addLog('Rows: '+(consoData?.length||0)+' error: '+(consoError?.message||'none'))
    if (consoData?.length>0) addLog('Ex: '+consoData[0].matiere+' = '+consoData[0].qte_theo)

    // Agréger par matière — avec normalisation des accents
    const norm = s => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim()||''
    const consoTheoMap = {}        // clé normalisée → qte
    const consoTheoOrigMap = {}    // clé normalisée → nom original
    for (const row of (consoData||[])) {
      const k = norm(row.matiere)
      consoTheoMap[k] = (consoTheoMap[k]||0) + parseFloat(row.qte_theo||0)
      consoTheoOrigMap[k] = row.matiere
    }

    setItems(prev => prev.map(item => {
      const mRef = item.matiere_ref
      const mRefNorm = norm(mRef)
      const conso = mRef ? (consoTheoMap[mRefNorm]||0) : 0
      const hasCompo = mRef && consoTheoMap[mRefNorm] !== undefined
      const stockTheo = Math.max(0, item.stockDebut + item.receptions - conso - item.pertesDec)
      return { ...item, consoTheo: parseFloat(conso.toFixed(2)), hasCompo, stockTheo: parseFloat(stockTheo.toFixed(2)) }
    }))
    setCalcLoading(false)
  }

  async function saveInventaire() {
    setSaving(true)
    for (const [item_name, qte_physique] of Object.entries(inv)) {
      const item = items.find(i=>i.name===item_name)
      const qte_theo = item ? parseFloat(item.current_qty) : null
      const ecart    = qte_physique!=null && qte_theo!=null ? parseFloat(qte_physique)-qte_theo : null
      await supabase.from('stock_inventaires').upsert({
        item_name, periode, periode_type:typeInv,
        date_inventaire: format(periodeDate,'yyyy-MM-dd'),
        qte_physique: parseFloat(qte_physique), qte_theorique: qte_theo, ecart,
        created_by: profile?.id,
      },{ onConflict:'item_name,periode,periode_type' })
      await supabase.from('stock_items').update({ current_qty: parseFloat(qte_physique), updated_at: new Date().toISOString() }).eq('name',item_name)
    }
    setSaving(false); setSaved(true)
    setTimeout(()=>setSaved(false),2000)
    loadData()
  }

  const categories=[...new Set(items.map(i=>i.category))].sort()
  const totalEcart=Object.entries(inv).reduce((sum,[name,qte])=>{
    const item=items.find(i=>i.name===name)
    if (!item||qte==null) return sum
    return sum+(parseFloat(qte)-parseFloat(item.current_qty))
  },0)

  return (
    <>
      <div style={{display:'flex',gap:6,marginBottom:'1rem',flexWrap:'wrap',alignItems:'center'}}>
        <div style={{display:'flex',gap:4}}>
          {['hebdo','mensuel'].map(t=>(
            <button key={t} className={`btn btn-sm ${typeInv===t?'btn-primary':'btn-outline'}`} onClick={()=>setTypeInv(t)}>
              {t==='hebdo'?'Hebdo':'Mensuel'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriodeDate(d=>typeInv==='hebdo'?subWeeks(d,1):new Date(d.getFullYear(),d.getMonth()-1))}>←</button>
          <span style={{fontWeight:700,fontSize:'0.82rem',minWidth:80,textAlign:'center'}}>{periode}</span>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriodeDate(d=>typeInv==='hebdo'?subWeeks(d,-1):new Date(d.getFullYear(),d.getMonth()+1))}>→</button>
        </div>
        <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {Object.keys(inv).length>0 && (
            <span style={{fontSize:'0.75rem',color:totalEcart<0?'var(--danger)':'var(--outside-green)',fontWeight:700}}>
              Écart: {totalEcart>0?'+':''}{totalEcart.toFixed(0)}
            </span>
          )}
          {isManager && (
            <button className="btn btn-primary btn-sm" disabled={saving||Object.keys(inv).length===0} onClick={saveInventaire}>
              {saving?<Spinner size={14}/>:saved?'✓ Sauvegardé':<><Save size={13}/> Sauvegarder</>}
            </button>
          )}
        </div>
      </div>

      {calcLoading && (
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:'var(--outside-cream)',borderRadius:'var(--radius-md)',marginBottom:8,fontSize:'0.75rem',color:'var(--muted)',fontWeight:600}}>
          <Spinner size={12}/> Calcul de la consommation théorique...
        </div>
      )}
      {debugLog.length > 0 && (
        <div style={{background:'#1D3A3A',borderRadius:'var(--radius-md)',padding:'8px 12px',marginBottom:8,fontSize:'0.65rem',color:'#A0C4B0',fontFamily:'monospace',maxHeight:120,overflowY:'auto'}}>
          {debugLog.map((l,i) => <div key={i}>{l}</div>)}
          <button onClick={()=>setDebugLog([])} style={{marginTop:4,background:'var(--outside-orange)',color:'white',border:'none',borderRadius:4,padding:'2px 8px',cursor:'pointer',fontSize:'0.65rem'}}>Fermer</button>
        </div>
      )}
      {loading ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><Spinner size={24}/></div> : (
        <>
          {categories.map(cat=>(
            <div key={cat} style={{marginBottom:'0.75rem'}}>
              <div style={{fontSize:'0.62rem',fontWeight:800,textTransform:'uppercase',color:'var(--outside-orange)',padding:'4px 0 2px'}}>{cat}</div>
              <div className="card">
                {items.filter(i=>i.category===cat).map((item,idx,arr)=>{
                  const physique = inv[item.name] ?? ''
                  const ecart = physique !== '' ? parseFloat(physique) - item.stockTheo : null
                  return (
                    <InventaireRow key={item.id} item={item} physique={physique} ecart={ecart}
                      isLast={idx===arr.length-1}
                      onChange={val => setInv(prev=>({...prev,[item.name]:val}))} />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ── RÉCEPTIONS ────────────────────────────────────────────────────────────
function TabReceptions({ isManager, profile }) {
  const [items, setItems]       = useState([])
  const [formats, setFormats]   = useState({})
  const [movements, setMovements] = useState([])
  const [modal, setModal]       = useState(false)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(()=>{ loadData() },[])

  async function loadData() {
    const [{ data: si },{ data: mvt }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('category').order('name'),
      supabase.from('stock_movements').select('*, stock_items(name,unit)').eq('type','reception').order('created_at',{ascending:false}).limit(50),
    ])
    setItems(si||[]); setMovements(mvt||[]); setLoading(false)
  }

  async function fetchFormats(itemId, matiere_ref) {
    if (!matiere_ref||formats[itemId]) return
    const norm=s=>s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''
    const {data}=await supabase.from('matiere_formats').select('*').order('poids')
    const matched=(data||[]).filter(f=>norm(f.matiere)===norm(matiere_ref))
    setFormats(prev=>({...prev,[itemId]:matched}))
  }

  async function saveReception({item,qty,prix,fournisseur,note,factureFile}) {
    setSaving(true)
    let facture_url=null
    if (factureFile) {
      const ext=factureFile.name.split('.').pop()
      const {data}=await supabase.storage.from('factures').upload(`${item.id}_${Date.now()}.${ext}`,factureFile)
      if (data) facture_url=data.path
    }
    await supabase.from('stock_movements').insert({ item_id:item.id, qty:parseFloat(qty), type:'reception', note, fournisseur, facture_url, created_by:profile?.id })
    await supabase.from('stock_items').update({ current_qty:parseFloat(item.current_qty||0)+parseFloat(qty), updated_at:new Date().toISOString() }).eq('id',item.id)
    await loadData(); setSaving(false); setModal(false)
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--muted)'}}>{movements.length} réceptions récentes</div>
        {isManager&&<button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}><Plus size={14}/> Nouvelle réception</button>}
      </div>
      {loading?<div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><Spinner size={24}/></div>:(
        <div className="card">
          {movements.length===0?<div style={{padding:'2rem',textAlign:'center',color:'var(--muted)'}}>Aucune réception</div>
          :movements.map((m,idx)=>(
            <div key={m.id} style={{padding:'0.75rem 1rem',borderBottom:idx<movements.length-1?'1.5px solid var(--outside-cream)':'none',display:'flex',gap:10,alignItems:'flex-start'}}>
              <div style={{width:36,height:36,borderRadius:'var(--radius-md)',background:'var(--outside-cream)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <ShoppingCart size={16} style={{color:'var(--outside-orange)'}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:'0.85rem'}}>{m.stock_items?.name||'—'}</div>
                <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>+{m.qty} {m.stock_items?.unit}{m.fournisseur&&` · ${m.fournisseur}`}{m.note&&` · ${m.note}`}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontWeight:800,fontSize:'0.82rem',color:'var(--outside-green)'}}>+{m.qty}</div>
                <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>{format(new Date(m.created_at),'d MMM',{locale:fr})}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {modal&&<ReceptionModal items={items} formats={formats} fetchFormats={fetchFormats} onClose={()=>setModal(false)} onSave={saveReception} saving={saving}/>}
    </>
  )
}

// ── PERTES ────────────────────────────────────────────────────────────────
function TabPertes({ isManager, profile }) {
  const [items, setItems]   = useState([])
  const [pertes, setPertes] = useState([])
  const [modal, setModal]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ loadData() },[])

  async function loadData() {
    const [{ data:si },{ data:p }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('active',true).order('name'),
      supabase.from('stock_pertes').select('*').order('date_perte',{ascending:false}).limit(50),
    ])
    setItems(si||[]); setPertes(p||[]); setLoading(false)
  }

  async function savePerte({item,qte,motif,motif_detail,date_perte}) {
    setSaving(true)
    await supabase.from('stock_pertes').insert({ item_name:item.name, matiere_ref:item.matiere_ref, qte:parseFloat(qte), unite:item.unit, motif, motif_detail:motif_detail||null, date_perte:date_perte||format(new Date(),'yyyy-MM-dd'), created_by:profile?.id })
    await supabase.from('stock_items').update({ current_qty:Math.max(0,parseFloat(item.current_qty||0)-parseFloat(qte)), updated_at:new Date().toISOString() }).eq('id',item.id)
    await loadData(); setSaving(false); setModal(false)
  }

  return (
    <>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1rem'}}>
        <div style={{fontSize:'0.82rem',fontWeight:700,color:'var(--muted)'}}>{pertes.length} pertes</div>
        {isManager&&<button className="btn btn-sm" style={{background:'var(--danger)',color:'white',borderRadius:'var(--radius-md)',padding:'6px 12px',fontWeight:700,border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4}} onClick={()=>setModal(true)}><Plus size={14}/> Déclarer une perte</button>}
      </div>
      {pertes.length>0&&(
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'1rem'}}>
          {MOTIFS.map(m=>{const count=pertes.filter(p=>p.motif===m.value).length;if(!count)return null;return <div key={m.value} style={{padding:'3px 10px',borderRadius:'var(--radius-pill)',background:m.color+'18',border:`1.5px solid ${m.color}`,fontSize:'0.7rem',fontWeight:700,color:m.color}}>{m.label}: {count}</div>})}
        </div>
      )}
      {loading?<div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><Spinner size={24}/></div>:(
        <div className="card">
          {pertes.length===0?<div style={{padding:'2rem',textAlign:'center',color:'var(--muted)'}}>Aucune perte déclarée</div>
          :pertes.map((p,idx)=>{
            const motif=MOTIFS.find(m=>m.value===p.motif)
            return (
              <div key={p.id} style={{padding:'0.75rem 1rem',borderBottom:idx<pertes.length-1?'1.5px solid var(--outside-cream)':'none',display:'flex',gap:10,alignItems:'flex-start'}}>
                <div style={{width:36,height:36,borderRadius:'var(--radius-md)',background:(motif?.color||'#999')+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <TrendingDown size={16} style={{color:motif?.color||'#999'}}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:'0.85rem'}}>{p.item_name}</div>
                  <div style={{display:'flex',gap:6,marginTop:2}}>
                    <span style={{fontSize:'0.68rem',fontWeight:700,color:motif?.color||'#999',background:(motif?.color||'#999')+'15',borderRadius:10,padding:'1px 7px'}}>{motif?.label||p.motif}</span>
                    {p.motif_detail&&<span style={{fontSize:'0.68rem',color:'var(--muted)'}}>{p.motif_detail}</span>}
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:'0.82rem',color:'var(--danger)'}}>−{p.qte} {p.unite}</div>
                  <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>{format(new Date(p.date_perte+'T00:00:00'),'d MMM',{locale:fr})}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {modal&&<PerteModal items={items} onClose={()=>setModal(false)} onSave={savePerte} saving={saving}/>}
    </>
  )
}

// ── MODAL RÉCEPTION ───────────────────────────────────────────────────────
function ReceptionModal({ items, formats, fetchFormats, onClose, onSave, saving }) {
  const [form, setForm]         = useState({ item:null, qty:'', prix:'', fournisseur:'', note:'', factureFile:null })
  const [selectedFormat, setSF] = useState(null)
  const [formatQty, setFQ]      = useState('1')
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))

  useEffect(()=>{ if(form.item) fetchFormats(form.item.id, form.item.matiere_ref) },[form.item])
  const itemFormats = form.item ? (formats[form.item.id]||[]) : []

  function selectFormat(f) {
    const n=parseInt(formatQty)||1; setSF(f)
    set('qty',String(n*f.poids)); set('prix',String((n*parseFloat(f.prix)).toFixed(2)))
  }
  function updateFQ(n) {
    setFQ(String(n))
    if(selectedFormat){ set('qty',String(n*selectedFormat.poids)); set('prix',String((n*parseFloat(selectedFormat.prix)).toFixed(2))) }
  }

  return (
    <Modal open onClose={onClose} title="Nouvelle réception"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!form.item||!form.qty||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group"><label className="form-label">Article</label>
        <select className="form-select" value={form.item?.id||''} onChange={e=>{const item=items.find(i=>i.id===parseInt(e.target.value));set('item',item||null);setSF(null);setFQ('1')}}>
          <option value="">— Choisir —</option>
          {items.map(i=><option key={i.id} value={i.id}>{i.name} ({i.category})</option>)}
        </select>
      </div>
      {form.item && itemFormats.length>0 && (
        <div className="form-group"><label className="form-label">Format</label>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
            {itemFormats.map(f=>(
              <button key={f.id} onClick={()=>selectFormat(f)} style={{padding:'6px 10px',borderRadius:'var(--radius-md)',border:`2px solid ${selectedFormat?.id===f.id?'var(--outside-orange)':'var(--outside-cream2)'}`,background:selectedFormat?.id===f.id?'#FFF8F5':'white',cursor:'pointer',textAlign:'left'}}>
                <div style={{fontWeight:800,fontSize:'0.8rem'}}>{f.label}</div>
                <div style={{fontSize:'0.68rem',color:'var(--muted)'}}>{f.poids} {form.item.unit} · {parseFloat(f.prix).toFixed(2)} DT</div>
              </button>
            ))}
          </div>
          {selectedFormat && (
            <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--outside-cream)',borderRadius:'var(--radius-md)',padding:'8px 12px'}}>
              <button onClick={()=>updateFQ(Math.max(1,parseInt(formatQty||1)-1))} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'white',fontWeight:800,fontSize:'1.2rem',cursor:'pointer'}}>−</button>
              <input type="number" min="1" value={formatQty} onChange={e=>updateFQ(Math.max(1,parseInt(e.target.value)||1))} style={{width:50,textAlign:'center',fontWeight:800,fontSize:'1rem',border:'2px solid var(--outside-orange)',borderRadius:'var(--radius-sm)',padding:'3px',fontFamily:'var(--font-body)',outline:'none'}}/>
              <button onClick={()=>updateFQ(parseInt(formatQty||1)+1)} style={{width:32,height:32,borderRadius:'50%',border:'none',background:'white',fontWeight:800,fontSize:'1.2rem',cursor:'pointer'}}>+</button>
              <div style={{fontSize:'0.82rem',color:'var(--muted)'}}>=&nbsp;<strong style={{color:'var(--outside-green)'}}>{parseInt(formatQty||1)*selectedFormat.poids} {form.item.unit}</strong><div style={{fontSize:'0.7rem'}}>{(parseInt(formatQty||1)*parseFloat(selectedFormat.prix)).toFixed(2)} DT</div></div>
            </div>
          )}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        <div className="form-group"><label className="form-label">Quantité ({form.item?.unit||''})</label><input className="form-input" type="number" value={form.qty} onChange={e=>set('qty',e.target.value)}/></div>
        <div className="form-group"><label className="form-label">Prix total (DT)</label><input className="form-input" type="number" step="0.01" value={form.prix} onChange={e=>set('prix',e.target.value)}/></div>
      </div>
      <div className="form-group"><label className="form-label">Fournisseur</label><input className="form-input" value={form.fournisseur} onChange={e=>set('fournisseur',e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Note</label><input className="form-input" value={form.note} onChange={e=>set('note',e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Facture (optionnel)</label><input type="file" className="form-input" accept="image/*,.pdf" onChange={e=>set('factureFile',e.target.files[0]||null)}/></div>
    </Modal>
  )
}

// ── MODAL PERTE ───────────────────────────────────────────────────────────
function PerteModal({ items, onClose, onSave, saving }) {
  const [form, setForm] = useState({ item:null, qte:'', motif:'', motif_detail:'', date_perte:format(new Date(),'yyyy-MM-dd') })
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title="Déclarer une perte"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button style={{background:'var(--danger)',color:'white',borderRadius:'var(--radius-md)',padding:'8px 16px',fontWeight:700,border:'none',cursor:'pointer'}} disabled={!form.item||!form.qte||!form.motif||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:'−'} Enregistrer</button></>}>
      <div className="form-group"><label className="form-label">Article</label>
        <select className="form-select" value={form.item?.id||''} onChange={e=>set('item',items.find(i=>i.id===parseInt(e.target.value))||null)}>
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
            <button key={m.value} onClick={()=>set('motif',m.value)} style={{padding:'6px 12px',borderRadius:'var(--radius-pill)',border:`2px solid ${form.motif===m.value?m.color:'var(--outside-cream2)'}`,background:form.motif===m.value?m.color:'white',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,color:form.motif===m.value?'white':m.color}}>
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

// ── INVENTAIRE ROW — avec détail théorique + saisie formats ───────────────
function InventaireRow({ item, physique, ecart, isLast, onChange }) {
  const [showDetail, setShowDetail] = useState(false)
  const [formats, setFormats]       = useState(null) // null = pas chargé
  const [formatQty, setFormatQty]   = useState({})   // { formatId: nb }

  async function loadFormats() {
    if (formats !== null) return
    const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''
    const { data } = await supabase.from('matiere_formats').select('*')
      .eq('actif', true).order('poids')
    const matched = (data||[]).filter(f => norm(f.matiere) === norm(item.matiere_ref || item.name))
    setFormats(matched)
  }

  function handleFormatChange(fmt, nb) {
    const newFQ = { ...formatQty, [fmt.id]: nb }
    setFormatQty(newFQ)
    // Total = somme de tous les formats sélectionnés
    const total = Object.entries(newFQ).reduce((sum, [fid, n]) => {
      const f = formats?.find(f => f.id === parseInt(fid))
      return sum + (f ? parseFloat(n||0) * parseFloat(f.poids||0) : 0)
    }, 0)
    onChange(total > 0 ? String(parseFloat(total.toFixed(2))) : '')
  }

  const borderColor = ecart === null ? 'var(--outside-cream2)'
    : ecart < -1 ? 'var(--danger)'
    : ecart > 1  ? 'var(--outside-amber)'
    : 'var(--outside-green)'

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1.5px solid var(--outside-cream)' }}>
      {/* LIGNE PRINCIPALE */}
      <div style={{ padding: '0.6rem 1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* NOM + DÉTAIL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.name}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>Début: <strong>{item.stockDebut}</strong></span>
            {item.receptions > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--outside-green)' }}>+{item.receptions} reçu</span>}
            {item.hasCompo && <span style={{ fontSize: '0.62rem', color: 'var(--outside-orange)' }}>−{item.consoTheo} conso</span>}
            {item.pertesDec > 0 && <span style={{ fontSize: '0.62rem', color: 'var(--danger)' }}>−{item.pertesDec} pertes</span>}
          </div>
        </div>

        {/* STOCK THÉORIQUE */}
        <div style={{ textAlign: 'center', flexShrink: 0, width: 60 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>Théo.</div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: item.hasCompo ? 'var(--outside-dark)' : 'var(--muted)' }}>
            {item.stockTheo}
          </div>
          {!item.hasCompo && <div style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>estimé</div>}
        </div>

        {/* SAISIE PHYSIQUE */}
        <div style={{ flexShrink: 0, width: 72 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700, textAlign: 'center', marginBottom: 2 }}>Physique</div>
          <input type="number" min="0" step="0.1" value={physique}
            onChange={e => onChange(e.target.value)}
            onFocus={() => { loadFormats() }}
            placeholder={String(item.stockTheo)}
            style={{ textAlign:'center', fontWeight:800, fontSize:'0.82rem', border:`1.5px solid ${borderColor}`, borderRadius:'var(--radius-sm)', padding:'4px 2px', fontFamily:'var(--font-body)', outline:'none', width:'100%' }}/>
        </div>

        {/* ÉCART */}
        <div style={{ textAlign: 'center', flexShrink: 0, width: 52 }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 700 }}>Écart</div>
          <div style={{ fontWeight: 800, fontSize: '0.82rem',
            color: ecart===null?'var(--muted)':ecart<-1?'var(--danger)':ecart>1?'var(--outside-amber)':'var(--outside-green)' }}>
            {ecart===null ? '—' : (ecart>0?'+':'')+ecart.toFixed(0)}
          </div>
        </div>
      </div>

      {/* FORMATS (si disponibles) */}
      {formats && formats.length > 0 && (
        <div style={{ padding: '0 1rem 0.5rem', background: 'var(--outside-cream)', borderTop: '1px solid var(--outside-cream2)' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', padding: '4px 0 4px' }}>Saisie par format</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {formats.map(fmt => {
              const nb = formatQty[fmt.id] || ''
              return (
                <div key={fmt.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', borderRadius: 'var(--radius-sm)', padding: '4px 8px', border: '1px solid var(--outside-cream2)' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--outside-dark)' }}>{fmt.label}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{fmt.poids}{item.unit}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>×</span>
                  <input type="number" min="0" step="1" value={nb}
                    onChange={e => handleFormatChange(fmt, e.target.value)}
                    style={{ width: 36, textAlign: 'center', fontWeight: 800, fontSize: '0.82rem', border: '1.5px solid var(--outside-orange)', borderRadius: 4, padding: '2px', fontFamily: 'var(--font-body)', outline: 'none' }}/>
                </div>
              )
            })}
          </div>
          {physique !== '' && <div style={{ fontSize: '0.7rem', color: 'var(--outside-green)', fontWeight: 700, marginTop: 4 }}>Total: {physique} {item.unit}</div>}
        </div>
      )}
    </div>
  )
}
