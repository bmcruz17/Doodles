import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createCheckout } from '../lib/api'
import type { MembershipTier, Pet, Subscription } from '../lib/types'

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
    perks: ['AI Doodle Companion', 'Health records vault', 'Marketplace discounts'],
  },
  {
    tier: 'premium',
    price: '$29',
    blurb: 'Everything in Basic, plus travel perks and concierge.',
    perks: [
      'Everything in Basic',
      'Priority member travel rates',
      'Included sitter credits',
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
      <h1 className="text-2xl font-semibold text-brand-50">Membership</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-300">
        One membership per pet unlocks the AI companion, health vault,
        marketplace discounts, and member travel rates.
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
        <div className="card mt-4 border-brand-600 bg-brand-900/50">
          <p className="text-sm text-brand-100">
            This pet has an{' '}
            <span className="font-semibold capitalize">{currentSub.tier}</span>{' '}
            membership ({currentSub.status}).
          </p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {TIERS.map((t) => (
          <div key={t.tier} className="card flex flex-col">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold capitalize text-brand-50">
                {t.tier}
              </h2>
              <div className="text-right">
                <span className="text-2xl font-bold text-brand-50">{t.price}</span>
                <span className="text-sm text-brand-400">/pet/mo</span>
              </div>
            </div>
            <p className="mt-1 text-sm text-brand-300">{t.blurb}</p>
            <ul className="mt-4 space-y-1 text-sm text-brand-200">
              {t.perks.map((p) => (
                <li key={p} className="flex items-center gap-2">
                  <span className="text-brand-400">✓</span> {p}
                </li>
              ))}
            </ul>
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
          </div>
        ))}
      </div>
    </div>
  )
}
