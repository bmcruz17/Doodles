import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createCheckout } from '../lib/api'
import {
  BETA_FREE,
  FOUNDING_CAP,
  formatCents,
  myFounding,
} from '../lib/founding'
import type { MembershipTier, Pet, Subscription } from '../lib/types'

type Founding = Awaited<ReturnType<typeof myFounding>>

const TIERS: {
  tier: MembershipTier
  price: string
  blurb: string
  perks: string[]
}[] = [
  {
    tier: 'basic',
    price: '$15',
    blurb: 'AI companion, health vault, marketplace discounts.',
    perks: ['AI Companion', 'Health records vault', 'Marketplace discounts'],
  },
  {
    tier: 'premium',
    price: '$29',
    blurb: 'Everything in Basic, plus travel perks and concierge.',
    perks: [
      'Everything in Basic',
      'Priority member travel rates',
      'Included sitter credits',
      'Private dog park & place access (coming soon)',
      'Specialist concierge',
    ],
  },
]

export default function Membership() {
  const [pets, setPets] = useState<Pet[]>([])
  const [subs, setSubs] = useState<Subscription[]>([])
  const [petId, setPetId] = useState<string>('')
  const [busyTier, setBusyTier] = useState<MembershipTier | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [founding, setFounding] = useState<Founding>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('pets').select('*').order('created_at'),
      supabase.from('subscriptions').select('*'),
    ]).then(([petRes, subRes]) => {
      if (!active) return
      const ps = petRes.data ?? []
      setPets(ps)
      setSubs(subRes.data ?? [])
      if (ps.length) setPetId(ps[0].id)
    })
    myFounding()
      .then((f) => active && setFounding(f))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  function activeSubFor(id: string) {
    return subs.find(
      (s) => s.pet_id === id && ['active', 'trialing'].includes(s.status),
    )
  }

  async function subscribe(tier: MembershipTier) {
    if (BETA_FREE) return
    if (!petId) {
      setError('Add a pet first — membership is per pet.')
      return
    }
    setError(null)
    setBusyTier(tier)
    try {
      const { url } = await createCheckout({ pet_id: petId, tier })
      window.location.href = url
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not start checkout. Is Stripe configured?',
      )
    } finally {
      setBusyTier(null)
    }
  }

  const currentSub = petId ? activeSubFor(petId) : undefined

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Membership</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-600">
        One membership per pet unlocks the AI companion, health vault,
        marketplace discounts, and member travel rates. Everything is free
        during the closed beta — nothing is charged yet.
      </p>

      {pets.length > 0 && (
        <div className="mt-5 max-w-xs">
          <label className="label">Membership for</label>
          <select
            className="input"
            value={petId}
            onChange={(e) => setPetId(e.target.value)}
          >
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {currentSub && (
        <div className="card mt-4 border-brand-300 bg-white">
          <p className="text-sm text-brand-800">
            This pet has an{' '}
            <span className="font-semibold capitalize">{currentSub.tier}</span>{' '}
            membership ({currentSub.status}).
          </p>
        </div>
      )}

      {founding?.founding_member && (
        <div className="card mt-4 border-sun-300 bg-gradient-to-br from-sun-50 to-brand-50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-sun-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Founding Pawther #{founding.founding_number}
            </span>
            <span className="text-sm font-semibold text-brand-800">
              One of the first {FOUNDING_CAP}.
            </span>
          </div>
          <p className="mt-2 text-sm text-brand-700">
            Membership is <strong>free for you through the beta</strong>. When
            billing starts, your locked founding rate is{' '}
            {founding.founding_rate_basic_cents != null && (
              <strong>
                {formatCents(founding.founding_rate_basic_cents)}/mo basic
              </strong>
            )}
            {founding.founding_rate_premium_cents != null && (
              <>
                {' '}or{' '}
                <strong>
                  {formatCents(founding.founding_rate_premium_cents)}/mo premium
                </strong>
              </>
            )}{' '}
            per dog — held for as long as your membership stays active, whatever
            we charge everyone else.
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {TIERS.map((t) => (
          <div key={t.tier} className="card flex flex-col">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold capitalize text-brand-900">
                {t.tier}
              </h2>
              <div className="text-right">
                {BETA_FREE ? (
                  <>
                    <span className="text-2xl font-bold text-emerald-700">$0</span>
                    <span className="text-sm text-brand-500"> in beta</span>
                    <div className="text-xs text-brand-500">
                      {t.price}/pet/mo after
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-brand-900">
                      {t.price}
                    </span>
                    <span className="text-sm text-brand-500">/pet/mo</span>
                  </>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-brand-600">{t.blurb}</p>
            <ul className="mt-4 space-y-1 text-sm text-brand-700">
              {t.perks.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="text-brand-500">✓</span> {p}
                </li>
              ))}
            </ul>
            {BETA_FREE ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-800">
                Included free in your beta
              </div>
            ) : (
              <button
                onClick={() => subscribe(t.tier)}
                disabled={busyTier !== null || currentSub?.tier === t.tier}
                className="btn-primary mt-5 w-full"
              >
                {currentSub?.tier === t.tier
                  ? 'Current plan'
                  : busyTier === t.tier
                    ? 'Redirecting…'
                    : `Choose ${t.tier}`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
