import { useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Badge, Modal, EmptyState } from '../components/UI'
import { RECIPE_CATEGORIES } from '../lib/supabase'

export default function Recipes() {
  const { profile } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchRecipes() }, [])

  async function fetchRecipes() {
    const { data } = await supabase
      .from('recipes')
      .select('*, recipe_steps(*)')
      .eq('active', true)
      .order('category')
      .order('name')
    setRecipes((data || []).map(r => ({
      ...r,
      recipe_steps: (r.recipe_steps || []).sort((a, b) => a.sort_order - b.sort_order)
    })))
    setLoading(false)
  }

  const categories = ['all', ...Object.keys(RECIPE_CATEGORIES)]
  const filtered = activeCategory === 'all' ? recipes : recipes.filter(r => r.category === activeCategory)

  async function saveRecipe({ name, category, description, cup_size, steps }) {
    setSaving(true)
    const { data: recipe } = await supabase
      .from('recipes')
      .insert({ name, category, description, cup_size })
      .select().single()

    if (recipe && steps.length > 0) {
      await supabase.from('recipe_steps').insert(
        steps.map((s, i) => ({ recipe_id: recipe.id, sort_order: i + 1, label: s.label, detail: s.detail || null, value: s.value || null }))
      )
    }
    await fetchRecipes()
    setSaving(false)
    setModal(false)
  }

  async function deleteRecipe(id) {
    await supabase.from('recipes').update({ active: false }).eq('id', id)
    setRecipes(r => r.filter(x => x.id !== id))
    if (expanded === id) setExpanded(null)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
      <Spinner size={32} />
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="page-title">Recettes</h1>
            <p className="page-subtitle">Standards de préparation & grammages</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={15} /> Nouvelle recette
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* CATEGORY TABS */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {categories.map(cat => {
            const label = cat === 'all' ? 'Toutes' : `${RECIPE_CATEGORIES[cat]?.icon} ${RECIPE_CATEGORIES[cat]?.label}`
            return (
              <button key={cat}
                className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveCategory(cat)}>
                {label}
              </button>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <EmptyState icon="☕" title="Aucune recette" description="Ajoute ta première recette pour l'équipe."
            action={<button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Nouvelle recette</button>} />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(recipe => {
            const isOpen = expanded === recipe.id
            const cat = RECIPE_CATEGORIES[recipe.category]
            return (
              <div key={recipe.id} className="card">
                <div
                  style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : recipe.id)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--brown-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    {cat?.icon || '☕'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{recipe.name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'flex', gap: '10px', marginTop: '2px' }}>
                      {recipe.cup_size && <span>📐 {recipe.cup_size}</span>}
                      {recipe.description && <span>{recipe.description}</span>}
                      <span>{recipe.recipe_steps.length} étape{recipe.recipe_steps.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <Badge color="gray">{cat?.label}</Badge>
                  {isOpen ? <ChevronUp size={18} color="var(--muted)" /> : <ChevronDown size={18} color="var(--muted)" />}
                </div>

                {isOpen && (
                  <div style={{ padding: '0 1.5rem 1.25rem', borderTop: '1px solid var(--brown-100)' }}>
                    <div style={{ paddingTop: '0.75rem' }}>
                      {recipe.recipe_steps.length === 0 && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Aucune étape définie.</p>
                      )}
                      {recipe.recipe_steps.map(step => (
                        <div key={step.id} className="recipe-step">
                          <div className="step-num">{step.sort_order}</div>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{step.label}</div>
                            {step.detail && <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>{step.detail}</div>}
                            {step.value && <div className="step-value">{step.value}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {profile?.role === 'manager' && (
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--brown-50)', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                          onClick={() => deleteRecipe(recipe.id)}>
                          <Trash2 size={14} /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {modal && (
        <RecipeModal onClose={() => setModal(false)} onSave={saveRecipe} saving={saving} />
      )}
    </>
  )
}

function RecipeModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState({ name: '', category: 'espresso', description: '', cup_size: '' })
  const [steps, setSteps] = useState([{ label: '', detail: '', value: '' }])
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const addStep = () => setSteps(s => [...s, { label: '', detail: '', value: '' }])
  const updateStep = (i, k, v) => setSteps(s => s.map((x, j) => j === i ? { ...x, [k]: v } : x))
  const removeStep = (i) => setSteps(s => s.filter((_, j) => j !== i))

  return (
    <Modal
      open
      onClose={onClose}
      title="Nouvelle recette"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.name || saving}
            onClick={() => onSave({ ...form, steps: steps.filter(s => s.label) })}>
            {saving ? <Spinner size={16} /> : <Save size={15} />}
            Créer la recette
          </button>
        </>
      }
    >
      <div className="form-group">
        <label className="form-label">Nom</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Flat White" autoFocus />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Catégorie</label>
          <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
            {Object.entries(RECIPE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Volume / taille</label>
          <input className="form-input" value={form.cup_size} onChange={e => set('cup_size', e.target.value)} placeholder="ex: 160ml" />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description courte</label>
        <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="ex: Double ristretto, micro-mousse veloutée" />
      </div>

      <div style={{ borderTop: '1px solid var(--brown-100)', paddingTop: '1rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span className="form-label" style={{ margin: 0 }}>Étapes de préparation</span>
          <button className="btn btn-ghost btn-sm" onClick={addStep}><Plus size={14} /> Étape</button>
        </div>
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <input className="form-input" placeholder={`Étape ${i + 1}`} value={step.label}
              onChange={e => updateStep(i, 'label', e.target.value)} />
            <input className="form-input" placeholder="Valeur (ex: 18g)" value={step.value}
              onChange={e => updateStep(i, 'value', e.target.value)} />
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeStep(i)}
              style={{ color: 'var(--danger)' }} disabled={steps.length === 1}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
