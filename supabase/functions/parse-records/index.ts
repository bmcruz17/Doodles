// Smart record parser — Supabase Edge Function (Deno).
//
// Request:  { pet_id: string, path: string }
//   `path` is a storage object already uploaded to the private `pet-documents`
//   bucket (PDF or image of a vet record / vaccination certificate / lab).
// Response: { summary: string, added: { vaccinations: number, records: number },
//             items: Array<{ kind, label }> }
//
// Flow: verify the caller owns the pet (RLS), download the document with the
// service role, hand it to Claude as a document/image block, and force a
// structured tool call that returns vaccinations + health records. We then
// insert those rows into the correct pet's vault, linking each back to the
// source document. The Anthropic key never leaves the server.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'

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

const RECORD_TYPES = [
  'vet_visit',
  'medication',
  'allergy',
  'weight_log',
  'lab_result',
  'note',
] as const

// The structured shape we force Claude to return.
const EXTRACT_TOOL = {
  name: 'save_extracted_records',
  description:
    'Save the structured veterinary data extracted from the document into the ' +
    "pet's health vault. Only include items actually present in the document.",
  input_schema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description:
          'One or two plain-language sentences describing what this document is ' +
          'and what was extracted, for the owner.',
      },
      vaccinations: {
        type: 'array',
        description: 'Vaccines administered, one entry per shot.',
        items: {
          type: 'object',
          properties: {
            vaccine: { type: 'string', description: 'e.g. Rabies, DHPP, Bordetella' },
            administered_at: {
              type: 'string',
              description: 'Date given in YYYY-MM-DD, or empty string if unknown.',
            },
            expires_at: {
              type: 'string',
              description:
                'Expiration / next-due date in YYYY-MM-DD, or empty string if not stated.',
            },
            veterinarian: {
              type: 'string',
              description: 'Vet or clinic name, or empty string.',
            },
          },
          required: ['vaccine', 'administered_at', 'expires_at', 'veterinarian'],
        },
      },
      records: {
        type: 'array',
        description:
          'Other health events: vet visits, medications, allergies, weight logs, ' +
          'lab results, or notes.',
        items: {
          type: 'object',
          properties: {
            record_type: { type: 'string', enum: RECORD_TYPES },
            title: { type: 'string' },
            notes: {
              type: 'string',
              description: 'Relevant details: findings, dosages, values, instructions.',
            },
            recorded_at: {
              type: 'string',
              description: 'Date of the event in YYYY-MM-DD, or empty string if unknown.',
            },
          },
          required: ['record_type', 'title', 'notes', 'recorded_at'],
        },
      },
    },
    required: ['summary', 'vaccinations', 'records'],
  },
}

function mediaTypeFor(path: string, blobType: string): { kind: 'image' | 'pdf'; media: string } | null {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf' || blobType === 'application/pdf') return { kind: 'pdf', media: 'application/pdf' }
  if (ext === 'png' || blobType === 'image/png') return { kind: 'image', media: 'image/png' }
  if (['jpg', 'jpeg'].includes(ext) || blobType === 'image/jpeg')
    return { kind: 'image', media: 'image/jpeg' }
  if (ext === 'webp' || blobType === 'image/webp') return { kind: 'image', media: 'image/webp' }
  if (ext === 'gif' || blobType === 'image/gif') return { kind: 'image', media: 'image/gif' }
  return null
}

function isoOrNull(d: string): string | null {
  const s = (d || '').trim()
  if (!s) return null
  const date = new Date(s)
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const { pet_id, path } = await req.json()
    if (!pet_id || !path) return json({ error: 'pet_id and path are required' }, 400)

    // Caller-scoped client: confirm the user owns this pet AND that the storage
    // path lives under their own folder (paths are `${uid}/${petId}/...`).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    if (!String(path).startsWith(`${user.id}/`)) {
      return json({ error: 'Forbidden' }, 403)
    }

    const { data: pet, error: petErr } = await userClient
      .from('pets')
      .select('id, name')
      .eq('id', pet_id)
      .single()
    if (petErr || !pet) return json({ error: 'Pet not found' }, 404)

    // Service role to read the private object and write the extracted rows.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: blob, error: dlErr } = await admin.storage
      .from('pet-documents')
      .download(path)
    if (dlErr || !blob) return json({ error: 'Could not read the document' }, 404)

    const mt = mediaTypeFor(path, blob.type)
    if (!mt) {
      return json(
        { error: 'Unsupported file type. Upload a PDF, JPG, PNG, or WEBP.' },
        415,
      )
    }

    const bytes = new Uint8Array(await blob.arrayBuffer())
    const b64 = encodeBase64(bytes)

    const documentBlock =
      mt.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: mt.media, data: b64 } }
        : { type: 'image', source: { type: 'base64', media_type: mt.media, data: b64 } }

    const system = [
      'You are a veterinary records parser. The user uploaded a document about',
      `their dog "${pet.name}". Extract every vaccination and health event you can`,
      'read into the structured tool. Use YYYY-MM-DD for dates; if a date or field',
      'is not present, use an empty string — never guess. Classify non-vaccine',
      'events with the closest record_type. If the document is unreadable or not a',
      'pet medical record, return empty arrays and explain that in the summary.',
      'Always respond by calling the save_extracted_records tool.',
    ].join(' ')

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 2048,
        system,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: 'tool', name: 'save_extracted_records' },
        messages: [
          {
            role: 'user',
            content: [
              documentBlock,
              {
                type: 'text',
                text: 'Extract all vaccinations and health records from this document.',
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text()
      console.error('Anthropic error', anthropicRes.status, detail)
      return json({ error: 'AI service error' }, 502)
    }

    const completion = await anthropicRes.json()
    const toolUse = (completion?.content ?? []).find(
      (c: { type: string }) => c.type === 'tool_use',
    )
    const extracted = toolUse?.input ?? { summary: '', vaccinations: [], records: [] }

    const vaccinations: Array<Record<string, string>> = Array.isArray(extracted.vaccinations)
      ? extracted.vaccinations
      : []
    const records: Array<Record<string, string>> = Array.isArray(extracted.records)
      ? extracted.records
      : []

    const items: Array<{ kind: string; label: string }> = []

    if (vaccinations.length) {
      const rows = vaccinations
        .filter((v) => v.vaccine?.trim())
        .map((v) => ({
          pet_id,
          vaccine: v.vaccine.trim(),
          administered_at: isoOrNull(v.administered_at) ?? new Date().toISOString().slice(0, 10),
          expires_at: isoOrNull(v.expires_at),
          veterinarian: v.veterinarian?.trim() || null,
          certificate_url: path,
        }))
      if (rows.length) {
        const { error } = await admin.from('vaccinations').insert(rows)
        if (error) console.error('vaccination insert', error)
        else rows.forEach((r) => items.push({ kind: 'vaccination', label: r.vaccine }))
      }
    }

    if (records.length) {
      const rows = records
        .filter((r) => RECORD_TYPES.includes(r.record_type as (typeof RECORD_TYPES)[number]))
        .map((r) => ({
          pet_id,
          record_type: r.record_type,
          data: { title: r.title?.trim() || 'Imported record', notes: r.notes?.trim() || '' },
          document_url: path,
          recorded_at: (isoOrNull(r.recorded_at)
            ? new Date(isoOrNull(r.recorded_at) as string)
            : new Date()
          ).toISOString(),
        }))
      if (rows.length) {
        const { error } = await admin.from('health_records').insert(rows)
        if (error) console.error('record insert', error)
        else
          rows.forEach((r) =>
            items.push({ kind: r.record_type, label: (r.data.title as string) || 'Record' }),
          )
      }
    }

    return json({
      summary:
        typeof extracted.summary === 'string' && extracted.summary.trim()
          ? extracted.summary.trim()
          : items.length
            ? `Added ${items.length} item(s) to ${pet.name}'s vault.`
            : `Couldn't find any vaccinations or health records in that document.`,
      added: {
        vaccinations: items.filter((i) => i.kind === 'vaccination').length,
        records: items.filter((i) => i.kind !== 'vaccination').length,
      },
      items,
    })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
