// beta-mail — Supabase Edge Function (Deno).
//
// Closes the waitlist loop. Three actions:
//
//   { action: 'welcome', email }   public  — confirmation after joining
//   { action: 'invite', limit }    admin   — sends the beta passcode to the
//                                            oldest un-invited rows
//   { action: 'status' }           admin   — is sending actually configured?
//
// Why `welcome` can be public without becoming a spam cannon: it only ever
// mails an address that is ALREADY on the waitlist, and only when welcomed_at
// is null, which it sets on success. So the worst an attacker can do is cause
// one email to an address that just asked us for one. It always answers
// {ok:true} regardless, so it can't be used to test whether an address is on
// the list.
//
// Deliverability: FROM must be on a Resend-verified domain. Set BETA_MAIL_FROM
// once hidonutman.com is verified; until then it falls back to Resend's
// onboarding sender, which only delivers to the Resend account owner.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM = Deno.env.get('BETA_MAIL_FROM') ?? 'PackHub <onboarding@resend.dev>'
const SITE = Deno.env.get('BETA_SITE_URL') ?? 'https://hidonutman.com'
const PASSCODE = Deno.env.get('BETA_PASSCODE') ?? 'goodboy2026'
const REPLY_TO = Deno.env.get('BETA_MAIL_REPLY_TO') ?? ''

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

function esc(s: unknown): string {
  return String(s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string),
  )
}

function greeting(name: string | null): string {
  const n = (name ?? '').trim()
  return n ? `Hi ${esc(n)},` : 'Hi there,'
}

/** One shared shell so both emails look like the same product. */
function shell(inner: string): string {
  return `<div style="background:#faf6ef;padding:28px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e4d3b4;border-radius:16px;padding:32px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#bd6709">
      Founding Pawthers
    </p>
    ${inner}
    <hr style="border:none;border-top:1px solid #f1e8d8;margin:28px 0 14px" />
    <p style="margin:0;font-size:12px;color:#a37e44">
      PackHub — care for every breed.
      <a href="${SITE}/privacy" style="color:#a37e44">Privacy</a> ·
      <a href="${SITE}/terms" style="color:#a37e44">Terms</a>
    </p>
  </div>
</div>`
}

function welcomeEmail(name: string | null, dogName: string | null) {
  const dog = (dogName ?? '').trim()
  return {
    subject: "You're on the list",
    html: shell(`
      <h1 style="margin:0 0 14px;font-size:24px;color:#382818">You're on the list.</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4f3b23">
        ${greeting(name)} thanks for putting your name down for the PackHub
        closed beta${dog ? ` — and give ${esc(dog)} a scratch from us` : ''}.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4f3b23">
        We're letting in the first <strong>100 Founding Pawthers</strong>, in the
        order people joined. When your spot comes up you'll get an invite from
        this address with the code to get in.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4f3b23">
        Founding members use everything free through the beta, and keep today's
        price for as long as they stay members. Nothing to pay, nothing to set up
        in the meantime.
      </p>
      <p style="margin:22px 0 0;font-size:14px;color:#6a4f2d">— The PackHub team</p>
    `),
  }
}

function inviteEmail(name: string | null) {
  return {
    subject: "Your PackHub beta invite is ready",
    html: shell(`
      <h1 style="margin:0 0 14px;font-size:24px;color:#382818">You're in.</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4f3b23">
        ${greeting(name)} your spot in the PackHub closed beta is open. Use this
        code at the door:
      </p>
      <p style="margin:0 0 20px;text-align:center">
        <span style="display:inline-block;background:#faf6ef;border:1px dashed #d2b888;border-radius:10px;padding:14px 26px;font-size:22px;font-weight:700;letter-spacing:.08em;color:#382818">
          ${esc(PASSCODE)}
        </span>
      </p>
      <p style="margin:0 0 22px;text-align:center">
        <a href="${SITE}" style="display:inline-block;background:#1a6fc0;color:#fff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:15px">
          Claim your founding spot →
        </a>
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4f3b23">
        Create an account and add your dog — takes about a minute. Your founding
        number is assigned the moment you sign up, and it's first come, first
        served from here.
      </p>
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#6a4f2d">
        It's a beta, so if something looks wrong, tell us — that's the whole
        reason you're in early. Just reply to this email.
      </p>
      <p style="margin:22px 0 0;font-size:14px;color:#6a4f2d">— The PackHub team</p>
    `),
  }
}

async function send(to: string, subject: string, html: string) {
  const payload: Record<string, unknown> = { from: FROM, to: [to], subject, html }
  if (REPLY_TO) payload.reply_to = REPLY_TO

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  const text = await r.text()
  // Keep the vendor's own body — it names the case (unverified domain,
  // restricted key, suppressed address) far better than any guess here.
  return { ok: r.ok, status: r.status, detail: text.slice(0, 500) }
}

/** Shared admin gate for the actions that are not public. */
async function requireAdmin(req: Request, admin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
  } = await userClient.auth.getUser()
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401)

  const { data: me } = await admin
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!me?.is_admin) return json({ ok: false, error: 'Forbidden' }, 403)

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)
  if (!RESEND_API_KEY) return json({ ok: false, error: 'RESEND_API_KEY not set' }, 500)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const action = String(body.action ?? 'welcome')

  // ---- welcome: public, idempotent, non-enumerating -----------------------
  if (action === 'welcome') {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!email) return json({ ok: true })

    // Exact match, never ilike: `%` in a caller-supplied address would be a
    // wildcard and could match an arbitrary un-welcomed row, mailing a
    // stranger. joinWaitlist() already lowercases on insert, so eq is right.
    const { data: row } = await admin
      .from('waitlist')
      .select('id, email, name, dog_name, welcomed_at')
      .eq('email', email)
      .is('welcomed_at', null)
      .maybeSingle()

    // Already welcomed, or not on the list: say nothing either way.
    if (!row) return json({ ok: true })

    const { subject, html } = welcomeEmail(row.name, row.dog_name)
    const res = await send(row.email, subject, html)
    if (res.ok) {
      await admin
        .from('waitlist')
        .update({ welcomed_at: new Date().toISOString() })
        .eq('id', row.id)
    } else {
      console.error('welcome send failed', res.status, res.detail)
    }
    return json({ ok: true })
  }

  // ---- invite: admin only -------------------------------------------------
  if (action === 'invite') {
    const denied = await requireAdmin(req, admin)
    if (denied) return denied

    const limit = Math.min(Math.max(Number(body.limit ?? 25), 1), 100)
    const batch = String(body.batch ?? new Date().toISOString().slice(0, 10))

    const { data: rows } = await admin
      .from('waitlist')
      .select('id, email, name')
      .is('invited_at', null)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (!rows?.length) return json({ ok: true, sent: 0, failed: 0, remaining: 0 })

    let sent = 0
    const failures: { email: string; detail: string }[] = []
    for (const row of rows) {
      const { subject, html } = inviteEmail(row.name)
      const res = await send(row.email, subject, html)
      if (res.ok) {
        // Mark per-row rather than in bulk at the end: a failure partway
        // through must not re-invite everyone who already got one.
        await admin
          .from('waitlist')
          .update({ invited_at: new Date().toISOString(), invite_batch: batch })
          .eq('id', row.id)
        sent++
      } else {
        failures.push({ email: row.email, detail: res.detail })
        console.error('invite send failed', row.email, res.status, res.detail)
      }
    }

    const { count: remaining } = await admin
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .is('invited_at', null)

    return json({
      ok: true,
      sent,
      failed: failures.length,
      remaining: remaining ?? 0,
      // Surfaced so the admin board can show WHY, not just that it failed.
      first_error: failures[0]?.detail ?? null,
    })
  }

  // ---- status: admin only, sends nothing --------------------------------------
  if (action === 'status') {
    const denied = await requireAdmin(req, admin)
    if (denied) return denied

    const counts = async (col: 'welcomed_at' | 'invited_at', done: boolean) => {
      const q = admin.from('waitlist').select('id', { count: 'exact', head: true })
      const { count } = await (done ? q.not(col, 'is', null) : q.is(col, null))
      return count ?? 0
    }

    // `onboarding@resend.dev` only delivers to the Resend account owner, so
    // treat it as "not configured" rather than letting a cohort fail silently.
    const configured = Boolean(RESEND_API_KEY) && !FROM.includes('resend.dev')

    return json({
      ok: true,
      configured,
      from: FROM,
      has_key: Boolean(RESEND_API_KEY),
      welcomed: await counts('welcomed_at', true),
      invited: await counts('invited_at', true),
      uninvited: await counts('invited_at', false),
    })
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, 400)
})
