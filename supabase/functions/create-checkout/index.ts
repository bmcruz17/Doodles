// Membership checkout — Supabase Edge Function (Deno).
//
// Request:  { pet_id: string, tier: 'basic' | 'premium' }
// Response: { url: string }  (Stripe Checkout Session URL)
//
// Creates a per-pet membership subscription Checkout Session. Reuses (or
// creates) a Stripe customer for the user and stamps stripe_customer_id onto
// the users row so the webhook can reconcile.
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

// Minimal application/x-www-form-urlencoded helper for the Stripe REST API.
async function stripe(path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Stripe error on ${path}`)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const origin = req.headers.get('origin') ?? SUPABASE_URL
    const { pet_id, tier } = await req.json()

    if (!pet_id || !['basic', 'premium'].includes(tier)) {
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
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    // Reuse or create the Stripe customer.
    let customerId = profile?.stripe_customer_id ?? undefined
    if (!customerId) {
      const customer = await stripe('customers', {
        email: profile?.email ?? user.email ?? '',
        'metadata[user_id]': user.id,
      })
      customerId = customer.id
      await admin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Build the line item: pre-created Price, else inline price_data.
    const params: Record<string, string> = {
      mode: 'subscription',
      customer: customerId!,
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

    const session = await stripe('checkout/sessions', params)
    return json({ url: session.url })
  } catch (err) {
    console.error(err)
    return json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    )
  }
})
