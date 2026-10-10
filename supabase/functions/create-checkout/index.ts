// Membership checkout — Supabase Edge Function (Deno).
//
// Request:  { pet_id: string, tier: 'basic' | 'premium' }
// Response: { url: string }  (Stripe Checkout Session URL)
//
// Creates a per-pet membership subscription Checkout Session. Reuses (or
// creates) a Stripe customer for the user and stamps stripe_customer_id onto
// the users row so the webhook can reconcile.
//
// The stored customer id is only reused after Stripe confirms the customer
// exists and its metadata.user_id is this user; otherwise a fresh customer is
// created. users.stripe_customer_id is service-role-only (migration 0018).
//
// Set STRIPE_PRICE_BASIC / STRIPE_PRICE_PREMIUM to use pre-created Stripe
// Prices; otherwise the function falls back to inline price_data so it runs
// out of the box in test mode.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Optional pre-created Stripe Price IDs.
const PRICE_IDS: Record<string, string | undefined> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC') ?? undefined,
  premium: Deno.env.get('STRIPE_PRICE_PREMIUM') ?? undefined,
}
// Fallback inline amounts (USD cents / month).
const FALLBACK_AMOUNT: Record<string, number> = { basic: 1500, premium: 2900 }

// Stripe redirects back here after checkout. Anything else (including the
// Capacitor shell's capacitor://localhost) goes to production.
const PRODUCTION_ORIGIN = 'https://packhub.atmxhq.com'
const ALLOWED_RETURN_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
])

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

function returnOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? ''
  return ALLOWED_RETURN_ORIGINS.has(origin) ? origin : PRODUCTION_ORIGIN
}

// Minimal helper for the Stripe REST API (form-encoded bodies).
async function stripe(
  path: string,
  params?: Record<string, string>,
  opts: { method?: 'GET' | 'POST'; idempotencyKey?: string } = {},
) {
  const method = opts.method ?? 'POST'
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` }
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded'
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    body: method === 'POST' ? new URLSearchParams(params ?? {}) : undefined,
  })
  const data = await res.json()
  return { ok: res.ok, status: res.status, data }
}

class CheckoutError extends Error {}

async function stripeOrThrow(...args: Parameters<typeof stripe>) {
  const res = await stripe(...args)
  if (!res.ok) {
    console.error('Stripe error', args[0], res.status, res.data?.error)
    throw new CheckoutError('stripe')
  }
  return res.data
}

// The stored id is reusable only if it's a live customer that we created for
// this exact user.
async function customerBelongsTo(customerId: string, userId: string): Promise<boolean> {
  if (!/^cus_[A-Za-z0-9]+$/.test(customerId)) return false
  const res = await stripe(`customers/${encodeURIComponent(customerId)}`, undefined, { method: 'GET' })
  if (!res.ok || res.data?.deleted) return false
  return res.data?.metadata?.user_id === userId
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const origin = returnOrigin(req)
    const { pet_id, tier } = await req.json().catch(() => ({}))

    if (typeof pet_id !== 'string' || !pet_id || !['basic', 'premium'].includes(tier)) {
      return json({ error: 'pet_id and a valid tier are required' }, 400)
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
    } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    // Verify the caller owns this pet (RLS-scoped read).
    const { data: pet } = await userClient
      .from('pets')
      .select('id, name')
      .eq('id', pet_id)
      .single()
    if (!pet) return json({ error: 'Pet not found' }, 404)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: profile } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    let customerId: string | null = profile?.stripe_customer_id ?? null
    if (customerId && !(await customerBelongsTo(customerId, user.id))) {
      console.warn('Discarding stripe_customer_id that does not belong to user', user.id)
      customerId = null
    }
    if (!customerId) {
      const email = user.email ?? ''
      const customer = await stripeOrThrow(
        'customers',
        { email, 'metadata[user_id]': user.id },
        { idempotencyKey: `packhub-customer-${user.id}-${email}` },
      )
      customerId = customer.id as string
      const { error: saveErr } = await admin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      if (saveErr) console.error('Could not save stripe_customer_id', saveErr)
    }

    // Build the line item: pre-created Price, else inline price_data.
    const params: Record<string, string> = {
      mode: 'subscription',
      customer: customerId,
      success_url: `${origin}/membership?status=success`,
      cancel_url: `${origin}/membership?status=cancelled`,
      'metadata[user_id]': user.id,
      'metadata[pet_id]': pet_id,
      'metadata[tier]': tier,
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][pet_id]': pet_id,
      'subscription_data[metadata][tier]': tier,
      'line_items[0][quantity]': '1',
    }

    const priceId = PRICE_IDS[tier]
    if (priceId) {
      params['line_items[0][price]'] = priceId
    } else {
      params['line_items[0][price_data][currency]'] = 'usd'
      params['line_items[0][price_data][recurring][interval]'] = 'month'
      params['line_items[0][price_data][unit_amount]'] = String(
        FALLBACK_AMOUNT[tier],
      )
      params['line_items[0][price_data][product_data][name]'] =
        `PackHub ${tier} membership — ${pet.name}`
    }

    const session = await stripeOrThrow('checkout/sessions', params)
    return json({ url: session.url })
  } catch (err) {
    if (!(err instanceof CheckoutError)) console.error(err)
    return json({ error: 'Could not start checkout. Please try again.' }, 500)
  }
})
