// Stripe webhook — Supabase Edge Function (Deno).
//
// Verifies the Stripe signature and syncs membership state into the
// `subscriptions` table. Writes use the service-role key (bypasses RLS).
//
// Phase 2 scaffold: Stripe Connect events (account.updated, transfers) and the
// 18% commission split on marketplace bookings are stubbed below — wire them
// up when vendor payouts go live.
//
// Configure the endpoint in Stripe to point at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// and set STRIPE_WEBHOOK_SECRET to that endpoint's signing secret.
import Stripe from 'https://esm.sh/stripe@16.8.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Our platform commission rate on marketplace transactions (Phase 2).
export const COMMISSION_RATE = 0.18

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function tsToIso(seconds: number | null | undefined): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null
}

// Upsert the subscriptions row from a Stripe Subscription object.
async function syncSubscription(sub: Stripe.Subscription) {
  const meta = sub.metadata ?? {}
  await admin
    .from('subscriptions')
    .upsert(
      {
        user_id: meta.user_id || null,
        pet_id: meta.pet_id || null,
        tier: (meta.tier as string) || 'basic',
        status: sub.status,
        stripe_customer_id:
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        price_id: sub.items.data[0]?.price?.id ?? null,
        current_period_end: tsToIso(sub.current_period_end),
        cancel_at_period_end: sub.cancel_at_period_end,
      },
      { onConflict: 'stripe_subscription_id' },
    )

  // Mirror the active tier onto the user's profile for quick checks.
  if (meta.user_id) {
    const tier = ['active', 'trialing'].includes(sub.status)
      ? (meta.tier as string) || 'basic'
      : null
    await admin
      .from('users')
      .update({ membership_tier: tier })
      .eq('id', meta.user_id)
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      cryptoProvider,
    )
  } catch (err) {
    console.error('Signature verification failed', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(
            session.subscription as string,
          )
          // Carry checkout metadata onto the subscription if missing.
          sub.metadata = { ...session.metadata, ...sub.metadata }
          await syncSubscription(sub)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      }

      // --- Phase 2: Stripe Connect / commission split -----------------------
      case 'account.updated': {
        // A connected vendor account changed (onboarding, payouts enabled).
        // TODO(phase2): update vendors.status based on charges_enabled etc.
        break
      }
      case 'payment_intent.succeeded': {
        // TODO(phase2): for marketplace bookings, record the 18% application
        // fee (COMMISSION_RATE) against the booking and confirm the payout.
        break
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break
    }
  } catch (err) {
    console.error('Webhook handler error', err)
    return new Response('Handler error', { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
