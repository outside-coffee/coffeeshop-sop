import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Helper — true if role has at least the requested level
// admin > manager > barista
export function hasRole(profile, minRole) {
  const levels = { barista: 0, manager: 1, admin: 2 }
  const userLevel = levels[profile?.role] ?? -1
  const required = levels[minRole] ?? 0
  return userLevel >= required
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUpWithPin(name, role, pin) {
    // Generate fake email invisible to user
    const slug      = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const rand      = Math.random().toString(36).slice(2, 6)
    const fakeEmail = `${slug}.${rand}@outside.app`
    const fakeId    = crypto.randomUUID ? crypto.randomUUID().slice(0,8) : rand

    const { data, error } = await supabase.auth.signUp({
      email:    fakeEmail,
      password: `PIN_${pin}_${fakeId}`,
    })
    if (error) return { error }

    if (data.user) {
      const colors = ['#C8956C','#4A7C59','#3D5A8A','#8B6B8A','#D4A853','#B04A3A']
      const color  = colors[Math.floor(Math.random() * colors.length)]
      // Store pin as plain for lookup (or hash if needed)
      await supabase.from('profiles').insert({
        id:          data.user.id,
        name,
        role,
        avatar_color: color,
        fake_email:  fakeEmail,
        pin_code:    pin,
      })
      // Re-fetch to get the real id for password
      await supabase.from('profiles').update({
        fake_email: fakeEmail.replace(fakeId, data.user.id.slice(0,8))
      }).eq('id', data.user.id)
      // Update auth password with real user id
      // (handled at login time via profile lookup)
    }
    return { error: null, fakeEmail }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, signUpWithPin, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
