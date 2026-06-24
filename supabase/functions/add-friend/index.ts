// add-friend — Supabase Edge Function (Deno).
//
// Request:  { email: string }   Response: { status, message }
//
// Resolves the email to a member server-side (the users table is owner-scoped,
// so the client can't look people up), then creates a pending friend request —
// or, if that person already sent YOU one, accepts it. Names are snapshotted so
// both sides can render the connection without reading each other's profile.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function nameOf(row: { name: string | null; email: string } | null): string {
  if (!row) return 'Member'
  if (row.name && row.name.trim()) return row.name.trim()
  return row.email.split('@')[0]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { email } = await req.json()
    const target = String(email ?? '').trim().toLowerCase()
    if (!target) return json({ error: 'Email is required' }, 400)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    if (user.email?.toLowerCase() === target) {
      return json({ error: "That's your own email." }, 400)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: them } = await admin
      .from('users')
      .select('id, name, email')
      .ilike('email', target)
      .maybeSingle()
    if (!them) {
      return json(
        { status: 'not_member', message: 'No member with that email yet.' },
        404,
      )
    }

    const { data: me } = await admin
      .from('users')
      .select('id, name, email')
      .eq('id', user.id)
      .maybeSingle()

    const myName = nameOf(me)
    const theirName = nameOf(them)

    // Any existing edge in either direction?
    const { data: existing } = await admin
      .from('friendships')
      .select('*')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${them.id}),` +
          `and(requester_id.eq.${them.id},addressee_id.eq.${user.id})`,
      )
      .maybeSingle()

    if (existing) {
      if (existing.status === 'accepted') {
        return json({ status: 'already_friends', message: `You're already friends with ${theirName}.` })
      }
      // They already requested me → accept it.
      if (existing.requester_id === them.id) {
        await admin
          .from('friendships')
          .update({ status: 'accepted' })
          .eq('id', existing.id)
        return json({ status: 'accepted', message: `You and ${theirName} are now friends!` })
      }
      return json({ status: 'pending', message: `Request to ${theirName} is already pending.` })
    }

    const { error: insErr } = await admin.from('friendships').insert({
      requester_id: user.id,
      addressee_id: them.id,
      requester_name: myName,
      addressee_name: theirName,
      status: 'pending',
    })
    if (insErr) return json({ error: 'Could not send request' }, 500)

    return json({ status: 'sent', message: `Friend request sent to ${theirName}.` })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
