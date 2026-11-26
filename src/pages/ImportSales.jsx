import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseSalesFile, summarizeSales } from '../lib/importSales'

const money = n => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ImportSales() {
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [latest, setLatest] = useState(null)
  const [latestLoading, setLatestLoading] = useState(true)
  const [latestError, setLatestError] = useState('')

  async function refreshLatest() {
    setLatestLoading(true); setLatestError('')
    try {
      const { data, error: err } = await supabase.rpc('latest_sales_ticket')
      if (err) throw err
      setLatest(data)
    } catch (_) {
      setLatest(null)
      setLatestError('Impossible de récupérer le dernier ticket.')
    } finally { setLatestLoading(false) }
  }

  useEffect(() => { refreshLatest() }, [])

  async function choose(e) {
    const file = e.target.files[0]
    setPreview(null); setResult(null); setError('')
    if (!file) return
    setBusy(true)
    try { const parsed = await parseSalesFile(file); setPreview({ ...parsed, name: file.name }) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function upload() {
    if (lock.current || !preview?.rows.length) return
    lock.current = true; setBusy(true); setError(''); setResult(null)
    try {
      const { data, error: err } = await supabase.rpc('import_sales_lines', { p_lines: preview.rows })
      if (err) throw err
      setResult(data); setPreview(null)
    } catch (err) { setError(`Import non confirmé : ${err.message}. Vous pouvez réessayer : les tickets déjà présents seront ignorés.`) }
    finally { await refreshLatest(); lock.current = false; setBusy(false) }
  }

  const daily = preview ? summarizeSales(preview.rows) : result?.summary || []
  return <div className="page-content" style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>
    <h1>Importer les ventes</h1>
    <p>Chargez l’export XML de la caisse. Vérifiez les montants avant de lancer l’import.</p>
    <div className="card" role="status" style={{ padding: 20, marginTop: 20 }}>
      <strong>Dernier ticket chargé</strong>
      <p>{latestLoading ? 'Chargement…' : latestError || (latest
        ? `${latest.date_vente.split('-').reverse().join('/')} à ${latest.heure.slice(0, 8)}`
        : 'Aucun ticket chargé.')}</p>
      <p style={{ fontSize: '0.875rem' }}>Date et heure de vente du ticket le plus récent en base.</p>
      {latestError && <button className="btn" onClick={refreshLatest} disabled={busy}>Réessayer</button>}
    </div>
    <div className="card" style={{ padding: 24, margin: '24px 0' }}>
      <label htmlFor="sales-xml" style={{ display: 'block', marginBottom: 12, fontWeight: 600 }}>Fichier XML de ventes</label>
      <input id="sales-xml" type="file" accept=".xml,application/xml,text/xml" disabled={busy} onChange={choose} />
      <p>10 Mo et 20 000 lignes maximum. Encodages UTF-8 et Windows-1252 acceptés.</p>
      <p>Les tickets déjà présents sont ignorés en entier. Un ticket existant ne sera pas corrigé par un nouvel import.</p>
    </div>
    {error && <p role="alert" style={{ color: '#a12c24', whiteSpace: 'pre-wrap' }}>{error}</p>}
    {busy && <p role="status">Traitement en cours…</p>}
    {preview && <p><strong>{preview.name}</strong> : {preview.rows.length} lignes retenues ; {preview.excluded} lignes à prix nul ou négatif exclues.</p>}
    {result && <div role="status"><h2>Import terminé</h2><p>{result.inserted_lines} lignes ajoutées · {result.inserted_tickets} nouveaux tickets · {result.skipped_tickets} tickets déjà présents ignorés.</p><p>Le tableau présente les ventes ajoutées par cet import.</p></div>}
    {!!daily.length && <div style={{ overflowX: 'auto', margin: '20px 0' }}><table className="table" style={{ width: '100%', fontSize: 16 }}>
      <caption style={{ textAlign: 'left', paddingBottom: 12 }}>{preview ? 'Aperçu du fichier avant contrôle des doublons' : 'Ventes ajoutées'}</caption>
      <thead><tr>{['Date', 'Tickets', 'Lignes', 'Articles', 'CA (DT)'].map(t => <th key={t} style={{ textAlign: 'left', padding: 10 }}>{t}</th>)}</tr></thead>
      <tbody>{daily.map(d => <tr key={d.date_vente}>{[d.date_vente, d.tickets, d.lignes, d.articles, money(d.ca)].map((v,i) => <td key={i} style={{ padding: 10 }}>{v}</td>)}</tr>)}</tbody>
    </table></div>}
    {preview && <button className="btn btn-primary" disabled={busy || !preview.rows.length} onClick={upload}>Importer les ventes</button>}
  </div>
}
