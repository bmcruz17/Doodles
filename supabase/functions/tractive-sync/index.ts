// tractive-sync — Supabase Edge Function (Deno).
//
// Connects a Tractive GPS/activity tracker and syncs its data into our
// device_daily table, so the PackHub dashboard + AI work with live wearable
// data before our own band ships. Targets Tractive's (unofficial) API — the
// auth + trackers shapes are stable (used by the Home Assistant integration);
// the activity field names are mapped defensively and may need tweaks once
// tested against a real account.
//
// Request:
//   { pet_id, email, password }  -> connect + sync (stores the session token)
//   { pet_id }                   -> re-sync using the stored token
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const TRACTIVE_BASE = 'https://graph.tractive.com/4'
const TRACTIVE_CLIENT = '625e533dc3c3b41c28a669f0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function tHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'x-tractive-client': TRACTIVE_CLIENT,
    'content-type': 'application/json',
    accept: 'application/json',
  }
  if (token) h['authorization'] = `Bearer ${token}`
  return h
}

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { pet_id, email, password } = await req.json()
    if (!pet_id) return json({ error: 'pet_id required' }, 400)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: pet } = await userClient.from('pets').select('id').eq('id', pet_id).single()
    if (!pet) return json({ error: 'Pet not found' }, 404)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Existing Tractive device for this pet?
    const { data: existing } = await admin
      .from('devices')
      .select('*')
      .eq('pet_id', pet_id)
      .eq('provider', 'tractive')
      .maybeSingle()

    let token: string | undefined = existing?.external_token ?? undefined
    let userId: string | undefined = existing?.external_user_id ?? undefined
    let trackerId: string | undefined = existing?.external_tracker_id ?? undefined
    let deviceId = existing?.id as string | undefined

    // (Re)authenticate when credentials are supplied.
    if (email && password) {
      const authRes = await fetch(`${TRACTIVE_BASE}/auth/token`, {
        method: 'POST',
        headers: tHeaders(),
        body: JSON.stringify({
          platform_email: email,
          platform_token: password,
          grant_type: 'tractive',
        }),
      })
      if (!authRes.ok) {
        return json({ error: 'Tractive login failed. Check your email/password.' }, 401)
      }
      const auth = await authRes.json()
      token = auth.access_token
      userId = auth.user_id
    }

    if (!token || !userId) {
      return json({ status: 'needs_connect', message: 'Enter your Tractive login to connect.' }, 200)
    }

    // Resolve a tracker if we don't have one yet.
    if (!trackerId) {
      const tr = await fetch(`${TRACTIVE_BASE}/user/${userId}/trackers`, { headers: tHeaders(token) })
      if (tr.ok) {
        const list = await tr.json()
        trackerId = Array.isArray(list) && list[0]?._id ? String(list[0]._id) : undefined
      }
    }
    if (!trackerId) {
      return json({ error: 'No Tractive tracker found on that account.' }, 404)
    }

    // Upsert the device row (store the session for future syncs).
    if (deviceId) {
      await admin.from('devices').update({
        external_token: token,
        external_user_id: userId,
        external_tracker_id: trackerId,
        last_seen_at: new Date().toISOString(),
      }).eq('id', deviceId)
    } else {
      const { data: dev } = await admin.from('devices').insert({
        pet_id,
        owner_id: user.id,
        name: 'Tractive tracker',
        kind: 'tractive',
        provider: 'tractive',
        external_token: token,
        external_user_id: userId,
        external_tracker_id: trackerId,
        last_seen_at: new Date().toISOString(),
      }).select('id').single()
      deviceId = dev?.id
    }

    // Pull recent activity and map to daily rows (defensive field mapping).
    let synced = 0
    try {
      const act = await fetch(`${TRACTIVE_BASE}/tracker/${trackerId}/activity`, {
        headers: tHeaders(token),
      })
      if (act.ok) {
        const payload = await act.json()
        const days: Record<string, unknown>[] = Array.isArray(payload) ? payload : [payload]
        for (const d of days) {
          const day = (d.date ?? d.time_local ?? new Date().toISOString()).toString().slice(0, 10)
          const row: Record<string, unknown> = { pet_id, device_id: deviceId, day }
          const stepsV = num(d.steps ?? d.activity_steps)
          const activeV = num(d.minutes_active ?? d.active_minutes)
          const restV = num(d.minutes_rest ?? d.rest_minutes)
          const sleepV = num(d.minutes_sleep ?? d.sleep ?? d.sleep_minutes)
          const distV = num(d.distance ?? d.distance_m)
          if (stepsV != null) row.steps = stepsV
          if (activeV != null) row.active_minutes = activeV
          if (restV != null) row.rest_minutes = restV
          if (sleepV != null) row.sleep_minutes = sleepV
          if (distV != null) row.distance_m = distV
          if (Object.keys(row).length > 3) {
            await admin.from('device_daily').upsert(row, { onConflict: 'pet_id,day' })
            synced++
          }
        }
      }
    } catch (e) {
      console.error('tractive activity', e)
    }

    return json({
      status: 'connected',
      synced,
      message:
        synced > 0
          ? `Synced ${synced} day(s) from Tractive.`
          : 'Tracker connected. Activity data will appear as Tractive reports it.',
    })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
