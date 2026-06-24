// AI Companion — Supabase Edge Function (Deno).
//
// Request:  { pet_id: string, message: string }
// Response: { reply: string }
//
// Loads the pet's profile + recent health records, builds a dog-care expert
// system prompt grounded in that specific dog, calls the Anthropic Claude API
// (server-side — the key never reaches the client), appends the exchange to
// ai_conversations.messages, and returns the reply.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ANTHROPIC_MODEL = 'claude-opus-4-8'
const ANTHROPIC_VERSION = '2023-06-01'

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

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts?: string
}

const DISCLAIMER =
  'You are not a substitute for a licensed veterinarian. For anything ' +
  'urgent, abnormal, or health-critical, always tell the owner to contact ' +
  'their vet. Never give a definitive medical diagnosis.'

function buildSystemPrompt(pet: Record<string, unknown>, records: string): string {
  return [
    'You are the AI Companion, a warm, knowledgeable expert on dog care across',
    'all breeds and mixes — from Goldendoodles to German Shepherds to rescue',
    'mutts. You tailor advice to the specific breed, size, age, and coat of the',
    'dog in question: coat types and grooming cycles, breed-common health',
    'conditions, temperament and training, exercise needs, and nutrition.',
    '',
    'You are speaking with the owner about THEIR specific dog. Ground every',
    "answer in this dog's actual profile and records below. If breed is missing",
    'or unknown, give sound general guidance and note where breed would change',
    "your answer. If the records don't contain something you'd need, say so and",
    'ask a clarifying question.',
    '',
    'If wearable data is present below, proactively reference concrete trends',
    "(e.g. Biscuit's scratching is up and activity is down this week) and tie",
    'your advice to what the numbers show.',
    '',
    `IMPORTANT: ${DISCLAIMER}`,
    '',
    '--- THIS DOG ---',
    JSON.stringify(pet, null, 2),
    '',
    '--- RECENT HEALTH RECORDS ---',
    records || '(no health records logged yet)',
  ].join('\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { pet_id, message } = await req.json()
    if (!pet_id || !message) {
      return json({ error: 'pet_id and message are required' }, 400)
    }

    // Caller-scoped client (RLS enforced) to verify the user owns this pet.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: pet, error: petErr } = await userClient
      .from('pets')
      .select('*')
      .eq('id', pet_id)
      .single()
    if (petErr || !pet) return json({ error: 'Pet not found' }, 404)

    const { data: records } = await userClient
      .from('health_records')
      .select('record_type, data, recorded_at')
      .eq('pet_id', pet_id)
      .order('recorded_at', { ascending: false })
      .limit(20)

    const { data: vaccinations } = await userClient
      .from('vaccinations')
      .select('vaccine, administered_at, expires_at')
      .eq('pet_id', pet_id)
      .order('administered_at', { ascending: false })
      .limit(20)

    const { data: deviceDaily } = await userClient
      .from('device_daily')
      .select('*')
      .eq('pet_id', pet_id)
      .order('day', { ascending: false })
      .limit(14)

    const { data: deviceAlerts } = await userClient
      .from('device_alerts')
      .select('severity, title, detail')
      .eq('pet_id', pet_id)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(10)

    const recordsText = [
      ...(records ?? []).map(
        (r) =>
          `- [${r.record_type}] ${new Date(r.recorded_at)
            .toISOString()
            .slice(0, 10)}: ${JSON.stringify(r.data)}`,
      ),
      ...(vaccinations ?? []).map(
        (v) =>
          `- [vaccination] ${v.vaccine}: given ${v.administered_at}` +
          (v.expires_at ? `, expires ${v.expires_at}` : ''),
      ),
    ].join('\n')

    const wearableText =
      deviceDaily && deviceDaily.length
        ? [
            '',
            '--- WEARABLE: last 14 daily summaries (newest first) ---',
            ...deviceDaily.map(
              (d) =>
                `- ${d.day}: steps ${d.steps ?? '-'}, HR ${d.avg_heart_rate ?? '-'}bpm, ` +
                `resp ${d.avg_resp_rate ?? '-'}/min, sleep ${d.sleep_minutes ?? '-'}min, ` +
                `scratch ${d.scratch_events ?? '-'}, limp ${d.limp_score ?? '-'}, ` +
                `water ${d.water_ml ?? '-'}ml, food ${d.food_g ?? '-'}g, play ${d.play_minutes ?? '-'}min`,
            ),
            ...(deviceAlerts && deviceAlerts.length
              ? [
                  '',
                  'Active AI health flags from the wearable:',
                  ...deviceAlerts.map((a) => `- [${a.severity}] ${a.title}: ${a.detail}`),
                ]
              : []),
          ].join('\n')
        : ''

    // Service-role client for reading/writing the conversation history.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: conv } = await admin
      .from('ai_conversations')
      .select('id, messages')
      .eq('pet_id', pet_id)
      .maybeSingle()

    const history: ChatMessage[] = (conv?.messages as ChatMessage[]) ?? []

    // Keep the request bounded — only send the recent turns to the model.
    const recentTurns = history.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(pet, recordsText + wearableText),
        messages: [...recentTurns, { role: 'user', content: message }],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text()
      console.error('Anthropic error', anthropicRes.status, detail)
      return json({ error: 'AI service error' }, 502)
    }

    const completion = await anthropicRes.json()
    const reply: string =
      completion?.content?.[0]?.text ?? "I'm not sure how to answer that yet."

    // Persist the exchange (append to the JSONB messages array).
    const now = new Date().toISOString()
    const updatedMessages: ChatMessage[] = [
      ...history,
      { role: 'user', content: message, ts: now },
      { role: 'assistant', content: reply, ts: now },
    ]

    if (conv) {
      await admin
        .from('ai_conversations')
        .update({ messages: updatedMessages })
        .eq('id', conv.id)
    } else {
      await admin
        .from('ai_conversations')
        .insert({ pet_id, messages: updatedMessages })
    }

    return json({ reply })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
