// admin — Supabase Edge Function (Deno). Internal ops dashboard backend.
//
// Every call verifies the caller is an admin (users.is_admin) using the service
// role, then either returns an overview or applies a kanban move. Only admins
// can reach any of this; the service role bypasses RLS to see all tenants.
//
//   { action: 'overview' }
//   { action: 'set_vendor_status', id, value }      // pending|active|paused
//   { action: 'set_booking_status', id, value }     // requested|confirmed|completed|cancelled
//   { action: 'set_sitter_status', id, value, verified? }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const body = await req.json().catch(() => ({}))
    const action = body.action ?? 'overview'

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: me } = await admin
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
    if (!me?.is_admin) return json({ error: 'Forbidden' }, 403)

    if (action === 'set_vendor_status') {
      await admin.from('vendors').update({ status: body.value }).eq('id', body.id)
      return json({ ok: true })
    }
    if (action === 'set_booking_status') {
      await admin.from('bookings').update({ status: body.value }).eq('id', body.id)
      return json({ ok: true })
    }
    if (action === 'set_sitter_status') {
      const patch: Record<string, unknown> = { background_check_status: body.value }
      if (typeof body.verified === 'boolean') {
        patch.verified = body.verified
        patch.listed = body.verified
      }
      await admin.from('sitter_profiles').update(patch).eq('id', body.id)
      return json({ ok: true })
    }

    // ---- overview ----
    const [usersC, petsC, vendors, bookings, sitters, pets] = await Promise.all([
      admin.from('users').select('id', { count: 'exact', head: true }),
      admin.from('pets').select('id', { count: 'exact', head: true }),
      admin
        .from('vendors')
        .select('id, name, category, status, member_discount_pct, location, created_at')
        .order('created_at', { ascending: false }),
      admin
        .from('bookings')
        .select('id, status, amount, commission, vendor_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200),
      admin
        .from('sitter_profiles')
        .select('id, display_name, background_check_status, verified, location, created_at')
        .order('created_at', { ascending: false }),
      admin.from('pets').select('breed, birthdate, sex, neutered').limit(5000),
    ])

    // Aggregate the audience — the targetable data asset (never per-individual).
    function stageOf(birthdate: string | null): string {
      if (!birthdate) return 'unknown'
      const y = (Date.now() - new Date(birthdate).getTime()) / (365.25 * 864e5)
      if (isNaN(y)) return 'unknown'
      if (y < 1) return 'puppy'
      if (y < 3) return 'adolescent'
      if (y < 8) return 'adult'
      return 'senior'
    }
    const petRows = pets.data ?? []
    const tally = (key: (p: Record<string, unknown>) => string) => {
      const out: Record<string, number> = {}
      for (const p of petRows) {
        const k = key(p) || 'unknown'
        out[k] = (out[k] ?? 0) + 1
      }
      return out
    }
    const audience = {
      total: petRows.length,
      by_stage: tally((p) => stageOf(p.birthdate as string | null)),
      by_sex: tally((p) => (p.sex as string) ?? 'unknown'),
      by_neuter: tally((p) =>
        p.neutered === true ? 'neutered' : p.neutered === false ? 'intact' : 'unknown',
      ),
      top_breeds: Object.entries(tally((p) => ((p.breed as string) || 'Unknown').trim()))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    }

    const bk = bookings.data ?? []
    const gmv = bk
      .filter((b) => b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.amount || 0), 0)
    const commission = bk
      .filter((b) => b.status !== 'cancelled')
      .reduce((s, b) => s + Number(b.commission || 0), 0)

    return json({
      metrics: {
        members: usersC.count ?? 0,
        pets: petsC.count ?? 0,
        vendors: (vendors.data ?? []).length,
        active_vendors: (vendors.data ?? []).filter((v) => v.status === 'active').length,
        bookings: bk.length,
        gmv: Math.round(gmv * 100) / 100,
        commission: Math.round(commission * 100) / 100,
      },
      vendors: vendors.data ?? [],
      bookings: bk,
      sitters: sitters.data ?? [],
      audience,
    })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
