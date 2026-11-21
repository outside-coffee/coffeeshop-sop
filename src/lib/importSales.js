export async function parseSalesFile(file) {
  if (!/\.xml$/i.test(file.name)) throw new Error('Choisissez un fichier XML.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Le fichier dépasse 10 Mo.')
  const buffer = await file.arrayBuffer()
  let xml
  try { xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer) }
  catch (_) { xml = new TextDecoder('windows-1252').decode(buffer) }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Déclarations XML non prises en charge.')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Le fichier XML est invalide.')
  const nodes = Array.from(doc.documentElement.children).filter(n => n.tagName === 'Table')
  if (!nodes.length) throw new Error('Aucune vente Table dans ce fichier.')
  if (nodes.length > 20000) throw new Error('Maximum 20 000 lignes par fichier.')
  let excluded = 0
  const rows = nodes.map((node, i) => {
    const read = tag => {
      const el = Array.from(node.children).find(n => n.tagName === tag)
      if (!el || !el.textContent.trim()) throw new Error(`Ligne ${i + 1} : ${tag} manquant.`)
      return el.textContent.trim()
    }
    const number = (tag, integer = false) => {
      const raw = read(tag)
      if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) throw new Error(`Ligne ${i + 1} : ${tag} invalide.`)
      const n = Number(raw.replace(',', '.'))
      if (!Number.isFinite(n) || (integer && (!Number.isSafeInteger(n) || n < -2147483648 || n > 2147483647))) throw new Error(`Ligne ${i + 1} : ${tag} invalide.`)
      return n
    }
    const numero_ticket = number('Numero_Ticket', true)
    const date = read('Date').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (!date) throw new Error(`Ligne ${i + 1} : date invalide.`)
    const date_vente = `${date[3]}-${date[2]}-${date[1]}`
    const d = new Date(`${date_vente}T12:00:00Z`)
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date_vente) throw new Error(`Ligne ${i + 1} : date invalide.`)
    const heure = read('Heure')
    if (!/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(heure)) throw new Error(`Ligne ${i + 1} : heure invalide.`)
    const row = { numero_ticket, date_vente, heure, produit: read('Produit'), qte: number('Qte', true), prix_unitaire: number('Prix_Unitaire'), total_ttc: number('Total_TTC'), caissier: read('Caissier'), caisse: read('Caisse'), numtable: number('Numtable', true) }
    row.id_ticket_compact = `${numero_ticket}${date[3]}${date[2]}${date[1]}${heure.replaceAll(':', '')}`
    if (row.prix_unitaire <= 0) { excluded++; return null }
    return row
  }).filter(Boolean)
  return { rows, excluded }
}

export function summarizeSales(rows) {
  const dates = new Map()
  for (const r of rows) {
    if (!dates.has(r.date_vente)) dates.set(r.date_vente, { date_vente: r.date_vente, tickets: new Set(), lignes: 0, articles: 0, ca: 0 })
    const d = dates.get(r.date_vente)
    d.tickets.add(r.id_ticket_compact); d.lignes++; d.articles += r.qte; d.ca += r.total_ttc
  }
  return Array.from(dates.values()).sort((a,b) => a.date_vente.localeCompare(b.date_vente)).map(d => ({ ...d, tickets: d.tickets.size }))
}
