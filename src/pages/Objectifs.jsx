import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Save, Target, CheckCircle2, XCircle } from 'lucide-react'

const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''
const fN  = (n,d=1) => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})

export default function Objectifs() {
  const { profile } = useAuth()
  const isManager = hasRole(profile, ['admin','manager'])

  const [period, setPeriod] = useState(format(new Date(),'yyyy-MM'))
  const [loading, setLoading] = useState(true)
  const [objectifs, setObjectifs] = useState([])
  const [ecartMoyen, setEcartMoyen] = useState(null)
  const [controles, setControles] = useState([])
  const [ventesEau, setVentesEau] = useState(0)
  const [ventesCookies, setVentesCookies] = useState(0)
  const [nbJours, setNbJours] = useState(1)
  const [modal, setModal] = useState(null) // 'objectif' | 'controle'
  const [editObj, setEditObj] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ load() },[period])

  async function load() {
    setLoading(true)
    const dateFrom = period+'-01'
    const dateTo = format(endOfMonth(new Date(dateFrom)),'yyyy-MM-dd')
    const jours = differenceInCalendarDays(new Date(dateTo), new Date(dateFrom)) + 1
    setNbJours(jours)

    const [
      { data: objs },
      { data: consoData },
      { data: mp },
      { data: ctrl },
      { data: ventesData },
      { data: produitsData },
      { data: invFin },
      { data: invAvant },
      { data: receptionsData },
      { data: pertesData },
    ] = await Promise.all([
      supabase.from('objectifs').select('*').eq('actif',true).order('type'),
      supabase.from('v_conso_theorique').select('matiere,qte_theo,cout_theo').gte('date_vente',dateFrom).lte('date_vente',dateTo),
      supabase.from('matiere_premiere').select('matiere,prix,quantite,actif'),
      supabase.from('controles_fiches').select('*').gte('date_controle',dateFrom).lte('date_controle',dateTo).order('date_controle',{ascending:false}),
      supabase.from('transaction_line').select('produit,qte,date_vente').gte('date_vente',dateFrom).lte('date_vente',dateTo),
      supabase.from('produits').select('nom_produit,famille'),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').gte('date_inventaire',dateFrom).lte('date_inventaire',dateTo).order('date_inventaire',{ascending:false}),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').lt('date_inventaire',dateFrom).order('date_inventaire',{ascending:false}),
      supabase.from('stock_movements').select('item_id,qty,stock_items(name,matiere_ref)').eq('type','reception').gte('created_at',dateFrom).lte('created_at',dateTo+'T23:59:59'),
      supabase.from('stock_pertes').select('item_name,qte,matiere_ref').gte('date_perte',dateFrom).lte('date_perte',dateTo),
    ])

    setObjectifs(objs||[])
    setControles(ctrl||[])

    // ── ÉCART GLOBAL EN VALEUR DE STOCK (DT) ──
    const baseNames = new Set() // pas de filtre bases ici, simplifié
    const mpMap = {}
    for (const m of (mp||[])) if (m.actif!==false) mpMap[norm(m.matiere)] = { prixUnit: m.quantite>0?m.prix/m.quantite:0, nom: m.matiere }

    const consoTheoMap = {}
    for (const c of (consoData||[])) {
      const k = norm(c.matiere)
      consoTheoMap[k] = (consoTheoMap[k]||0) + parseFloat(c.qte_theo||0)
    }

    const invFinMap = {}
    for (const inv of (invFin||[])) {
      if (!invFinMap[inv.item_name] || inv.date_inventaire > invFinMap[inv.item_name+'_d']) {
        invFinMap[inv.item_name] = parseFloat(inv.qte_physique||0)
        invFinMap[inv.item_name+'_d'] = inv.date_inventaire
      }
    }
    const invAvantMap = {}
    const seenAvant = new Set()
    for (const inv of (invAvant||[])) {
      if (!seenAvant.has(inv.item_name)) { invAvantMap[inv.item_name] = parseFloat(inv.qte_physique||0); seenAvant.add(inv.item_name) }
    }
    const recuMap = {}
    for (const r of (receptionsData||[])) {
      const k = norm(r.stock_items?.matiere_ref || r.stock_items?.name || '')
      if (k) recuMap[k] = (recuMap[k]||0) + parseFloat(r.qty||0)
    }
    const pertesMap = {}
    for (const p of (pertesData||[])) {
      const k = norm(p.matiere_ref || p.item_name)
      pertesMap[k] = (pertesMap[k]||0) + parseFloat(p.qte||0)
    }

    let totalCoutTheo = 0, totalCoutEcart = 0
    for (const k of Object.keys(consoTheoMap)) {
      const info = mpMap[k]
      if (!info) continue
      const consoTheo = consoTheoMap[k]
      if (consoTheo <= 0) continue
      const prixUnit = info.prixUnit || 0
      const coutTheo = consoTheo * prixUnit
      totalCoutTheo += coutTheo

      // Matching item_name (matiere_ref == nom matiere généralement)
      const stockFin = invFinMap[info.nom]
      const stockDebut = invAvantMap[info.nom] ?? 0
      const recu = recuMap[k] || 0
      const pertes = pertesMap[k] || 0

      if (stockFin !== undefined) {
        const stockTheoFin = Math.max(0, stockDebut + recu - consoTheo - pertes)
        const ecart = stockFin - stockTheoFin // physique - théo
        totalCoutEcart += Math.abs(ecart) * prixUnit
      }
    }

    setEcartMoyen(totalCoutTheo>0 ? {
      totalCoutTheo,
      totalCoutEcart,
      pct: (totalCoutEcart/totalCoutTheo*100),
    } : null)

    // Ventes Eau
    const eauNames = new Set(['eau 0.5','eau 1/2'])
    let eauCount = 0
    for (const v of (ventesData||[])) {
      if (eauNames.has(norm(v.produit))) eauCount += parseFloat(v.qte||0)
    }
    setVentesEau(eauCount)

    // Ventes Cookies (famille COOKIESIDE)
    const familleMap = {}
    for (const p of (produitsData||[])) familleMap[norm(p.nom_produit)] = p.famille
    let cookieCount = 0
    for (const v of (ventesData||[])) {
      const fam = familleMap[norm(v.produit)]
      if (fam === 'COOKIESIDE') cookieCount += parseFloat(v.qte||0)
    }
    setVentesCookies(cookieCount)

    setLoading(false)
  }

  async function saveObjectif(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('objectifs').update({ valeur_cible: parseFloat(form.valeur_cible), unite: form.unite }).eq('id', form.id)
    } else {
      await supabase.from('objectifs').insert({
        type: form.type, cle: form.cle, valeur_cible: parseFloat(form.valeur_cible), unite: form.unite,
      })
    }
    setSaving(false); setModal(null); setEditObj(null); load()
  }

  async function saveControle(form) {
    setSaving(true)
    await supabase.from('controles_fiches').insert({
      produit: form.produit, conforme: form.conforme === 'true',
      note: form.note||null, controle_par: profile?.id, date_controle: form.date,
    })
    setSaving(false); setModal(null); load()
  }

  const objEau = objectifs.find(o=>o.type==='vente_addition'&&o.cle==='eau')
  const objCookies = objectifs.find(o=>o.type==='vente_addition'&&o.cle==='cookies')
  const objEcart = objectifs.find(o=>o.type==='ecart_conso'&&o.cle==='global')

  const moyenneEauJour = nbJours>0 ? ventesEau/nbJours : 0
  const moyenneCookiesJour = nbJours>0 ? ventesCookies/nbJours : 0
  const eauOk = objEau ? moyenneEauJour >= objEau.valeur_cible : null
  const cookiesOk = objCookies ? moyenneCookiesJour >= objCookies.valeur_cible : null

  const nbConformes = controles.filter(c=>c.conforme).length
  const pctConformite = controles.length>0 ? (nbConformes/controles.length*100) : null

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Objectifs équipe</h1>
        <p className="page-subtitle">{format(new Date(period+'-01'),'MMMM yyyy',{locale:fr})}</p>
      </div>
      <div className="page-content">

        {/* NAV PERIODE */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:'1rem'}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriod(format(subMonths(new Date(period+'-01'),1),'yyyy-MM'))}>←</button>
          <div style={{flex:1,textAlign:'center',fontWeight:700,fontSize:'0.85rem'}}>{format(new Date(period+'-01'),'MMMM yyyy',{locale:fr})}</div>
          <button className="btn btn-ghost btn-sm" onClick={()=>setPeriod(format(subMonths(new Date(period+'-01'),-1),'yyyy-MM'))}>→</button>
        </div>

        {loading ? <div style={{display:'flex',justifyContent:'center',padding:'3rem'}}><Spinner size={28}/></div> : (
          <>
            {/* 1. ÉCART CONSOMMATION */}
            <div className="card" style={{padding:'1rem',marginBottom:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:'0.85rem',display:'flex',alignItems:'center',gap:6}}>
                  <Target size={15}/> Écart conso (valeur stock)
                </div>
                {isManager && <button onClick={()=>{setEditObj(objEcart);setModal('objectif_ecart')}} style={{fontSize:'0.7rem',color:'var(--outside-orange)',background:'none',border:'none',fontWeight:700,cursor:'pointer'}}>Objectif</button>}
              </div>
              {ecartMoyen ? (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:ecartMoyen.pct<=(objEcart?.valeur_cible||5)?'var(--outside-green)':'var(--danger)'}}>
                      {ecartMoyen.pct.toFixed(1)}%
                    </div>
                    <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>objectif &lt; {objEcart?.valeur_cible||5}%</div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:'0.75rem'}}>
                    <div style={{background:'var(--outside-cream)',borderRadius:'var(--radius-sm)',padding:'6px 10px'}}>
                      <div style={{fontWeight:700}}>{ecartMoyen.totalCoutTheo.toFixed(2)} DT</div>
                      <div style={{color:'var(--muted)',fontSize:'0.65rem'}}>Coût théorique</div>
                    </div>
                    <div style={{background:'#FCEBEB',borderRadius:'var(--radius-sm)',padding:'6px 10px'}}>
                      <div style={{fontWeight:700,color:'var(--danger)'}}>{ecartMoyen.totalCoutEcart.toFixed(2)} DT</div>
                      <div style={{color:'var(--muted)',fontSize:'0.65rem'}}>Écart en valeur</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>Pas assez de données (inventaire requis sur la période).</div>
              )}
            </div>

            {/* 2. RESPECT FICHES TECHNIQUES */}
            <div className="card" style={{padding:'1rem',marginBottom:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:'0.85rem'}}>📋 Respect des fiches techniques</div>
                {isManager && <button onClick={()=>setModal('controle')} className="btn btn-primary btn-sm"><Plus size={12}/> Contrôle</button>}
              </div>
              {pctConformite!==null ? (
                <>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:pctConformite>=80?'var(--outside-green)':pctConformite>=60?'var(--outside-amber)':'var(--danger)'}}>
                      {pctConformite.toFixed(0)}%
                    </div>
                    <div style={{fontSize:'0.72rem',color:'var(--muted)'}}>conformité ({nbConformes}/{controles.length} contrôles)</div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {controles.slice(0,5).map(c=>(
                      <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'0.75rem',padding:'4px 0',borderTop:'1px solid var(--outside-cream)'}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          {c.conforme ? <CheckCircle2 size={13} style={{color:'var(--outside-green)'}}/> : <XCircle size={13} style={{color:'var(--danger)'}}/>}
                          <span style={{fontWeight:600}}>{c.produit}</span>
                        </div>
                        <span style={{color:'var(--muted)',fontSize:'0.68rem'}}>{format(new Date(c.date_controle),'d MMM',{locale:fr})}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>Aucun contrôle ce mois. Cliquez sur + Contrôle pour commencer.</div>
              )}
            </div>

            {/* 3. VENTE ADDITIONNELLE */}
            <div className="card" style={{padding:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:800,fontSize:'0.85rem'}}>💧🍪 Vente additionnelle</div>
                {isManager && <button onClick={()=>{setEditObj(null);setModal('objectif_vente')}} style={{fontSize:'0.7rem',color:'var(--outside-orange)',background:'none',border:'none',fontWeight:700,cursor:'pointer'}}>Objectifs</button>}
              </div>

              {/* EAU */}
              <div style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:'0.8rem',fontWeight:700}}>Eau</span>
                  <span style={{fontSize:'0.78rem',fontWeight:700,color:eauOk?'var(--outside-green)':'var(--danger)'}}>
                    {moyenneEauJour.toFixed(1)} / {objEau?.valeur_cible||'—'} par jour
                  </span>
                </div>
                <div style={{height:8,background:'var(--outside-cream)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{width:Math.min(100,objEau?moyenneEauJour/objEau.valeur_cible*100:0)+'%',height:'100%',background:eauOk?'var(--outside-green)':'var(--outside-amber)',borderRadius:4}}/>
                </div>
                <div style={{fontSize:'0.65rem',color:'var(--muted)',marginTop:2}}>{fN(ventesEau,0)} ventes total sur {nbJours} jours</div>
              </div>

              {/* COOKIES */}
              <div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:'0.8rem',fontWeight:700}}>Cookies</span>
                  <span style={{fontSize:'0.78rem',fontWeight:700,color:cookiesOk?'var(--outside-green)':'var(--danger)'}}>
                    {moyenneCookiesJour.toFixed(1)} / {objCookies?.valeur_cible||'—'} par jour
                  </span>
                </div>
                <div style={{height:8,background:'var(--outside-cream)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{width:Math.min(100,objCookies?moyenneCookiesJour/objCookies.valeur_cible*100:0)+'%',height:'100%',background:cookiesOk?'var(--outside-green)':'var(--outside-amber)',borderRadius:4}}/>
                </div>
                <div style={{fontSize:'0.65rem',color:'var(--muted)',marginTop:2}}>{fN(ventesCookies,0)} ventes total sur {nbJours} jours</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL OBJECTIF ÉCART */}
      {modal==='objectif_ecart' && (
        <ObjectifModal
          objectif={objEcart || {type:'ecart_conso', cle:'global', valeur_cible:5, unite:'%'}}
          label="Objectif écart consommation"
          onClose={()=>setModal(null)} onSave={saveObjectif} saving={saving}
        />
      )}

      {/* MODAL OBJECTIFS VENTE */}
      {modal==='objectif_vente' && (
        <ObjectifsVenteModal
          objEau={objEau} objCookies={objCookies}
          onClose={()=>setModal(null)} onSave={saveObjectif} saving={saving}
        />
      )}

      {/* MODAL CONTRÔLE */}
      {modal==='controle' && (
        <ControleModal onClose={()=>setModal(null)} onSave={saveControle} saving={saving}/>
      )}
    </>
  )
}

function ObjectifModal({objectif,label,onClose,onSave,saving}) {
  const [form,setForm]=useState({id:objectif?.id,type:objectif?.type,cle:objectif?.cle,valeur_cible:objectif?.valeur_cible||5,unite:objectif?.unite||'%'})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title={label}
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group">
        <label className="form-label">Valeur cible (%)</label>
        <input className="form-input" type="number" value={form.valeur_cible} onChange={e=>set('valeur_cible',e.target.value)}/>
      </div>
    </Modal>
  )
}

function ObjectifsVenteModal({objEau,objCookies,onClose,onSave,saving}) {
  const [eauVal, setEauVal] = useState(objEau?.valeur_cible || 30)
  const [cookiesVal, setCookiesVal] = useState(objCookies?.valeur_cible || 15)
  const [localSaving, setLocalSaving] = useState(false)

  async function handleSave() {
    setLocalSaving(true)
    await onSave({ id: objEau?.id, type:'vente_addition', cle:'eau', valeur_cible: eauVal, unite:'nb/jour' })
    await onSave({ id: objCookies?.id, type:'vente_addition', cle:'cookies', valeur_cible: cookiesVal, unite:'nb/jour' })
    setLocalSaving(false)
  }

  return (
    <Modal open onClose={onClose} title="Objectifs vente additionnelle"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={saving||localSaving} onClick={handleSave}>{(saving||localSaving)?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group">
        <label className="form-label">Eau — ventes par jour</label>
        <input className="form-input" type="number" value={eauVal} onChange={e=>setEauVal(e.target.value)}/>
      </div>
      <div className="form-group">
        <label className="form-label">Cookies — ventes par jour</label>
        <input className="form-input" type="number" value={cookiesVal} onChange={e=>setCookiesVal(e.target.value)}/>
      </div>
    </Modal>
  )
}

function ControleModal({onClose,onSave,saving}) {
  const [form,setForm]=useState({produit:'',conforme:'true',note:'',date:format(new Date(),'yyyy-MM-dd')})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title="Contrôle fiche technique"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!form.produit||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group"><label className="form-label">Produit</label><input className="form-input" value={form.produit} onChange={e=>set('produit',e.target.value)} placeholder="Ex: Latte"/></div>
      <div className="form-group">
        <label className="form-label">Conforme à la fiche ?</label>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>set('conforme','true')} style={{flex:1,padding:'10px',borderRadius:'var(--radius-md)',border:`2px solid ${form.conforme==='true'?'var(--outside-green)':'var(--outside-cream2)'}`,background:form.conforme==='true'?'var(--outside-green)':'white',color:form.conforme==='true'?'white':'var(--outside-dark)',fontWeight:700,cursor:'pointer'}}>✓ Conforme</button>
          <button onClick={()=>set('conforme','false')} style={{flex:1,padding:'10px',borderRadius:'var(--radius-md)',border:`2px solid ${form.conforme==='false'?'var(--danger)':'var(--outside-cream2)'}`,background:form.conforme==='false'?'var(--danger)':'white',color:form.conforme==='false'?'white':'var(--outside-dark)',fontWeight:700,cursor:'pointer'}}>✕ Non conforme</button>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></div>
      <div className="form-group"><label className="form-label">Note (optionnel)</label><input className="form-input" value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Détail de l'écart constaté"/></div>
    </Modal>
  )
}
