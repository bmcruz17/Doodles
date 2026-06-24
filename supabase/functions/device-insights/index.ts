// device-insights — Supabase Edge Function (Deno).
//
// Request: { pet_id }   Response: { summary, alerts: [{severity,title,detail}] }
//
// Reads the pet's recent wearable daily rollups + profile, asks Claude to
// interpret the trends (breed-aware: limping/hip risk, scratching, resting HR
// and respiratory drift, sleep/activity changes, hydration/appetite), and
// writes the flagged items into device_alerts for the health dashboard.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ANTHROPIC_MODEL = 'claude-opus-4-8'
const ANTHROPIC_VERSION = '2023-06-01'

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

const TOOL = {
  name: 'report_health_signals',
  description: 'Report interpreted health signals from the wearable data.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Plain-language overview for the owner (2-3 sentences).' },
      alerts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['info', 'watch', 'urgent'] },
            title: { type: 'string' },
            detail: { type: 'string', description: 'What was observed and what to do.' },
          },
          required: ['severity', 'title', 'detail'],
        },
      },
    },
    required: ['summary', 'alerts'],
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { pet_id } = await req.json()
    if (!pet_id) return json({ error: 'pet_id required' }, 400)

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: pet } = await userClient.from('pets').select('*').eq('id', pet_id).single()
    if (!pet) return json({ error: 'Pet not found' }, 404)

    const { data: daily } = await userClient
      .from('device_daily')
      .select('*')
      .eq('pet_id', pet_id)
      .order('day', { ascending: false })
      .limit(30)
    if (!daily || daily.length === 0) {
      return json({ summary: 'No wearable data yet.', alerts: [] })
    }

    const profile = {
      name: pet.name,
      breed: pet.breed,
      birthdate: pet.birthdate,
      weight_lbs: pet.weight_lbs,
      neutered: pet.neutered,
    }

    const system = [
      'You are a veterinary triage assistant interpreting a dog wearable\'s daily',
      'metrics. Spot meaningful trends and anomalies and report them via the tool.',
      'Be breed- and age-aware (e.g. hip/limp risk in large breeds, respiratory',
      'rate drift, resting heart rate, sleep/activity changes, scratching spikes',
      'suggesting allergies/skin, drops in water/food). severity: info = normal/',
      'positive note, watch = monitor + consider a vet soon, urgent = contact a vet',
      'promptly. Never diagnose definitively; always recommend a vet for urgent or',
      'health-critical findings. Keep it specific to the numbers you see.',
    ].join(' ')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'report_health_signals' },
        messages: [
          {
            role: 'user',
            content:
              `Dog profile:\n${JSON.stringify(profile, null, 2)}\n\n` +
              `Recent daily wearable data (newest first):\n${JSON.stringify(daily, null, 2)}`,
          },
        ],
      }),
    })
    if (!res.ok) {
      console.error('anthropic', res.status, await res.text())
      return json({ error: 'AI service error' }, 502)
    }
    const completion = await res.json()
    const tool = (completion?.content ?? []).find((c: { type: string }) => c.type === 'tool_use')
    const out = tool?.input ?? { summary: '', alerts: [] }
    const alerts: Array<{ severity: string; title: string; detail: string }> = Array.isArray(out.alerts)
      ? out.alerts
      : []

    // Replace prior unacknowledged AI alerts with the fresh set.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await admin.from('device_alerts').delete().eq('pet_id', pet_id).eq('acknowledged', false)
    if (alerts.length) {
      await admin.from('device_alerts').insert(
        alerts.map((a) => ({
          pet_id,
          severity: ['info', 'watch', 'urgent'].includes(a.severity) ? a.severity : 'info',
          title: a.title?.slice(0, 200) ?? 'Signal',
          detail: a.detail ?? '',
        })),
      )
    }

    return json({ summary: out.summary ?? '', alerts })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
