import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars — check your .env file')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export const SHIFTS = {
  morning: 'Matin (6h-14h)',
  afternoon: 'Apres-midi (12h-20h)',
  full: 'Journee (8h-17h)',
}

// Catégories qui correspondent exactement aux catégories de matiere_premiere
export const STOCK_CATEGORIES = {
  'Cafe':            { label: 'Cafe',             color: '#6B3E2E' },
  'Lait':            { label: 'Lait',             color: '#D4A853' },
  'Fruit frais':     { label: 'Fruit frais',      color: '#4A7C59' },
  'Sirop':           { label: 'Sirop',            color: '#3D5A8A' },
  'Pate a tartiner': { label: 'Pate a tartiner',  color: '#8B6B8A' },
  'Topping':         { label: 'Topping',          color: '#B04A3A' },
  'Jus':             { label: 'Jus',              color: '#2D8A5A' },
  'Glace':           { label: 'Glace',            color: '#3D8A8A' },
  'Soda':            { label: 'Soda',             color: '#5A6B8A' },
  'Sucre':           { label: 'Sucre',            color: '#C8956C' },
  'Eau':             { label: 'Eau',              color: '#5A9AB0' },
  'Biscuit':         { label: 'Biscuit',          color: '#9A7B5A' },
  'cleaning':        { label: 'Nettoyage',        color: '#7A6E65' },
  'other':           { label: 'Autre',            color: '#7A6E65' },
}

export const RECIPE_CATEGORIES = {
  espresso: { label: 'Espresso', icon: 'espresso' },
  milk:     { label: 'Lait',     icon: 'milk'     },
  cold:     { label: 'Froid',    icon: 'cold'     },
  food:     { label: 'Food',     icon: 'food'     },
}
