import { createContext, useContext, useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Helper — true if role has at least the requested level
// admin > manager > barista
export function hasRole(profile, minRole) {
  if (Array.isArray(minRole)) return minRole.includes(profile?.role)
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
    const { data, error } = await supabase.functions.invoke('manage-team-user', {
      body: { action: 'create', name, role, pin },
    })
    return { user: data?.user || null, error: await functionError(error, data) }
  }

  async function resetUserPin(userId, pin) {
    const { data, error } = await supabase.functions.invoke('manage-team-user', {
      body: { action: 'reset-pin', userId, pin },
    })
    return { data, error: await functionError(error, data) }
  }

  async function deleteTeamUser(userId) {
    const { data, error } = await supabase.functions.invoke('manage-team-user', {
      body: { action: 'delete', userId },
    })
    return { data, error: await functionError(error, data) }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, signUpWithPin, resetUserPin, deleteTeamUser, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

async function functionError(error, data) {
  if (data?.error) return new Error(data.error)
  if (!error) return null

  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json()
      if (payload?.error) return new Error(payload.error)
    } catch (_) {
      // Fall back to the SDK message if the response body is not JSON.
    }
  }

  return error
}
