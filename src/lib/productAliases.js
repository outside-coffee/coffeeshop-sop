export function normalizeProductKey(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

export function buildProductAliasMap(aliases = []) {
  const map = {}
  for (const row of aliases) {
    if (row.actif === false) continue
    const aliasKey = normalizeProductKey(row.alias)
    if (aliasKey) map[aliasKey] = row.nom_produit?.trim() || row.alias?.trim() || ''
  }
  return map
}

export function canonicalProductName(value, aliasMap = {}) {
  const cleaned = (value || '')
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return aliasMap[normalizeProductKey(cleaned)] || cleaned
}
