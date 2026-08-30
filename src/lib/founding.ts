// Founding Pawthers — the first 100 members of the closed beta.
//
// The beta is free. What a founding member is really buying with their early
// signup is a locked rate: the prices published today are the prices they pay
// when billing turns on. `claim_founding_spot()` freezes those numbers onto
// their user row, so the promise survives any future price change.
//
// Everything here goes through RPCs (see 0015_founding_members.sql) because the
// founding columns are deliberately not client-writable.
import { supabase } from './supabase'

export const FOUNDING_CAP = 100

/**
 * Beta members are not billed. Flip this to false on the day Stripe checkout
 * goes live — it is the only switch between "included free" and a real
 * checkout redirect on the membership page.
 */
export const BETA_FREE = true

/** The rates a founding member locks in, in cents. Mirrors the migration. */
export const FOUNDING_RATES = { basic: 1500, premium: 2900 } as const

export interface FoundingStats {
  cap: number
  claimed: number
  waiting: number
}

export interface FoundingClaim {
  founding: boolean
  number: number | null
  cap: number
  claimed: number
  full: boolean
}

/** Public counter for the landing page. Aggregates only — no email exposure. */
export async function foundingStats(): Promise<FoundingStats> {
  const { data, error } = await supabase.rpc('founding_stats')
  if (error) throw error
  return data as FoundingStats
}

/**
 * Claim this user's founding spot. Idempotent and capped server-side, so it is
 * safe to call on every session — a member who already has a number just gets
 * it back.
 */
export async function claimFoundingSpot(): Promise<FoundingClaim> {
  const { data, error } = await supabase.rpc('claim_founding_spot')
  if (error) throw error
  return data as FoundingClaim
}

/** The signed-in member's founding status, straight off their profile row. */
export async function myFounding(): Promise<{
  founding_member: boolean
  founding_number: number | null
  founding_rate_basic_cents: number | null
  founding_rate_premium_cents: number | null
} | null> {
  const { data } = await supabase
    .from('users')
    .select(
      'founding_member, founding_number, founding_rate_basic_cents, founding_rate_premium_cents',
    )
    .maybeSingle()
  return data ?? null
}

export interface WaitlistEntry {
  email: string
  name?: string
  dog_name?: string
  zip?: string
  source: string
}

/**
 * Join the waitlist. A duplicate email is a success, not an error — the unique
 * index means someone re-submitting keeps their original position, and telling
 * them "you're already on the list" is the same good news either way.
 */
export async function joinWaitlist(entry: WaitlistEntry): Promise<void> {
  const ref =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('ref')
      : null

  const { error } = await supabase.from('waitlist').insert({
    email: entry.email.trim().toLowerCase(),
    name: entry.name?.trim() || null,
    dog_name: entry.dog_name?.trim() || null,
    zip: entry.zip?.trim() || null,
    ref,
    source: entry.source,
  })

  // 23505 = unique_violation: already on the list.
  if (error && error.code !== '23505') throw error
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}
