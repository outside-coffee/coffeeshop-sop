import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Spinner, EmptyState } from '../components/UI'

// Mapping famille produit depuis la table produits
const FAMILY_ICONS = {
  'CLASSIC COFFEE':      '☕',
  'HOT FLAVORED LATTE':  '☕',
  'HOT SPECIAL':         '🍫',
  'FRAPPUCCINO':         '🧋',
  'ICED FLAVORED LATTE': '🧊',
  'ICED SPECIAL':        '🧊',
  'SMOOTHIES':           '🥤',
  'FRESH':               '💧',
  'COOKIESIDE':          '🍪',
  'OUTSIDE SIGNATURE':   '⭐',
  'OUTSIDE COMBO':       '🎯',
  'EXTRA':               '➕',
}

export default function Recipes() {
  const [compositions, setCompositions] = useState([])  // toutes les lignes
  const [produits, setProduits]         = useState([])  // table produits pour famille + prix
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [activeFamily, setActiveFamily] = useState('all')
  const [expanded, setExpanded]         = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const [{ data: comp }, { data: prods }] = await Promise.all([
      supabase.from('composition_produit')
        .select('*')
        .eq('type', 'produit fini')
        .order('nom_produit')
        .order('id'),
      supabase.from('produits')
        .select('id_produit, nom_produit, famille, prix')
        .order('famille').order('nom_produit'),
    ])
    setCompositions(comp || [])
    setProduits(prods || [])
    setLoading(false)
  }

  // Construire la liste des produits uniques avec leurs ingrédients
  const recipeMap = {}
  for (const line of compositions) {
    if (!recipeMap[line.nom_produit]) recipeMap[line.nom_produit] = []
    recipeMap[line.nom_produit].push(line)
  }

  // Enrichir avec famille + prix depuis table produits
  const produitIndex = {}
  for (const p of produits) {
    produitIndex[p.nom_produit] = p
  }

  const recipes = Object.entries(recipeMap).map(([nom, ingredients]) => {
    const info = produitIndex[nom] || {}
    return {
      nom,
      famille:     info.famille || 'Autre',
      prix:        info.prix,
      ingredients,
      cout:        ingredients.reduce((s, i) => s + parseFloat(i.prix_achat || 0), 0),
    }
  })

  // Familles disponibles depuis les recettes
  const families = ['all', ...Array.from(new Set(recipes.map(r => r.famille))).sort()]

  const filtered = recipes.filter(r => {
    const matchFamily = activeFamily === 'all' || r.famille === activeFamily
    const matchSearch = !search || r.nom.toLowerCase().includes(search.toLowerCase())
    return matchFamily && matchSearch
  })

  // Grouper par famille
  const grouped = filtered.reduce((acc, r) => {
    acc[r.famille] = acc[r.famille] || []
    acc[r.famille].push(r)
    return acc
  }, {})

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Recettes</h1>
          <p className="page-subtitle">{recipes.length} produits · compositions et couts</p>
        </div>
      </div>

      <div className="page-content">

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: '36px' }}
            placeholder="Rechercher un produit..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* FAMILLE FILTER */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {families.map(f => {
            const icon  = FAMILY_ICONS[f] || '•'
            const label = f === 'all' ? 'Tout' : `${icon} ${f}`
            const cnt   = f === 'all' ? recipes.length : recipes.filter(r => r.famille === f).length
            return (
              <button key={f}
                className={`btn btn-sm ${activeFamily === f ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveFamily(f)}
                style={{ fontSize: '0.78rem' }}>
                {label} <span style={{ opacity: 0.65 }}>({cnt})</span>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <EmptyState icon="☕" title="Aucune recette" description="Aucun produit ne correspond." />
        )}

        {/* GROUPED RECIPES */}
        {Object.entries(grouped).map(([famille, items]) => (
          <div key={famille} style={{ marginBottom: '1.5rem' }}>
            <div className="section-label">
              {FAMILY_ICONS[famille] || '•'} {famille}
              <span style={{ marginLeft: '8px', color: 'var(--muted)' }}>({items.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(recipe => {
                const isOpen = expanded === recipe.nom
                const marge  = recipe.prix && recipe.cout
                  ? ((recipe.prix - recipe.cout) / recipe.prix * 100).toFixed(0)
                  : null

                return (
                  <div key={recipe.nom} className="card">
                    {/* HEADER */}
                    <div style={{ padding: '0.9rem 1.5rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isOpen ? null : recipe.nom)}>

                      <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--outside-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                        {FAMILY_ICONS[recipe.famille] || '☕'}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{recipe.nom}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px', display: 'flex', gap: '10px' }}>
                          <span>{recipe.ingredients.length} ingredient{recipe.ingredients.length > 1 ? 's' : ''}</span>
                          <span>Cout: <strong style={{ color: 'var(--ink)' }}>{recipe.cout.toFixed(3)} DT</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {recipe.prix && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--outside-dark)' }}>
                              {recipe.prix % 1 === 0 ? recipe.prix : recipe.prix.toFixed(1)} DT
                            </div>
                            {marge && (
                              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: parseInt(marge) >= 60 ? 'var(--outside-green)' : 'var(--outside-amber)' }}>
                                Marge {marge}%
                              </div>
                            )}
                          </div>
                        )}
                        {isOpen
                          ? <ChevronUp size={18} color="var(--muted)" />
                          : <ChevronDown size={18} color="var(--muted)" />}
                      </div>
                    </div>

                    {/* INGREDIENTS */}
                    {isOpen && (
                      <div style={{ borderTop: '1.5px solid var(--outside-cream)', padding: '0.75rem 1.5rem 1rem' }}>
                        <table style={{ width: '100%', fontSize: '0.85rem' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '4px 0', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 800, borderBottom: '1.5px solid var(--outside-cream)' }}>Ingredient</th>
                              <th style={{ textAlign: 'right', padding: '4px 0', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 800, borderBottom: '1.5px solid var(--outside-cream)' }}>Quantite</th>
                              <th style={{ textAlign: 'right', padding: '4px 0', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', fontWeight: 800, borderBottom: '1.5px solid var(--outside-cream)' }}>Cout</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recipe.ingredients.map((ing, i) => (
                              <tr key={i}>
                                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--outside-cream)', fontWeight: 600 }}>{ing.matiere}</td>
                                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--outside-cream)', textAlign: 'right', color: 'var(--muted)', fontWeight: 600 }}>
                                  {ing.quantite_m} {ing.unite}
                                </td>
                                <td style={{ padding: '6px 0', borderBottom: '1px solid var(--outside-cream)', textAlign: 'right', fontWeight: 700, color: 'var(--outside-dark)' }}>
                                  {parseFloat(ing.prix_achat).toFixed(3)} DT
                                </td>
                              </tr>
                            ))}
                            {/* TOTAL */}
                            <tr style={{ background: 'var(--outside-cream)' }}>
                              <td colSpan={2} style={{ padding: '8px 0 4px', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cout total</td>
                              <td style={{ padding: '8px 0 4px', textAlign: 'right', fontWeight: 800, color: 'var(--outside-dark)' }}>
                                {recipe.cout.toFixed(3)} DT
                              </td>
                            </tr>
                            {recipe.prix && (
                              <tr>
                                <td colSpan={2} style={{ padding: '4px 0', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Prix de vente</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 800, color: 'var(--outside-orange)' }}>
                                  {recipe.prix % 1 === 0 ? recipe.prix : recipe.prix.toFixed(1)} DT
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
