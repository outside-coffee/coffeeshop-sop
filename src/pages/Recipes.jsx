import { useState, useEffect } from 'react'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Spinner, EmptyState } from '../components/UI'

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

// Génère les étapes de préparation depuis la liste d'ingrédients
function generateSteps(nom, ingredients) {
  const steps = []
  const nomUp = nom.toUpperCase()

  const hasCafe    = ingredients.some(i => i.matiere.toLowerCase().includes('caf'))
  const hasLait    = ingredients.some(i => i.matiere.toLowerCase().includes('lait'))
  const hasSirop   = ingredients.some(i => i.matiere.toLowerCase().includes('sirop'))
  const hasGlacon  = ingredients.some(i => i.matiere.toLowerCase().includes('gla'))
  const hasFruit   = ingredients.some(i =>
    ['banane','fraise','orange','citron','pomme','mangue','epinard','menthe'].some(f => i.matiere.toLowerCase().includes(f))
  )
  const hasPate    = ingredients.some(i =>
    ['nutella','pistache','speculoos','snickers','bueno','peanut','oreo'].some(f => i.matiere.toLowerCase().includes(f))
  )
  const hasYaourt  = ingredients.some(i => i.matiere.toLowerCase().includes('yaourt'))
  const hasPoudre  = ingredients.some(i => i.matiere.toLowerCase().includes('poudre') || i.matiere.toLowerCase().includes('chocolin'))
  const hasCream   = ingredients.some(i => i.matiere.toLowerCase().includes('cream') || i.matiere.toLowerCase().includes('creme'))
  const hasSucre   = ingredients.some(i => i.matiere.toLowerCase().includes('sucre'))
  const hasTopping = ingredients.some(i => i.matiere.toLowerCase().includes('topping'))
  const hasEau     = ingredients.some(i => i.matiere.toLowerCase() === 'eau' || i.matiere.toLowerCase().includes('eau 0'))

  const isFrappe   = nomUp.includes('FRAPPUCCINO') || nomUp.includes('FRAPE') || nomUp.includes('FRAPPE')
  const isIced     = nomUp.includes('ICED')
  const isSmooth   = nomUp.includes('SMOOTHIE')
  const isHot      = nomUp.includes('HOT ') || nomUp.includes('CAPPUCCINO') || nomUp.includes('LATTE') || nomUp.includes('CAPUCIN') || nomUp.includes('AMERICANO') || nomUp.includes('ESPRESSO')
  const isFresh    = nomUp.includes('CITRONNADE') || nomUp.includes('ORANGE') || nomUp.includes('FRESH')
  const isCloud    = nomUp.includes('CLOUD')

  // ── SMOOTHIE ──────────────────────────────────────────────────────────
  if (isSmooth) {
    if (hasFruit) {
      const fruits = ingredients.filter(i =>
        ['banane','fraise','orange','citron','pomme','mangue','epinard','menthe'].some(f => i.matiere.toLowerCase().includes(f))
      )
      fruits.forEach(f => steps.push({ label: `Peser ${f.matiere.toLowerCase()}`, value: `${f.quantite_m} ${f.unite}` }))
    }
    if (hasLait || hasYaourt) steps.push({ label: 'Ajouter la base smoothie', value: 'Base lait + yaourt' })
    if (hasSucre) {
      const s = ingredients.find(i => i.matiere.toLowerCase().includes('sucre'))
      steps.push({ label: 'Ajouter le sucre', value: `${s.quantite_m} ${s.unite}` })
    }
    if (hasGlacon) steps.push({ label: 'Ajouter les glaçons', value: 'Verre plein' })
    steps.push({ label: 'Mixer', value: '45 sec — texture homogène' })
    steps.push({ label: 'Servir immédiatement', value: 'Ne pas laisser reposer' })
    if (hasTopping) steps.push({ label: 'Décorer avec le topping', value: null })
    return steps
  }

  // ── FRAPPUCCINO ───────────────────────────────────────────────────────
  if (isFrappe) {
    if (hasCafe) {
      const c = ingredients.find(i => i.matiere.toLowerCase().includes('caf'))
      steps.push({ label: 'Extraire le double espresso', value: `${c.quantite_m}g — 25-30 sec` })
      steps.push({ label: 'Laisser refroidir', value: '2 min' })
    }
    if (hasPate) {
      const p = ingredients.find(i =>
        ['nutella','pistache','speculoos','snickers','bueno','peanut','oreo'].some(f => i.matiere.toLowerCase().includes(f))
      )
      steps.push({ label: `Ajouter ${p.matiere.toLowerCase()}`, value: `${p.quantite_m} ${p.unite}` })
    }
    if (hasSirop) {
      const sirops = ingredients.filter(i => i.matiere.toLowerCase().includes('sirop'))
      sirops.forEach(s => steps.push({ label: `Ajouter ${s.matiere.toLowerCase()}`, value: `${s.quantite_m} ${s.unite}` }))
    }
    if (hasLait) {
      const l = ingredients.find(i => i.matiere.toLowerCase().includes('lait') && !i.matiere.toLowerCase().includes('concentr'))
      if (l) steps.push({ label: 'Verser le lait', value: `${l.quantite_m} ${l.unite}` })
    }
    if (hasGlacon) steps.push({ label: 'Remplir de glaçons', value: 'Verre aux 3/4' })
    steps.push({ label: 'Blender', value: '30 sec — texture crémeuse' })
    if (hasTopping) {
      const tops = ingredients.filter(i => i.matiere.toLowerCase().includes('topping'))
      tops.forEach(t => steps.push({ label: `Topping ${t.matiere.replace('Topping ','').toLowerCase()}`, value: `${t.quantite_m} ${t.unite}` }))
    }
    steps.push({ label: 'Servir en verrine', value: 'Avec paille' })
    return steps
  }

  // ── ICED LATTE / ICED SPECIAL ─────────────────────────────────────────
  if (isIced) {
    if (hasCafe) {
      const c = ingredients.find(i => i.matiere.toLowerCase().includes('caf'))
      steps.push({ label: 'Extraire le double espresso', value: `${c.quantite_m}g — 25-30 sec` })
    }
    if (hasPate) {
      const p = ingredients.find(i =>
        ['nutella','pistache','speculoos','snickers','bueno','peanut','oreo'].some(f => i.matiere.toLowerCase().includes(f))
      )
      steps.push({ label: `Mettre ${p.matiere.toLowerCase()} au fond du verre`, value: `${p.quantite_m} ${p.unite}` })
    }
    if (hasSirop) {
      const sirops = ingredients.filter(i => i.matiere.toLowerCase().includes('sirop'))
      sirops.forEach(s => steps.push({ label: `Ajouter ${s.matiere.toLowerCase()}`, value: `${s.quantite_m} ${s.unite}` }))
    }
    steps.push({ label: 'Remplir de glaçons', value: 'Verre aux 3/4' })
    if (hasCafe) steps.push({ label: 'Verser l\'espresso sur les glaçons', value: null })
    if (hasLait) {
      const l = ingredients.find(i => i.matiere.toLowerCase().includes('lait') && !i.matiere.toLowerCase().includes('concentr'))
      if (l) steps.push({ label: 'Ajouter le lait froid', value: `${l.quantite_m} ${l.unite}` })
    }
    if (hasTopping) {
      const tops = ingredients.filter(i => i.matiere.toLowerCase().includes('topping'))
      tops.forEach(t => steps.push({ label: `Finition ${t.matiere.replace('Topping ','').toLowerCase()}`, value: `${t.quantite_m} ${t.unite}` }))
    }
    steps.push({ label: 'Mélanger délicatement', value: null })
    return steps
  }

  // ── BOISSONS CHAUDES (latte, cappuccino, hot special…) ────────────────
  if (isHot || hasCafe) {
    if (hasCafe) {
      const c = ingredients.find(i => i.matiere.toLowerCase().includes('caf'))
      const isDouble = c && c.quantite_m >= 18
      steps.push({
        label: isDouble ? 'Extraire le double espresso' : 'Extraire le simple espresso',
        value: `${c.quantite_m}g — 25-30 sec`
      })
    }
    if (hasPoudre) {
      const p = ingredients.find(i => i.matiere.toLowerCase().includes('poudre') || i.matiere.toLowerCase().includes('chocolin'))
      steps.push({ label: `Diluer ${p.matiere.toLowerCase()}`, value: `${p.quantite_m}g + peu d'eau chaude` })
    }
    if (hasPate) {
      const p = ingredients.find(i =>
        ['nutella','pistache','speculoos','snickers','bueno','peanut','oreo'].some(f => i.matiere.toLowerCase().includes(f))
      )
      steps.push({ label: `Incorporer ${p.matiere.toLowerCase()}`, value: `${p.quantite_m} ${p.unite}` })
    }
    if (hasSirop) {
      const sirops = ingredients.filter(i => i.matiere.toLowerCase().includes('sirop'))
      sirops.forEach(s => steps.push({ label: `Ajouter ${s.matiere.toLowerCase()}`, value: `${s.quantite_m} ${s.unite}` }))
    }
    if (hasLait) {
      const l = ingredients.find(i => i.matiere.toLowerCase() === 'lait' || i.matiere.toLowerCase() === 'lait entier')
      if (l) {
        const isCappu = nomUp.includes('CAPPUCCINO') || nomUp.includes('CAPUCIN')
        steps.push({ label: 'Texturer le lait vapeur', value: `${l.quantite_m} ${l.unite} — 60-65°C` })
        if (isCappu) {
          steps.push({ label: 'Phase texture', value: 'Lance près surface — tourbillon 5-7 sec' })
          steps.push({ label: 'Phase chauffe', value: 'Lance plus profond — monter en temp.' })
          steps.push({ label: 'Assembler', value: '1/3 espresso · 1/3 lait · 1/3 mousse' })
        } else {
          steps.push({ label: 'Verser le lait sur l\'espresso', value: 'Micro-mousse veloutée' })
        }
      }
    }
    if (hasEau && nomUp.includes('AMERICANO')) {
      steps.push({ label: 'Allonger avec eau chaude', value: '150-180 ml' })
    }
    if (hasTopping) {
      const tops = ingredients.filter(i => i.matiere.toLowerCase().includes('topping'))
      tops.forEach(t => steps.push({ label: `Finition topping ${t.matiere.replace('Topping ','').toLowerCase()}`, value: `${t.quantite_m} ${t.unite}` }))
    }
    steps.push({ label: 'Servir immédiatement', value: 'Tasse préchauffée' })
    return steps
  }

  // ── FRESH (citronnade, jus orange) ────────────────────────────────────
  if (isFresh) {
    if (hasFruit) {
      const fruits = ingredients.filter(i =>
        ['banane','fraise','orange','citron','pomme','mangue'].some(f => i.matiere.toLowerCase().includes(f))
      )
      fruits.forEach(f => steps.push({ label: `Presser ${f.matiere.toLowerCase()}`, value: `${f.quantite_m} ${f.unite}` }))
    }
    if (hasSirop) {
      const s = ingredients.find(i => i.matiere.toLowerCase().includes('sirop'))
      steps.push({ label: `Ajouter ${s.matiere.toLowerCase()}`, value: `${s.quantite_m} ${s.unite}` })
    }
    if (hasGlacon) steps.push({ label: 'Ajouter les glaçons', value: null })
    steps.push({ label: 'Mélanger', value: null })
    steps.push({ label: 'Servir frais', value: null })
    return steps
  }

  // ── OUTSIDE SIGNATURE (Cloud drinks) ──────────────────────────────────
  if (isCloud) {
    steps.push({ label: 'Préparer la base', value: 'Selon la recette du jour' })
    ingredients.filter(i => !i.matiere.toLowerCase().includes('lait')).forEach(ing => {
      steps.push({ label: `Incorporer ${ing.matiere.toLowerCase()}`, value: `${ing.quantite_m} ${ing.unite}` })
    })
    steps.push({ label: 'Monter la texture cloud', value: 'Fouetter jusqu\'à texture mousseuse' })
    steps.push({ label: 'Dresser', value: 'Déposer la cloud sur la boisson froide' })
    return steps
  }

  // ── FALLBACK générique ────────────────────────────────────────────────
  ingredients.forEach((ing, i) => {
    steps.push({ label: `Etape ${i + 1} — ${ing.matiere}`, value: `${ing.quantite_m} ${ing.unite}` })
  })
  return steps
}

export default function Recipes() {
  const [compositions, setCompositions] = useState([])
  const [produits, setProduits]         = useState([])
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
        .order('nom_produit').order('id'),
      supabase.from('produits')
        .select('nom_produit, famille, cup_size')
        .order('famille').order('nom_produit'),
    ])
    setCompositions(comp || [])
    setProduits(prods || [])
    setLoading(false)
  }

  const recipeMap = {}
  for (const line of compositions) {
    if (!recipeMap[line.nom_produit]) recipeMap[line.nom_produit] = []
    recipeMap[line.nom_produit].push(line)
  }

  const produitIndex = {}
  for (const p of produits) { produitIndex[p.nom_produit] = p }

  const recipes = Object.entries(recipeMap).map(([nom, ingredients]) => {
    const info = produitIndex[nom] || {}
    return {
      nom,
      famille:     info.famille || 'Autre',
      ingredients,
      steps:       generateSteps(nom, ingredients),
    }
  })

  const families = ['all', ...Array.from(new Set(recipes.map(r => r.famille))).sort()]

  const filtered = recipes.filter(r => {
    const matchFamily = activeFamily === 'all' || r.famille === activeFamily
    const matchSearch = !search || r.nom.toLowerCase().includes(search.toLowerCase())
    return matchFamily && matchSearch
  })

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
          <p className="page-subtitle">{recipes.length} produits · etapes de preparation</p>
        </div>
      </div>

      <div className="page-content">

        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="form-input" style={{ paddingLeft: '36px' }}
            placeholder="Rechercher un produit..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

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

        {Object.entries(grouped).map(([famille, items]) => (
          <div key={famille} style={{ marginBottom: '1.5rem' }}>
            <div className="section-label">
              {FAMILY_ICONS[famille] || '•'} {famille}
              <span style={{ marginLeft: '8px', color: 'var(--muted)' }}>({items.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(recipe => {
                const isOpen = expanded === recipe.nom
                return (
                  <div key={recipe.nom} className="card">
                    <div style={{ padding: '0.9rem 1.5rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                      onClick={() => setExpanded(isOpen ? null : recipe.nom)}>

                      <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: 'var(--outside-cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                        {FAMILY_ICONS[recipe.famille] || '☕'}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{recipe.nom}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                          {recipe.ingredients.length} ingredient{recipe.ingredients.length > 1 ? 's' : ''} · {recipe.steps.length} etape{recipe.steps.length > 1 ? 's' : ''}
                        </div>
                      </div>

                      {isOpen
                        ? <ChevronUp size={18} color="var(--muted)" />
                        : <ChevronDown size={18} color="var(--muted)" />}
                    </div>

                    {isOpen && (
                      <div style={{ borderTop: '1.5px solid var(--outside-cream)', padding: '1rem 1.5rem' }}>

                        {/* INGREDIENTS */}
                        <div style={{ marginBottom: '1.25rem' }}>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '8px' }}>
                            Ingredients
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {recipe.ingredients.map((ing, i) => (
                              <span key={i} style={{
                                background: 'var(--outside-cream)',
                                border: '1.5px solid var(--outside-cream2)',
                                borderRadius: 'var(--radius-pill)',
                                padding: '4px 12px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: 'var(--outside-dark)',
                              }}>
                                {ing.matiere} · <span style={{ color: 'var(--outside-orange)' }}>{ing.quantite_m} {ing.unite}</span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* ETAPES */}
                        <div>
                          <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '8px' }}>
                            Preparation
                          </div>
                          {recipe.steps.map((step, i) => (
                            <div key={i} style={{ display: 'flex', gap: '12px', padding: '0.6rem 0', borderBottom: i < recipe.steps.length - 1 ? '1px solid var(--outside-cream)' : 'none', alignItems: 'flex-start' }}>
                              <div style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: 'var(--outside-dark)',
                                color: 'white',
                                fontSize: '0.68rem', fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, marginTop: '1px'
                              }}>
                                {i + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{step.label}</span>
                                {step.value && (
                                  <span style={{
                                    marginLeft: '8px',
                                    background: 'var(--outside-cream)',
                                    border: '1.5px solid var(--outside-cream2)',
                                    borderRadius: 'var(--radius-pill)',
                                    padding: '2px 10px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    color: 'var(--outside-orange)',
                                  }}>
                                    {step.value}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
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
