// device-ingest — Supabase Edge Function (Deno), verify_jwt = false.
//
// The endpoint a physical wearable POSTs telemetry to. Auth is the device's own
// ingest_key (not a user login), so firmware can push without a user session.
//
// Body: { ingest_key, day?, metrics: { steps, distance_m, active_minutes,
//   rest_minutes, sleep_minutes, avg_heart_rate, avg_resp_rate, water_ml,
//   food_g, scratch_events, limp_score, play_minutes } }
//
// Upserts the day's rollup for the device's pet and stamps last_seen_at.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const FIELDS = [
  'steps', 'distance_m', 'active_minutes', 'rest_minutes', 'sleep_minutes',
  'avg_heart_rate', 'avg_resp_rate', 'water_ml', 'food_g', 'scratch_events',
  'limp_score', 'play_minutes',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const body = await req.json()
    const ingest_key = body.ingest_key
    if (!ingest_key) return json({ error: 'ingest_key required' }, 400)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: device } = await admin
      .from('devices')
      .select('id, pet_id')
      .eq('ingest_key', ingest_key)
      .maybeSingle()
    if (!device) return json({ error: 'Unknown device' }, 401)

    const metrics = body.metrics ?? {}
    const row: Record<string, unknown> = {
      pet_id: device.pet_id,
      device_id: device.id,
      day: body.day ?? new Date().toISOString().slice(0, 10),
    }
    for (const f of FIELDS) if (metrics[f] != null) row[f] = metrics[f]

    const { error } = await admin
      .from('device_daily')
      .upsert(row, { onConflict: 'pet_id,day' })
    if (error) return json({ error: 'Could not store telemetry' }, 500)

    await admin
      .from('devices')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', device.id)

    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
