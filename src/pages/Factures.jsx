import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, hasRole } from '../hooks/useAuth'
import { Spinner } from '../components/UI'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Search, FileText, Image, Download, Eye, X } from 'lucide-react'

export default function Factures() {
  const { profile } = useAuth()
  const isManager   = hasRole(profile, 'manager')

  const [factures, setFactures]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [preview, setPreview]     = useState(null)
  const [signedUrls, setSignedUrls] = useState({}) // { id: signedUrl }

  useEffect(() => { if (isManager) fetchFactures() }, [])

  async function fetchFactures() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_movements')
      .select(`
        id, qty, note, fournisseur, facture_url, created_at,
        stock_items(name, category),
        profiles(name)
      `)
      .eq('type', 'reception')
      .not('facture_url', 'is', null)
      .order('created_at', { ascending: false })
    setFactures(data || [])
    setLoading(false)
  }

  async function getSignedUrl(id, path) {
    if (signedUrls[id]) return signedUrls[id]
    const { data } = await supabase.storage
      .from('factures')
      .createSignedUrl(path, 3600)
    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [id]: data.signedUrl }))
      return data.signedUrl
    }
    return null
  }

  async function openPreview(facture) {
    const url = await getSignedUrl(facture.id, facture.facture_url)
    if (url) setPreview({ ...facture, signedUrl: url })
  }

  async function downloadFacture(facture) {
    const url = await getSignedUrl(facture.id, facture.facture_url)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = `facture_${facture.stock_items?.name}_${format(new Date(facture.created_at), 'ddMMyyyy')}`
      a.click()
    }
  }

  const filtered = factures.filter(f => {
    if (!search) return true
    const s = search.toLowerCase()
    return f.stock_items?.name?.toLowerCase().includes(s) ||
           f.fournisseur?.toLowerCase().includes(s) ||
           f.note?.toLowerCase().includes(s)
  })

  const isPdf = url => url?.toLowerCase().includes('.pdf') || url?.toLowerCase().endsWith('pdf')

  if (!isManager) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem', color: 'var(--muted)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
      <div style={{ fontWeight: 700 }}>Accès manager uniquement</div>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Factures</h1>
        <p className="page-subtitle">{factures.length} document{factures.length > 1 ? 's' : ''}</p>
      </div>

      <div className="page-content">

        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: 36 }}
            placeholder="Rechercher par produit, fournisseur..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <h3>Aucune facture</h3>
            <p>Les factures sont ajoutées lors d'une réception de stock</p>
          </div>
        ) : (
          <div className="card">
            {filtered.map((f, idx) => {
              const isImg = !isPdf(f.facture_url)
              return (
                <div key={f.id} style={{ padding: '0.85rem 1rem', borderBottom: idx < filtered.length - 1 ? '1.5px solid var(--outside-cream)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>

                  {/* ICON */}
                  <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: isImg ? '#EBF2FD' : '#FEF3DC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isImg ? <Image size={18} color="#3D5A8A" /> : <FileText size={18} color="#C4521A" />}
                  </div>

                  {/* INFO */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.stock_items?.name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '1px' }}>
                      {f.fournisseur && <span style={{ fontWeight: 700, color: 'var(--outside-orange)', marginRight: 8 }}>{f.fournisseur}</span>}
                      {format(new Date(f.created_at), "d MMM yyyy", { locale: fr })}
                      {f.profiles?.name && <span style={{ marginLeft: 6 }}>· {f.profiles.name}</span>}
                    </div>
                    {f.note && (
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.note}
                      </div>
                    )}
                  </div>

                  {/* ACTIONS */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--outside-green)' }}
                      onClick={() => openPreview(f)}
                      title="Voir">
                      <Eye size={16} />
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--muted)' }}
                      onClick={() => downloadFacture(f)}
                      title="Télécharger">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* PREVIEW MODAL */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline btn-sm" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
              onClick={() => downloadFacture(preview)}>
              <Download size={14} /> Télécharger
            </button>
            <button className="btn btn-ghost btn-icon" style={{ color: 'white' }} onClick={() => setPreview(null)}>
              <X size={20} />
            </button>
          </div>

          <div style={{ fontSize: '0.85rem', color: 'white', marginBottom: '1rem', textAlign: 'center' }}>
            <strong>{preview.stock_items?.name}</strong>
            {preview.fournisseur && <span style={{ color: 'var(--outside-amber)', marginLeft: 8 }}>{preview.fournisseur}</span>}
            <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>
              {format(new Date(preview.created_at), "d MMM yyyy", { locale: fr })}
            </span>
          </div>

          {isPdf(preview.facture_url) ? (
            <iframe src={preview.signedUrl} style={{ width: '100%', maxWidth: 700, height: '80vh', border: 'none', borderRadius: 8 }} />
          ) : (
            <img src={preview.signedUrl} alt="facture"
              style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, objectFit: 'contain' }} />
          )}
        </div>
      )}
    </>
  )
}
