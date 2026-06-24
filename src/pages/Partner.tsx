import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { uploadPostPhoto } from '../lib/posts'
import { LIFE_STAGES } from '../lib/dog'
import type { LifeStage, Service, Vendor, VendorCategory } from '../lib/types'

// Self-serve provider listing. Local providers list FREE — they create a
// vendor profile + services, which go live in the marketplace after review.
// (RLS already scopes vendors/services to owner_id = auth.uid().)

const CATEGORIES: { key: VendorCategory; label: string }[] = [
  { key: 'grooming', label: 'Grooming' },
  { key: 'mobile_vet', label: 'Mobile vet' },
  { key: 'vet', label: 'Veterinary clinic' },
  { key: 'walking', label: 'Dog walking' },
  { key: 'sitter', label: 'Sitting' },
  { key: 'boarding', label: 'Boarding' },
  { key: 'daycare', label: 'Daycare' },
  { key: 'training', label: 'Training' },
  { key: 'waste_removal', label: 'Waste removal' },
  { key: 'food', label: 'Food & supplements' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'specialist', label: 'Specialist' },
  { key: 'travel', label: 'Travel' },
  { key: 'other', label: 'Other' },
]

type DraftService = { title: string; price: string; recurring: boolean }

const STATUS_COPY: Record<string, { label: string; tone: string; note: string }> = {
  pending: {
    label: 'In review',
    tone: 'bg-amber-100 text-amber-700',
    note: "We're reviewing your listing. It goes live in the marketplace once approved.",
  },
  active: {
    label: 'Live',
    tone: 'bg-emerald-100 text-emerald-700',
    note: 'Your listing is live in the marketplace.',
  },
  paused: {
    label: 'Paused',
    tone: 'bg-brand-100 text-brand-600',
    note: 'This listing is paused and hidden from the marketplace.',
  },
}

export default function Partner() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [existing, setExisting] = useState<(Vendor & { services: Service[] })[]>([])

  const [name, setName] = useState('')
  const [category, setCategory] = useState<VendorCategory>('grooming')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [services, setServices] = useState<DraftService[]>([
    { title: '', price: '', recurring: false },
  ])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    const { data } = await supabase
      .from('vendors')
      .select('*, services(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    setExisting((data as (Vendor & { services: Service[] })[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  function updateService(i: number, patch: Partial<DraftService>) {
    setServices((s) => s.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const { data: vendor, error: vErr } = await supabase
        .from('vendors')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          category,
          location: location.trim() || null,
          description: description.trim() || null,
          status: 'pending',
          verified: false,
          fulfillment: 'affiliate',
        })
        .select()
        .single()
      if (vErr || !vendor) throw vErr ?? new Error('Could not create the listing')

      const rows = services
        .filter((s) => s.title.trim())
        .map((s) => ({
          vendor_id: vendor.id,
          title: s.title.trim(),
          price: Number(s.price) || 0,
          currency: 'usd',
          recurring: s.recurring,
          interval: s.recurring ? ('month' as const) : null,
          is_active: true,
        }))
      if (rows.length) {
        const { error: sErr } = await supabase.from('services').insert(rows)
        if (sErr) throw sErr
      }

      setName('')
      setLocation('')
      setDescription('')
      setServices([{ title: '', price: '', recurring: false }])
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your listing')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/marketplace" className="text-sm text-brand-600 hover:text-brand-800">
          ← Marketplace
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-900">
          List your business — free
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-600">
          Are you a groomer, walker, sitter, mobile vet, or other pet pro? List
          your services on PackHub at no cost. Owners book through the app and we
          coordinate the rest — you only pay our commission on completed bookings.
        </p>
      </div>

      {!loading && existing.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
            Your listings
          </h2>
          <div className="space-y-3">
            {existing.map((v) => {
              const status = STATUS_COPY[v.status] ?? STATUS_COPY.pending
              return (
                <div key={v.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-brand-900">{v.name}</h3>
                      <p className="text-xs uppercase tracking-wide text-brand-500">
                        {v.category.replace('_', ' ')}
                        {v.location ? ` · ${v.location}` : ''}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-brand-500">{status.note}</p>
                  {v.services.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {v.services.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-md bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
                        >
                          {s.title} · ${Number(s.price).toFixed(0)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!loading && existing.length > 0 && (
        <PromoteInFeed userId={user?.id ?? ''} vendors={existing} />
      )}

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-lg font-semibold text-brand-900">Add a listing</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Happy Paws Grooming"
            />
          </div>
          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value as VendorCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Service area / location</label>
          <input
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Austin, TX · mobile within 15 mi"
          />
        </div>

        <div>
          <label className="label">About your business</label>
          <textarea
            className="input min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you offer, experience, certifications, insurance…"
          />
        </div>

        <div>
          <label className="label">Services &amp; pricing</label>
          <div className="space-y-2">
            {services.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className="input min-w-0 flex-1"
                  value={s.title}
                  onChange={(e) => updateService(i, { title: e.target.value })}
                  placeholder="Full groom (medium dog)"
                />
                <div className="flex items-center gap-1">
                  <span className="text-brand-500">$</span>
                  <input
                    className="input w-24"
                    inputMode="decimal"
                    value={s.price}
                    onChange={(e) => updateService(i, { price: e.target.value })}
                    placeholder="75"
                  />
                </div>
                <label className="flex items-center gap-1 text-xs text-brand-600">
                  <input
                    type="checkbox"
                    checked={s.recurring}
                    onChange={(e) => updateService(i, { recurring: e.target.checked })}
                  />
                  monthly
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setServices((s) => [...s, { title: '', price: '', recurring: false }])
            }
            className="btn-ghost mt-2 text-sm"
          >
            + Add another service
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
          {busy ? 'Submitting…' : 'Submit listing for review'}
        </button>
        <p className="text-xs text-brand-500">
          We review new listings before they appear in the marketplace to keep
          quality high for owners.
        </p>
      </form>
    </div>
  )
}

// --------------------------------------------------------------------------
// Promote a product/post into the breed-targeted Pack feed.
// --------------------------------------------------------------------------
function PromoteInFeed({
  userId,
  vendors,
}: {
  userId: string
  vendors: (Vendor & { services: Service[] })[]
}) {
  const [open, setOpen] = useState(false)
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [caption, setCaption] = useState('')
  const [breed, setBreed] = useState('')
  const [stage, setStage] = useState<LifeStage | ''>('')
  const [cta, setCta] = useState('Shop now')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setMsg(null)
    try {
      let image_url: string | null = null
      if (file) image_url = await uploadPostPhoto(userId, file)
      const vendor = vendors.find((v) => v.id === vendorId)
      const { error } = await supabase.from('posts').insert({
        author_id: userId,
        author_name: vendor?.name ?? 'Partner',
        kind: 'vendor',
        vendor_id: vendorId,
        vendor_name: vendor?.name ?? null,
        caption: caption.trim(),
        image_url,
        target_breed: breed.trim() || null,
        target_life_stage: stage || null,
        link_url: link.trim() || null,
        cta: cta.trim() || 'Learn more',
      })
      if (error) throw error
      setCaption('')
      setBreed('')
      setLink('')
      setFile(null)
      setMsg('Posted to the feed.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not post')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card border-amber-200 bg-amber-50/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Marketing
          </p>
          <h2 className="text-lg font-semibold text-brand-900">
            Promote a product in the feed
          </h2>
          <p className="mt-1 text-sm text-brand-600">
            Reach owners directly — target a breed and your post shows up in their
            Pack feed.
          </p>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-sm">
          {open ? 'Close' : 'Create'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          {vendors.length > 1 && (
            <div>
              <label className="label">From listing</label>
              <select
                className="input"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Post copy</label>
            <textarea
              className="input min-h-[70px]"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="New grain-free formula for doodles — 15% off this week."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Target breed</label>
              <input
                className="input"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="Blank = all"
              />
            </div>
            <div>
              <label className="label">Life stage</label>
              <select
                className="input"
                value={stage}
                onChange={(e) => setStage(e.target.value as LifeStage | '')}
              >
                <option value="">All ages</option>
                {LIFE_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Button text</label>
              <input
                className="input"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Shop now"
              />
            </div>
          </div>
          <div>
            <label className="label">Link (optional)</label>
            <input
              className="input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <label className="label">Image</label>
            <input
              type="file"
              accept="image/*"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {msg && <p className="text-sm text-brand-600">{msg}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Posting…' : 'Post to feed'}
          </button>
        </form>
      )}
    </section>
  )
}
