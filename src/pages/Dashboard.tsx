import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { BRAND } from '../version'
import PetAvatar from '../components/PetAvatar'
import CategoryIcon from '../components/CategoryIcon'
import type { Booking, Pet, Vaccination, Vendor } from '../lib/types'

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------
const DAY = 24 * 60 * 60 * 1000

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function firstName(name: string | null, email: string | undefined): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0]
  if (email) return email.split('@')[0]
  return 'there'
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY)
}

function formatWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  if (!hasTime) return date
  const time = d
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .replace(':00', '')
  return `${date} at ${time}`
}

type Badge = { label: string; tone: 'green' | 'amber' | 'gray' }

function vaccineBadge(vax: Vaccination[]): Badge {
  if (vax.length === 0) return { label: 'No vaccines yet', tone: 'gray' }
  const now = new Date()
  const dated = vax.filter((v) => v.expires_at)
  if (dated.length === 0) return { label: 'Vaccines on file', tone: 'green' }
  const overdue = dated.some((v) => new Date(v.expires_at as string) < now)
  if (overdue) return { label: 'Vaccine overdue', tone: 'amber' }
  const soon = dated.some(
    (v) => daysBetween(new Date(v.expires_at as string), now) <= 30,
  )
  if (soon) return { label: 'Vaccine due soon', tone: 'amber' }
  return { label: 'Vaccines current', tone: 'green' }
}

const BADGE_TONE: Record<Badge['tone'], string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  gray: 'bg-brand-100 text-brand-600',
}

// Quick-access tiles deep-link into the marketplace category filter (or, for
// sitters, the background-checked sitter directory).
const QUICK = [
  { key: 'grooming', label: 'Groom', to: '/marketplace?category=grooming' },
  { key: 'mobile_vet', label: 'Vet', to: '/marketplace?category=mobile_vet' },
  { key: 'walking', label: 'Walker', to: '/marketplace?category=walking' },
  { key: 'sitter', label: 'Sitter', to: '/sitters' },
]

type UpcomingItem = {
  id: string
  icon: React.ReactNode
  title: string
  subtitle: string
  to: string
  urgent?: boolean
}

function ShieldIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6l7-2.5Z" />
      <path d="M9.5 12l1.8 1.8 3.2-3.4" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  )
}

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------
export default function Dashboard() {
  const { user } = useAuth()
  const [name, setName] = useState<string | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      supabase.from('pets').select('*').order('created_at', { ascending: true }),
      supabase.from('vaccinations').select('*'),
      supabase
        .from('bookings')
        .select('*')
        .order('scheduled_for', { ascending: true }),
      supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active')
        .order('rating', { ascending: false, nullsFirst: false }),
      user
        ? supabase.from('users').select('name').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([petRes, vaxRes, bookRes, venRes, profRes]) => {
      if (!active) return
      setPets(petRes.data ?? [])
      setVaccinations(vaxRes.data ?? [])
      setBookings(bookRes.data ?? [])
      setVendors(venRes.data ?? [])
      setName((profRes.data as { name: string | null } | null)?.name ?? null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user])

  if (loading) return <p className="text-brand-600">Loading your pack…</p>

  // First-login onboarding: prompt to create a pet profile.
  if (pets.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="card">
          <img src="/doodle.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-xl font-semibold text-brand-900">
            Welcome to {BRAND}!
          </h1>
          <p className="mt-2 text-sm text-brand-600">
            Let's start by creating a profile for your dog. It powers the AI
            companion, your health vault, and member perks.
          </p>
          <Link to="/pets/new" className="btn-primary mt-5 inline-flex">
            Create your pet profile
          </Link>
        </div>
      </div>
    )
  }

  const vendorById = new Map(vendors.map((v) => [v.id, v]))
  const now = new Date()

  // --- Upcoming: future bookings + vaccines overdue/due soon ---------------
  const upcoming: UpcomingItem[] = []

  for (const b of bookings) {
    if (!b.scheduled_for) continue
    if (new Date(b.scheduled_for) < new Date(now.getTime() - DAY)) continue
    if (b.status === 'cancelled' || b.status === 'completed') continue
    const v = b.vendor_id ? vendorById.get(b.vendor_id) : undefined
    const cat = v?.category ?? 'other'
    upcoming.push({
      id: `book-${b.id}`,
      icon: <CategoryIcon name={cat} />,
      title: v ? `${v.name}` : 'Service appointment',
      subtitle: `${cat.replace('_', ' ')} · ${formatWhen(b.scheduled_for)}`,
      to: '/marketplace',
    })
  }

  for (const vax of vaccinations) {
    if (!vax.expires_at) continue
    const exp = new Date(vax.expires_at)
    const diff = daysBetween(exp, now)
    if (diff > 45) continue // only surface what's due soon / overdue
    const pet = pets.find((p) => p.id === vax.pet_id)
    const who = pet ? `${pet.name} · ` : ''
    upcoming.push({
      id: `vax-${vax.id}`,
      icon: <ShieldIcon />,
      title: `${vax.vaccine} vaccine due`,
      subtitle:
        diff < 0
          ? `${who}Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} — book now`
          : `${who}Due in ${diff} day${diff === 1 ? '' : 's'} — book now`,
      to: '/marketplace?category=mobile_vet',
      urgent: diff < 0,
    })
  }

  upcoming.sort((a, b) => Number(b.urgent) - Number(a.urgent))
  const upcomingTop = upcoming.slice(0, 5)

  const featured = vendors.filter((v) => v.verified).slice(0, 4)

  function petBadges(pet: Pet): Badge[] {
    const petVax = vaccinations.filter((v) => v.pet_id === pet.id)
    const badges: Badge[] = [vaccineBadge(petVax)]
    // Grooming: due if there's no grooming booking in the last 6 weeks.
    const groomDates = bookings
      .filter(
        (b) =>
          b.pet_id === pet.id &&
          b.vendor_id &&
          vendorById.get(b.vendor_id)?.category === 'grooming',
      )
      .map((b) => new Date(b.scheduled_for ?? b.created_at).getTime())
    const lastGroom = groomDates.length ? Math.max(...groomDates) : 0
    if (!lastGroom || daysBetween(now, new Date(lastGroom)) > 42) {
      badges.push({ label: 'Grooming due', tone: 'amber' })
    }
    return badges
  }

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-brand-500">{greeting()},</p>
          <h1 className="text-2xl font-semibold text-brand-900">
            {firstName(name, user?.email)} <span aria-hidden>👋</span>
          </h1>
        </div>
        <Link to="/pets/new" className="btn-ghost text-sm">
          + Add a pet
        </Link>
      </header>

      {/* Pet cards with live health badges */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map((pet) => (
          <Link
            key={pet.id}
            to={`/pets/${pet.id}`}
            className="card flex items-center gap-4 transition hover:border-sky-400"
          >
            <PetAvatar photoUrl={pet.photo_url} name={pet.name} size={64} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold text-brand-900">
                {pet.name}
              </h2>
              <p className="truncate text-sm text-brand-600">
                {pet.breed || 'Dog'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {petBadges(pet).map((b) => (
                  <span
                    key={b.label}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE[b.tone]}`}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
            <span className="text-brand-300">›</span>
          </Link>
        ))}
      </div>

      {/* Quick access */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Quick access
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK.map((q) => (
            <Link
              key={q.key}
              to={q.to}
              className="card flex flex-col items-center gap-2 py-4 text-sky-600 transition hover:border-sky-400"
            >
              <CategoryIcon name={q.key} />
              <span className="text-xs font-medium text-brand-700">{q.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Upcoming
        </h2>
        {upcomingTop.length === 0 ? (
          <div className="card text-sm text-brand-500">
            Nothing scheduled. When a vaccine is coming due or you book a service,
            it shows up here.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcomingTop.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="card flex items-center gap-3 py-3 transition hover:border-sky-400"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      item.urgent
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-sky-50 text-sky-600'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-900">
                      {item.title}
                    </p>
                    <p className="truncate text-xs text-brand-500">
                      {item.subtitle}
                    </p>
                  </div>
                  <span className="text-brand-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Featured services */}
      {featured.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              Featured services
            </h2>
            <Link to="/marketplace" className="text-xs text-sky-600 hover:text-sky-700">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map((v) => (
              <Link
                key={v.id}
                to={`/marketplace?category=${v.category}`}
                className="card transition hover:border-sky-400"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-brand-900">
                      {v.name}
                    </h3>
                    <p className="text-xs uppercase tracking-wide text-brand-500">
                      {v.category.replace('_', ' ')}
                    </p>
                  </div>
                  {v.rating != null && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                      ★ {v.rating}
                    </span>
                  )}
                </div>
                {v.location && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-brand-500">
                    <PinIcon />
                    {v.location}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
