import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  SITTER_SERVICES,
  uploadSitterPhoto,
  uploadSitterIdDoc,
} from '../lib/sitters'
import type { BackgroundCheckStatus, SitterProfile } from '../lib/types'

const CHECK_COPY: Record<
  BackgroundCheckStatus,
  { label: string; tone: string; note: string }
> = {
  not_started: {
    label: 'Not submitted',
    tone: 'bg-brand-100 text-brand-600',
    note: 'Complete the form below to start your background check.',
  },
  consent_given: {
    label: 'Consent on file',
    tone: 'bg-brand-100 text-brand-600',
    note: 'Upload your ID and submit to start the check.',
  },
  submitted: {
    label: 'Background check in review',
    tone: 'bg-amber-100 text-amber-700',
    note: 'Your check was submitted. We\'ll notify you when it clears (usually 1–3 business days).',
  },
  in_review: {
    label: 'Background check in review',
    tone: 'bg-amber-100 text-amber-700',
    note: 'Your check is being reviewed by our provider.',
  },
  approved: {
    label: 'Background-checked ✓',
    tone: 'bg-emerald-100 text-emerald-700',
    note: 'You\'re verified! Your profile is visible to owners looking for a sitter.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'bg-red-100 text-red-600',
    note: 'We couldn\'t verify your background check. Contact support to review.',
  },
}

export default function Sitters() {
  const { user } = useAuth()
  const [mine, setMine] = useState<SitterProfile | null>(null)
  const [directory, setDirectory] = useState<SitterProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)

  async function load() {
    const [{ data: dir }, { data: own }] = await Promise.all([
      supabase
        .from('sitter_profiles')
        .select('*')
        .eq('verified', true)
        .eq('listed', true)
        .order('rating', { ascending: false, nullsFirst: false }),
      user
        ? supabase.from('sitter_profiles').select('*').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    setDirectory(dir ?? [])
    setMine((own as SitterProfile | null) ?? null)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (loading) return <p className="text-brand-600">Loading sitters…</p>

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">Trusted sitters</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-600">
          Every sitter on PackHub passes an identity and background check before
          they appear here. Want to sit dogs yourself? Apply below.
        </p>
      </div>

      {/* Your sitter status / application */}
      {mine && !applying ? (
        <SitterStatus profile={mine} onEdit={() => setApplying(true)} />
      ) : (
        <SitterApplication
          userId={user?.id ?? ''}
          existing={mine}
          onDone={() => {
            setApplying(false)
            load()
          }}
          onCancel={mine ? () => setApplying(false) : undefined}
        />
      )}

      {/* Directory */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Verified sitters near you
        </h2>
        {directory.length === 0 ? (
          <p className="text-sm text-brand-500">
            No verified sitters yet — be the first in your area.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {directory.map((s) => (
              <div key={s.id} className="card">
                <div className="flex items-center gap-3">
                  {s.photo_url ? (
                    <img
                      src={s.photo_url}
                      alt={s.display_name}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-lg font-semibold text-sky-700">
                      {(s.display_name || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-brand-900">
                      {s.display_name}
                    </h3>
                    <p className="truncate text-xs text-brand-500">
                      {s.location || 'Local'}
                      {s.years_experience ? ` · ${s.years_experience} yr exp` : ''}
                    </p>
                  </div>
                  {s.rating != null && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      ★ {s.rating}
                    </span>
                  )}
                </div>
                <span className="mt-3 inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Background-checked ✓
                </span>
                {s.bio && <p className="mt-2 text-sm text-brand-700">{s.bio}</p>}
                {s.services.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {s.services.map((svc) => (
                      <li
                        key={svc}
                        className="rounded-md bg-brand-100 px-2 py-0.5 text-xs text-brand-700"
                      >
                        {svc}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex items-center justify-between">
                  {s.hourly_rate != null && (
                    <span className="text-sm font-semibold text-brand-900">
                      ${Number(s.hourly_rate).toFixed(0)}
                      <span className="font-normal text-brand-500">/hr</span>
                    </span>
                  )}
                  <span className="text-xs text-brand-400">Booking opens soon</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// --------------------------------------------------------------------------
function SitterStatus({
  profile,
  onEdit,
}: {
  profile: SitterProfile
  onEdit: () => void
}) {
  const copy = CHECK_COPY[profile.background_check_status]
  return (
    <section className="card border-sky-200 bg-sky-50/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Your sitter profile
          </p>
          <h2 className="text-lg font-semibold text-brand-900">
            {profile.display_name || 'Sitter'}
          </h2>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${copy.tone}`}>
          {copy.label}
        </span>
      </div>
      <p className="mt-2 text-sm text-brand-600">{copy.note}</p>
      <div className="mt-3 flex items-center gap-3 text-xs text-brand-500">
        <span>{profile.verified ? 'Visible in directory' : 'Hidden until verified'}</span>
      </div>
      <button onClick={onEdit} className="btn-ghost mt-3 text-sm">
        Edit profile
      </button>
    </section>
  )
}

// --------------------------------------------------------------------------
function SitterApplication({
  userId,
  existing,
  onDone,
  onCancel,
}: {
  userId: string
  existing: SitterProfile | null
  onDone: () => void
  onCancel?: () => void
}) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '')
  const [location, setLocation] = useState(existing?.location ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [rate, setRate] = useState(existing?.hourly_rate?.toString() ?? '')
  const [years, setYears] = useState(existing?.years_experience?.toString() ?? '')
  const [services, setServices] = useState<string[]>(existing?.services ?? [])
  const [photo, setPhoto] = useState<File | null>(null)
  const [idDoc, setIdDoc] = useState<File | null>(null)
  const [consent, setConsent] = useState(
    Boolean(existing?.background_check_consent_at),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const alreadyHasId = Boolean(existing?.id_document_url)

  function toggleService(s: string) {
    setServices((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    if (!consent) {
      setError('You must consent to a background check to become a sitter.')
      return
    }
    if (!idDoc && !alreadyHasId) {
      setError('Please upload a photo of your government ID for verification.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let photo_url = existing?.photo_url ?? null
      if (photo) photo_url = await uploadSitterPhoto(userId, photo)
      let id_document_url = existing?.id_document_url ?? null
      if (idDoc) id_document_url = await uploadSitterIdDoc(userId, idDoc)

      const { error: upErr } = await supabase.from('sitter_profiles').upsert(
        {
          user_id: userId,
          display_name: displayName.trim(),
          location: location.trim() || null,
          bio: bio.trim(),
          hourly_rate: rate ? Number(rate) : null,
          years_experience: years ? Number(years) : null,
          services,
          photo_url,
          id_document_url,
          background_check_consent_at: new Date().toISOString(),
          // Trigger keeps verified=false; status can advance to 'submitted'.
          background_check_status: 'submitted',
          listed: true,
        },
        { onConflict: 'user_id' },
      )
      if (upErr) throw upErr
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit application')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-900">
          {existing ? 'Edit your sitter profile' : 'Become a verified sitter'}
        </h2>
        <p className="mt-1 text-sm text-brand-600">
          Create your profile and pass a background check. Your ID is used only
          for verification — it's stored privately and never shown to owners.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Display name</label>
          <input
            className="input"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jordan P."
          />
        </div>
        <div>
          <label className="label">Location</label>
          <input
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Austin, TX"
          />
        </div>
        <div>
          <label className="label">Rate ($/hr)</label>
          <input
            className="input"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="25"
          />
        </div>
        <div>
          <label className="label">Years of experience</label>
          <input
            className="input"
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            placeholder="3"
          />
        </div>
      </div>

      <div>
        <label className="label">About you</label>
        <textarea
          className="input min-h-[80px]"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Experience, the kinds of dogs you love, your home setup…"
        />
      </div>

      <div>
        <label className="label">Services you offer</label>
        <div className="flex flex-wrap gap-2">
          {SITTER_SERVICES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => toggleService(s)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                services.includes(s)
                  ? 'bg-sky-600 text-white'
                  : 'border border-brand-200 bg-white text-brand-700 hover:border-sky-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Profile photo</label>
          <input
            type="file"
            accept="image/*"
            className="input"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <label className="label">
            Government ID {alreadyHasId && <span className="text-brand-400">(on file)</span>}
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="input"
            onChange={(e) => setIdDoc(e.target.files?.[0] ?? null)}
          />
          <p className="mt-1 text-xs text-brand-500">
            Private — used only for the background check.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-brand-700">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I consent to an identity and criminal background check, and I confirm
          the information above is accurate.
        </span>
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Submitting…' : existing ? 'Save & resubmit' : 'Submit application'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            Cancel
          </button>
        )}
      </div>
      <p className="text-xs text-brand-500">
        Background checks are run by a third-party provider (e.g. Checkr). You'll
        be notified when yours clears.
      </p>
    </form>
  )
}
