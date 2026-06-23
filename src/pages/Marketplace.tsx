import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Service, Vendor, VendorCategory } from '../lib/types'

const CATEGORIES: (VendorCategory | 'all')[] = [
  'all',
  'grooming',
  'mobile_vet',
  'food',
  'insurance',
  'sitter',
  'specialist',
  'travel',
]

type VendorWithServices = Vendor & { services: Service[] }

export default function Marketplace() {
  const [vendors, setVendors] = useState<VendorWithServices[]>([])
  const [category, setCategory] = useState<VendorCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('vendors')
      .select('*, services(*)')
      .eq('status', 'active')
      .order('rating', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setVendors((data as VendorWithServices[]) ?? [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const filtered =
    category === 'all'
      ? vendors
      : vendors.filter((v) => v.category === category)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-50">Marketplace</h1>
      </div>
      <p className="mb-6 text-sm text-brand-300">
        Curated, doodle-specialized vendors. Booking & Stripe Connect payouts
        (with the 18% split) land in Phase 2.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              category === c
                ? 'bg-brand-500 text-white'
                : 'bg-brand-900 text-brand-300 hover:bg-brand-800'
            }`}
          >
            {c === 'all' ? 'All' : c.replace('_', ' ')}
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
              {v.doodle_specialist && (
                <span className="mt-2 inline-block rounded-full bg-brand-700/60 px-2 py-0.5 text-xs text-brand-100">
                  Doodle specialist
                </span>
              )}
              {v.description && (
                <p className="mt-2 text-sm text-brand-300">{v.description}</p>
              )}

              {v.services.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-brand-800 pt-3">
                  {v.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-brand-200">{s.title}</span>
                      <span className="text-brand-100">
                        ${Number(s.price).toFixed(2)}
                        {s.recurring && s.interval ? `/${s.interval}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <button
                className="btn-ghost mt-4 w-full text-sm"
                disabled
                title="Booking opens in Phase 2"
              >
                Book (coming soon)
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
