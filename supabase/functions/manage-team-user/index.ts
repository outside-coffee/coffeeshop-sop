import { createClient } from 'npm:@supabase/supabase-js@2.117.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4}$/.test(pin)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = req.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentification requise' }, 401)

    const token = authorization.slice(7)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser(token)
    if (callerError || !caller) return json({ error: 'Session invalide' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    const { data: callerProfile, error: profileError } = await admin
      .from('profiles').select('role').eq('id', caller.id).single()
    if (profileError || callerProfile?.role !== 'admin') return json({ error: 'Accès administrateur requis' }, 403)

    const body = await req.json()
    const action = body?.action

    if (action === 'create') {
      const name = String(body?.name || '').trim()
      const role = String(body?.role || '')
      const pin = body?.pin
      if (!name || !['admin', 'manager', 'barista'].includes(role) || !validPin(pin)) {
        return json({ error: 'Nom, rôle ou PIN invalide' }, 400)
      }

      const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '').slice(0, 30) || 'membre'
      const suffix = crypto.randomUUID().slice(0, 8)
      const email = `${slug}.${suffix}@outside.invalid`
      const temporaryPassword = `${crypto.randomUUID()}-${crypto.randomUUID()}`
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      })
      if (createError || !created.user) return json({ error: createError?.message || 'Création impossible' }, 400)

      const userId = created.user.id
      const password = `PIN_${pin}_${userId.slice(0, 8)}`
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, { password })
      if (passwordError) {
        await admin.auth.admin.deleteUser(userId)
        return json({ error: passwordError.message }, 400)
      }

      const colors = ['#C8956C','#4A7C59','#3D5A8A','#8B6B8A','#D4A853','#B04A3A']
      const { error: insertError } = await admin.from('profiles').upsert({
        id: userId,
        name,
        role,
        avatar_color: colors[Math.floor(Math.random() * colors.length)],
        fake_email: email,
        pin_code: pin,
        actif: true,
      })
      if (insertError) {
        await admin.auth.admin.deleteUser(userId)
        return json({ error: insertError.message }, 400)
      }
      return json({ user: { id: userId, email } })
    }

    const userId = String(body?.userId || '')
    if (!userId) return json({ error: 'Utilisateur manquant' }, 400)

    if (action === 'reset-pin') {
      const pin = body?.pin
      if (!validPin(pin)) return json({ error: 'Le PIN doit contenir exactement 4 chiffres' }, 400)
      const password = `PIN_${pin}_${userId.slice(0, 8)}`
      const { error: authError } = await admin.auth.admin.updateUserById(userId, { password })
      if (authError) return json({ error: authError.message }, 400)
      const { error: updateError } = await admin.from('profiles').update({ pin_code: pin }).eq('id', userId)
      if (updateError) return json({ error: updateError.message }, 400)
      return json({ success: true })
    }

    if (action === 'delete') {
      if (userId === caller.id) return json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, 400)
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
      if (deleteError) return json({ error: deleteError.message }, 400)
      await admin.from('profiles').delete().eq('id', userId)
      return json({ success: true })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Erreur interne' }, 500)
  }
})
