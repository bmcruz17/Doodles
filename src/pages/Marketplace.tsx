import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Pet, Service, Vendor, VendorCategory } from '../lib/types'

// Our platform commission on each transaction (the distributor margin).
const COMMISSION_RATE = 0.18

const CATEGORIES: (VendorCategory | 'all')[] = [
  'all',
  'grooming',
  'mobile_vet',
  'vet',
  'food',
  'sitter',
  'walking',
  'boarding',
  'training',
  'waste_removal',
]

const labelFor = (c: string) =>
  c === 'all' ? 'All' : c.replace('_', ' ')

type VendorWithServices = Vendor & { services: Service[] }

export default function Marketplace() {
  const { user } = useAuth()
  const [vendors, setVendors] = useState<VendorWithServices[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [category, setCategory] = useState<VendorCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<
    { vendor: VendorWithServices; service: Service } | null
  >(null)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase
        .from('vendors')
        .select('*, services(*)')
        .eq('status', 'active')
        .order('rating', { ascending: false }),
      supabase.from('pets').select('*').order('created_at'),
    ]).then(([vendorRes, petRes]) => {
      if (!active) return
      setVendors((vendorRes.data as VendorWithServices[]) ?? [])
      setPets(petRes.data ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(
    () =>
      category === 'all'
        ? vendors
        : vendors.filter((v) => v.category === category),
    [vendors, category],
  )

  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-50">Marketplace</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-brand-300">
        Book grooming, mobile vet, sitting, waste removal, food and more in a
        tap. You book — we arrange it with a vetted local partner at a
        pre-negotiated price. (Payments &amp; instant scheduling land in Phase 2;
        for now we confirm and coordinate each request.)
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-sm capitalize transition ${
              category === c
                ? 'bg-brand-500 text-white'
                : 'bg-brand-900 text-brand-300 hover:bg-brand-800'
            }`}
          >
            {labelFor(c)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-brand-300">Loading vendors…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-brand-400">No vendors in this category yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {filtered.map((v) => (
            <div key={v.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-brand-50">{v.name}</h2>
                  <p className="text-xs uppercase tracking-wide text-brand-400">
                    {v.category.replace('_', ' ')}
                    {v.location ? ` · ${v.location}` : ''}
                  </p>
                </div>
                {v.rating != null && (
                  <span className="rounded-md bg-brand-800 px-2 py-1 text-xs text-brand-100">
                    ★ {v.rating}
                  </span>
                )}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {v.verified && (
                  <span className="inline-block rounded-full bg-brand-700/60 px-2 py-0.5 text-xs text-brand-100">
                    ✓ Verified partner
                  </span>
                )}
                <span className="inline-block rounded-full bg-brand-800 px-2 py-0.5 text-xs text-brand-300">
                  {v.fulfillment === 'in_house' ? 'PackHub fleet' : 'Affiliate'}
                </span>
              </div>

              {v.description && (
                <p className="mt-2 text-sm text-brand-300">{v.description}</p>
              )}

              {v.services.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-brand-800 pt-3">
                  {v.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="text-brand-100">{s.title}</span>
                        <span className="ml-2 text-brand-400">
                          ${Number(s.price).toFixed(2)}
                          {s.recurring && s.interval ? `/${s.interval}` : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => setBooking({ vendor: v, service: s })}
                        className="btn-ghost px-3 py-1 text-xs"
                      >
                        Book
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {booking && (
        <BookingModal
          userId={user?.id ?? ''}
          pets={pets}
          vendor={booking.vendor}
          service={booking.service}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  )
}

function BookingModal({
  userId,
  pets,
  vendor,
  service,
  onClose,
}: {
  userId: string
  pets: Pet[]
  vendor: Vendor
  service: Service
  onClose: () => void
}) {
  const [petId, setPetId] = useState(pets[0]?.id ?? '')
  const [scheduledFor, setScheduledFor] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const amount = Number(service.price)
  const commission = Math.round(amount * COMMISSION_RATE * 100) / 100

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { error: insertError } = await supabase.from('bookings').insert({
        user_id: userId,
        pet_id: petId || null,
        service_id: service.id,
        vendor_id: vendor.id,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        status: 'requested',
        amount,
        commission,
        currency: service.currency,
        notes: notes || null,
      })
      if (insertError) throw insertError
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <div className="text-4xl">✅</div>
            <h2 className="mt-2 text-lg font-semibold text-brand-50">
              Request sent
            </h2>
            <p className="mt-1 text-sm text-brand-300">
              We'll coordinate {service.title} with {vendor.name} and confirm
              your time. Track it under your bookings.
            </p>
            <button onClick={onClose} className="btn-primary mt-4 w-full">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-50">
                Book {service.title}
              </h2>
              <p className="text-sm text-brand-300">
                {vendor.name} · ${amount.toFixed(2)}
                {service.recurring && service.interval
                  ? `/${service.interval}`
                  : ''}
              </p>
            </div>

            {pets.length === 0 ? (
              <p className="text-sm text-brand-400">
                Add a pet first to book a service.
              </p>
            ) : (
              <div>
                <label className="label">For</label>
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

            <div>
              <label className="label">Preferred date/time</label>
              <input
                type="datetime-local"
                className="input"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Notes for the provider</label>
              <textarea
                className="input min-h-[70px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, special handling, preferred groomer…"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy || pets.length === 0}
                className="btn-primary flex-1"
              >
                {busy ? 'Sending…' : 'Request booking'}
              </button>
              <button type="button" onClick={onClose} className="btn-ghost">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
