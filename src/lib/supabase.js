import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars — check your .env file')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

export const SHIFTS = {
  morning: 'Matin (6h–14h)',
  afternoon: 'Après-midi (12h–20h)',
  full: 'Journée (8h–17h)',
}

export const STOCK_CATEGORIES = {
  coffee: { label: 'Café', color: '#6B3E2E' },
  milk: { label: 'Laits', color: '#D4A853' },
  consumables: { label: 'Consommables', color: '#4A7C59' },
  cleaning: { label: 'Nettoyage', color: '#3D5A8A' },
  other: { label: 'Autre', color: '#7A6E65' },
}

export const RECIPE_CATEGORIES = {
  espresso: { label: 'Espresso', icon: '☕' },
  milk: { label: 'Lait', icon: '🥛' },
  cold: { label: 'Froid', icon: '🧊' },
  food: { label: 'Food', icon: '🥐' },
}
