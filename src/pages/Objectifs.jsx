import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner, Modal } from '../components/UI'
import { format, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Save, Target, CheckCircle2, XCircle, Star, Trash2 } from 'lucide-react'

const norm = s => s?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim()||''
const fN  = (n,d=1) => n==null ? '—' : parseFloat(n).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})
const DATE_CHG_TABLE = new Date('2026-03-19')

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
  const [avisGoogle, setAvisGoogle] = useState(null)
  const [customObjectifs, setCustomObjectifs] = useState([])
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
      { data: customObjs },
      { data: consoData },
      { data: mp },
      { data: ctrl },
      { data: produitsData },
      { data: invFin },
      { data: invAvant },
      { data: receptionsData },
      { data: pertesData },
      { data: avisData },
    ] = await Promise.all([
      supabase.from('objectifs').select('*').eq('actif',true).order('type'),
      supabase.from('objectifs').select('*').eq('is_custom',true).eq('periode',period).order('created_at'),
      supabase.from('v_conso_theorique').select('matiere,qte_theo,cout_theo').gte('date_vente',dateFrom).lte('date_vente',dateTo),
      supabase.from('matiere_premiere').select('matiere,prix,quantite,actif'),
      supabase.from('controles_fiches').select('*').gte('date_controle',dateFrom).lte('date_controle',dateTo).order('date_controle',{ascending:false}),
      supabase.from('produits').select('nom_produit,famille'),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').gte('date_inventaire',dateFrom).lte('date_inventaire',dateTo).order('date_inventaire',{ascending:false}),
      supabase.from('stock_inventaires').select('item_name,qte_physique,date_inventaire').lt('date_inventaire',dateFrom).order('date_inventaire',{ascending:false}),
      supabase.from('stock_movements').select('item_id,qty,stock_items(name,matiere_ref)').eq('type','reception').gte('created_at',dateFrom).lte('created_at',dateTo+'T23:59:59'),
      supabase.from('stock_pertes').select('item_name,qte,matiere_ref').gte('date_perte',dateFrom).lte('date_perte',dateTo),
      supabase.from('avis_google').select('*').eq('periode',period).maybeSingle(),
    ])

    // Pagination par batch pour transaction_line (évite la limite Supabase de 1000)
    let ventesData = [], page = 0
    while (true) {
      const { data: batch } = await supabase
        .from('transaction_line')
        .select('produit,qte,date_vente,numtable')
        .gte('date_vente', dateFrom).lte('date_vente', dateTo)
        .range(page * 1000, (page + 1) * 1000 - 1)
      if (!batch || batch.length === 0) break
      ventesData = ventesData.concat(batch)
      if (batch.length < 1000) break
      page++
    }

    setObjectifs(objs||[])
    setCustomObjectifs(customObjs||[])
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

    // Ventes Eau (exclut conso perso)
    const eauNames = new Set(['eau 0.5','eau 1/2'])
    let eauCount = 0
    for (const v of (ventesData||[])) {
      const dateVente = new Date(v.date_vente)
      const isConsoPerso = v.numtable === 32 || (v.numtable === 22 && dateVente < DATE_CHG_TABLE)
      if (isConsoPerso) continue
      if (eauNames.has(norm(v.produit))) eauCount += parseFloat(v.qte||0)
    }
    setVentesEau(eauCount)

    // Ventes Cookies (famille COOKIESIDE + tout produit contenant "COOKIE", exclut conso perso)
    const familleMap = {}
    for (const p of (produitsData||[])) familleMap[norm(p.nom_produit)] = p.famille
    let cookieCount = 0
    for (const v of (ventesData||[])) {
      const dateVente = new Date(v.date_vente)
      const isConsoPerso = v.numtable === 32 || (v.numtable === 22 && dateVente < DATE_CHG_TABLE)
      if (isConsoPerso) continue
      const fam = familleMap[norm(v.produit)]
      const isCookie = fam === 'COOKIESIDE' || norm(v.produit).includes('cookie')
      if (isCookie) cookieCount += parseFloat(v.qte||0)
    }
    setVentesCookies(cookieCount)

    setAvisGoogle(avisData || null)

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

  async function saveAvisGoogle(form) {
    setSaving(true)
    const payload = { periode: period, nb_avis: parseInt(form.nb_avis||0), note_moyenne: form.note_moyenne?parseFloat(form.note_moyenne):null }
    if (avisGoogle?.id) {
      await supabase.from('avis_google').update(payload).eq('id', avisGoogle.id)
    } else {
      await supabase.from('avis_google').insert(payload)
    }
    setSaving(false); setModal(null); load()
  }

  async function saveCustomObjectif(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('objectifs').update({
        label: form.label, valeur_cible: parseFloat(form.valeur_cible), unite: form.unite,
      }).eq('id', form.id)
    } else {
      await supabase.from('objectifs').insert({
        type: 'custom', cle: 'custom_'+Date.now(), label: form.label,
        valeur_cible: parseFloat(form.valeur_cible), unite: form.unite,
        is_custom: true, periode: period, valeur_actuelle: 0,
      })
    }
    setSaving(false); setModal(null); setEditObj(null); load()
  }

  async function updateCustomValeur(obj, valeur) {
    await supabase.from('objectifs').update({ valeur_actuelle: parseFloat(valeur||0) }).eq('id', obj.id)
    load()
  }

  async function deleteCustomObjectif(obj) {
    if (!window.confirm('Supprimer cet objectif ?')) return
    await supabase.from('objectifs').delete().eq('id', obj.id)
    load()
  }

  const objEau = objectifs.find(o=>o.type==='vente_addition'&&o.cle==='eau')
  const objCookies = objectifs.find(o=>o.type==='vente_addition'&&o.cle==='cookies')
  const objEcart = objectifs.find(o=>o.type==='ecart_conso'&&o.cle==='global')
  const objAvis = objectifs.find(o=>o.type==='avis_google'&&o.cle==='nb_avis')

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
                  <div style={{background:'#FCEBEB',borderRadius:'var(--radius-sm)',padding:'6px 10px'}}>
                    <div style={{fontWeight:700,color:'var(--danger)',fontSize:'0.82rem'}}>{ecartMoyen.totalCoutEcart.toFixed(2)} DT</div>
                    <div style={{color:'var(--muted)',fontSize:'0.65rem'}}>Écart en valeur</div>
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

            {/* 4. AVIS GOOGLE */}
            <div className="card" style={{padding:'1rem',marginTop:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:800,fontSize:'0.85rem',display:'flex',alignItems:'center',gap:6}}>
                  <Star size={15}/> Avis Google
                </div>
                {isManager && <button onClick={()=>setModal('avis_google')} className="btn btn-primary btn-sm"><Plus size={12}/> Saisir</button>}
              </div>
              {isManager && (
                <button onClick={()=>setModal('objectif_avis')} style={{fontSize:'0.68rem',color:'var(--outside-orange)',background:'none',border:'none',fontWeight:700,cursor:'pointer',marginBottom:8,padding:0}}>
                  Modifier l'objectif ({objAvis?.valeur_cible||10}/mois)
                </button>
              )}
              {avisGoogle ? (
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div>
                    <div style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',color:objAvis&&avisGoogle.nb_avis>=objAvis.valeur_cible?'var(--outside-green)':'var(--outside-amber)'}}>
                      {avisGoogle.nb_avis}
                    </div>
                    <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>nouveaux avis {objAvis?`/ objectif ${objAvis.valeur_cible}`:''}</div>
                  </div>
                  {avisGoogle.note_moyenne && (
                    <div>
                      <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--outside-dark)'}}>{avisGoogle.note_moyenne.toFixed(1)} ⭐</div>
                      <div style={{fontSize:'0.65rem',color:'var(--muted)'}}>note moyenne</div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>Aucune saisie pour ce mois.</div>
              )}
            </div>

            {/* 5. OBJECTIFS PERSONNALISÉS */}
            <div style={{marginTop:'1rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontWeight:800,fontSize:'0.85rem'}}>🎯 Objectifs personnalisés</div>
                {isManager && <button onClick={()=>{setEditObj(null);setModal('custom_objectif')}} className="btn btn-primary btn-sm"><Plus size={12}/> Ajouter</button>}
              </div>
              {customObjectifs.length===0 ? (
                <div className="card" style={{padding:'1rem',fontSize:'0.75rem',color:'var(--muted)',fontStyle:'italic'}}>Aucun objectif personnalisé ce mois.</div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {customObjectifs.map(obj=>{
                    const pct = obj.valeur_cible>0 ? Math.min(100, (obj.valeur_actuelle||0)/obj.valeur_cible*100) : 0
                    const ok = (obj.valeur_actuelle||0) >= obj.valeur_cible
                    return (
                      <div key={obj.id} className="card" style={{padding:'0.75rem 1rem'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                          <div style={{fontWeight:700,fontSize:'0.82rem'}}>{obj.label}</div>
                          {isManager && (
                            <div style={{display:'flex',gap:4}}>
                              <button onClick={()=>{setEditObj(obj);setModal('custom_objectif')}} style={{width:24,height:24,border:'1.5px solid var(--outside-cream2)',borderRadius:'var(--radius-sm)',background:'white',cursor:'pointer',fontSize:'0.65rem',display:'flex',alignItems:'center',justifyContent:'center'}}>✏️</button>
                              <button onClick={()=>deleteCustomObjectif(obj)} style={{width:24,height:24,border:'1.5px solid #FDEEEC',borderRadius:'var(--radius-sm)',background:'#FDEEEC',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><Trash2 size={12} style={{color:'var(--danger)'}}/></button>
                            </div>
                          )}
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                          {isManager ? (
                            <input type="number" defaultValue={obj.valeur_actuelle||0}
                              onBlur={e=>updateCustomValeur(obj, e.target.value)}
                              style={{width:70,padding:'4px 8px',borderRadius:'var(--radius-sm)',border:'1.5px solid var(--outside-cream2)',fontSize:'0.8rem',fontWeight:700}}/>
                          ) : (
                            <span style={{fontWeight:700,fontSize:'0.82rem'}}>{obj.valeur_actuelle||0}</span>
                          )}
                          <span style={{fontSize:'0.72rem',color:'var(--muted)'}}>/ {obj.valeur_cible} {obj.unite}</span>
                        </div>
                        <div style={{height:6,background:'var(--outside-cream)',borderRadius:3,overflow:'hidden'}}>
                          <div style={{width:pct+'%',height:'100%',background:ok?'var(--outside-green)':'var(--outside-amber)',borderRadius:3}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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

      {/* MODAL AVIS GOOGLE */}
      {modal==='avis_google' && (
        <AvisGoogleModal avisGoogle={avisGoogle} onClose={()=>setModal(null)} onSave={saveAvisGoogle} saving={saving}/>
      )}

      {/* MODAL OBJECTIF AVIS GOOGLE */}
      {modal==='objectif_avis' && (
        <ObjectifNbModal
          objectif={objAvis || {type:'avis_google', cle:'nb_avis', valeur_cible:10, unite:'nb/mois'}}
          label="Objectif avis Google / mois"
          onClose={()=>setModal(null)} onSave={saveObjectif} saving={saving}
        />
      )}

      {/* MODAL OBJECTIF PERSONNALISÉ */}
      {modal==='custom_objectif' && (
        <CustomObjectifModal objectif={editObj} onClose={()=>{setModal(null);setEditObj(null)}} onSave={saveCustomObjectif} saving={saving}/>
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

function AvisGoogleModal({avisGoogle,onClose,onSave,saving}) {
  const [form,setForm]=useState({nb_avis:avisGoogle?.nb_avis||'',note_moyenne:avisGoogle?.note_moyenne||''})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title="Avis Google du mois"
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={form.nb_avis===''||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group">
        <label className="form-label">Nombre de nouveaux avis</label>
        <input className="form-input" type="number" value={form.nb_avis} onChange={e=>set('nb_avis',e.target.value)} placeholder="Ex: 12"/>
      </div>
      <div className="form-group">
        <label className="form-label">Note moyenne actuelle (optionnel)</label>
        <input className="form-input" type="number" step="0.1" min="1" max="5" value={form.note_moyenne} onChange={e=>set('note_moyenne',e.target.value)} placeholder="Ex: 4.6"/>
      </div>
    </Modal>
  )
}

function ObjectifNbModal({objectif,label,onClose,onSave,saving}) {
  const [form,setForm]=useState({id:objectif?.id,type:objectif?.type,cle:objectif?.cle,valeur_cible:objectif?.valeur_cible||10,unite:objectif?.unite||'nb/mois'})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title={label}
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group">
        <label className="form-label">Valeur cible (par mois)</label>
        <input className="form-input" type="number" value={form.valeur_cible} onChange={e=>set('valeur_cible',e.target.value)}/>
      </div>
    </Modal>
  )
}

function CustomObjectifModal({objectif,onClose,onSave,saving}) {
  const [form,setForm]=useState({id:objectif?.id,label:objectif?.label||'',valeur_cible:objectif?.valeur_cible||10,unite:objectif?.unite||'nb'})
  const set=(k,v)=>setForm(p=>({...p,[k]:v}))
  return (
    <Modal open onClose={onClose} title={objectif?'Modifier objectif':'Nouvel objectif'}
      footer={<><button className="btn btn-outline" onClick={onClose}>Annuler</button><button className="btn btn-primary" disabled={!form.label||saving} onClick={()=>onSave(form)}>{saving?<Spinner size={16}/>:<Save size={15}/>} Enregistrer</button></>}>
      <div className="form-group">
        <label className="form-label">Nom de l'objectif</label>
        <input className="form-input" value={form.label} onChange={e=>set('label',e.target.value)} placeholder="Ex: Formations équipe, Tickets satisfaction client..."/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
        <div className="form-group">
          <label className="form-label">Valeur cible</label>
          <input className="form-input" type="number" value={form.valeur_cible} onChange={e=>set('valeur_cible',e.target.value)}/>
        </div>
        <div className="form-group">
          <label className="form-label">Unité</label>
          <input className="form-input" value={form.unite} onChange={e=>set('unite',e.target.value)} placeholder="Ex: nb, %, DT"/>
        </div>
      </div>
    </Modal>
  )
}
