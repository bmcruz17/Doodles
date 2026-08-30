import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { fetchShowcase, type ShowcasePost } from '../lib/api'
import JoinWaitlist from '../components/JoinWaitlist'
import {
  FOUNDING_CAP,
  FOUNDING_RATES,
  foundingStats,
  formatCents,
  type FoundingStats,
} from '../lib/founding'
import { BRAND, BUILD_VERSION } from '../version'

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const foundingPerks = [
  {
    title: 'Free for the whole beta',
    body: 'Every feature, no card, no trial clock. You pay nothing while we build it out with you.',
  },
  {
    title: 'Your rate, locked for good',
    body: `When billing turns on, you keep today's prices — ${formatCents(FOUNDING_RATES.basic)} and ${formatCents(FOUNDING_RATES.premium)} a month per dog — for as long as you stay a member. We raise prices; yours doesn't move.`,
  },
  {
    title: 'A numbered founding badge',
    body: 'Pawther #1 through #100, permanently on your pack profile. There is never a second batch.',
  },
  {
    title: 'A direct line to the build',
    body: 'You tell us what your dog actually needs and it goes in the app. Founding feedback jumps the queue.',
  },
]

const features = [
  {
    tag: 'AI companion',
    title: 'Answers that know your dog',
    body: "Coat care, nutrition, training, or whether something looks normal — grounded in your dog's breed, age, and health records, not generic advice.",
  },
  {
    tag: 'Health vault',
    title: 'Every record in one place',
    body: 'Vaccinations, vet visits, medications, and documents — organized, searchable, and ready to hand to a sitter, vet, or new groomer.',
  },
  {
    tag: 'Services',
    title: 'Trusted local pros, one tap away',
    body: 'Grooming, mobile vet, sitters, waste removal, fresh food and more — you book, and a vetted partner shows up at a price set in advance.',
  },
  {
    tag: 'Travel',
    title: 'Go everywhere together',
    body: 'Pet-friendly flights and stays, relocation paperwork handled for you, and member access to private dog parks while you travel.',
  },
]

const steps = [
  { n: '1', title: 'Add your dog', body: 'Build a profile in a minute — any breed, any mix.' },
  { n: '2', title: 'Book what you need', body: 'Pick a service or just ask your AI companion.' },
  {
    n: '3',
    title: 'We handle the rest',
    body: 'Vetted partners fulfill it at pre-negotiated rates. You just show up.',
  },
]

const faqs = [
  {
    q: 'What does the beta actually cost?',
    a: 'Nothing. Founding Pawthers use everything free for the entire beta. We will tell you well before that changes, and you can leave at any time.',
  },
  {
    q: 'So what am I locking in?',
    a: `The price. Your founding rate — ${formatCents(FOUNDING_RATES.basic)} basic or ${formatCents(FOUNDING_RATES.premium)} premium, per dog per month — is recorded on your account the moment you claim a spot. Whatever we charge later, you keep that number for as long as your membership stays active.`,
  },
  {
    q: 'Is this only for doodles?',
    a: `Every breed and every mix. The doodle community is where we started because that is our own pack, but nothing in ${BRAND} is breed-locked — health tracking, services, and the AI companion all adapt to whatever dog you have.`,
  },
  {
    q: "It's a beta — how rough is it?",
    a: 'Real and usable, not a mockup: profiles, the health vault, the AI companion, the marketplace, the community feed and wearable tracking are all live today. Payments and the native iOS/Android apps are the pieces still landing, which is exactly why we want 100 people using it before everyone else does.',
  },
  {
    q: 'What happens to my dog’s records?',
    a: 'They stay yours. Records are private to your account, stored encrypted, and never sold. You can export or permanently delete everything from your account page in one click.',
  },
  {
    q: 'What do you want from me?',
    a: 'Use it for your own dog and tell us when something is wrong or missing. That is the entire deal.',
  },
]

/** Live scarcity — the number of founding spots already claimed. */
function SpotMeter({ stats }: { stats: FoundingStats | null }) {
  const cap = stats?.cap ?? FOUNDING_CAP
  const claimed = stats?.claimed ?? 0
  const left = Math.max(0, cap - claimed)
  const pct = Math.min(100, Math.max(4, (claimed / cap) * 100))

  return (
    <div className="mx-auto mt-8 max-w-md">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-brand-800">
          {stats ? `${claimed} of ${cap} spots claimed` : `${cap} founding spots`}
        </span>
        <span className="text-brand-500">{stats ? `${left} left` : ' '}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-200/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sun-400 to-sun-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      {stats && stats.waiting > 0 && (
        <p className="mt-2 text-xs text-brand-500">
          {stats.waiting} {stats.waiting === 1 ? 'person is' : 'people are'} on the
          waitlist behind them.
        </p>
      )}
    </div>
  )
}

export default function Landing() {
  const { session } = useAuth()
  const [showcase, setShowcase] = useState<ShowcasePost[]>([])
  const [stats, setStats] = useState<FoundingStats | null>(null)

  useEffect(() => {
    let active = true
    fetchShowcase().then((posts) => {
      if (active) setShowcase(posts)
    })
    // A failed counter should never blank the page — it just stays generic.
    foundingStats()
      .then((s) => active && setStats(s))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const full = stats ? stats.claimed >= stats.cap : false

  // Fill a 10-tile mosaic by repeating whatever photos we have.
  const mosaic =
    showcase.length > 0
      ? Array.from({ length: 10 }, (_, i) => showcase[i % showcase.length])
      : []

  return (
    <div className="min-h-screen bg-brand-50 pb-20 text-brand-900 sm:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-brand-200/60 bg-brand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/doodle.svg?v=crest2" alt={BRAND} className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <Link to="/dashboard" className="btn-primary text-sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost whitespace-nowrap text-sm">
                  Log in
                </Link>
                {/* The full label wraps to two lines on a phone — the sticky
                    bottom bar carries the long version there. */}
                <Link to="/signup" className="btn-primary whitespace-nowrap text-sm">
                  <span className="sm:hidden">Join</span>
                  <span className="hidden sm:inline">Claim your spot</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background: a soft mosaic of real Pack dog photos, or a paw pattern
            before any have been posted. */}
        {mosaic.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 sm:grid-cols-5 sm:grid-rows-2">
            {mosaic.map((p, i) => (
              <div key={i} className="overflow-hidden">
                <img
                  src={p.image_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%231a6fc0'%3E%3Ccircle cx='7' cy='9' r='1.8'/%3E%3Ccircle cx='11' cy='6.5' r='1.8'/%3E%3Ccircle cx='15.5' cy='7.5' r='1.8'/%3E%3Ccircle cx='18' cy='11.5' r='1.6'/%3E%3Cpath d='M12 12c-2.6 0-4.7 1.9-4.7 4 0 1.6 1.3 2.4 2.8 2.4.9 0 1.3-.3 1.9-.3s1 .3 1.9.3c1.5 0 2.8-.8 2.8-2.4 0-2.1-2.1-4-4.7-4Z'/%3E%3C/svg%3E\")",
              backgroundSize: '90px 90px',
            }}
          />
        )}
        {/* Legibility wash over the photos. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(80% 70% at 50% 10%, rgba(250,246,239,0.86) 0%, rgba(250,246,239,0.92) 45%, rgba(250,246,239,0.97) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 60% at 50% -10%, rgba(78,166,247,0.20) 0%, rgba(244,166,35,0.10) 38%, rgba(250,246,239,0) 72%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-sun-300 bg-sun-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-sun-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sun-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sun-500" />
            </span>
            Founding Pawthers · first {FOUNDING_CAP} only
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            Be one of the first {FOUNDING_CAP}
            <span className="text-sky-600"> dog people in.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-brand-700">
            {BRAND} puts an AI care companion, your dog's health records,
            on-demand services, and pet travel in one place. The first{' '}
            {FOUNDING_CAP} members get it free through the beta — and keep
            today's price forever.
          </p>

          <SpotMeter stats={stats} />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={session ? '/dashboard' : '/signup'}
              className="btn-primary px-7 py-3.5 text-base"
            >
              {session ? 'Go to dashboard' : 'Claim your founding spot'}
            </Link>
            <a href="#what" className="btn-ghost px-6 py-3 text-base">
              See what you get
            </a>
          </div>
          <p className="mt-4 text-xs text-brand-500">
            Free through the beta · No credit card · Every breed welcome
          </p>
        </div>
      </section>

      {/* The founding offer — the actual pitch */}
      <section id="what" className="border-y border-brand-200/60 bg-white/70">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <div className="text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              What a founding spot is worth
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-brand-600">
              We only do this once. After the hundredth member, the price is the
              price.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {foundingPerks.map((p, i) => (
              <div key={p.title} className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sun-100 text-sm font-bold text-sun-700">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1 text-sm text-brand-600">{p.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Price anchor */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {(
              [
                { tier: 'Basic', cents: FOUNDING_RATES.basic },
                { tier: 'Premium', cents: FOUNDING_RATES.premium },
              ] as const
            ).map((t) => (
              <div
                key={t.tier}
                className="rounded-2xl border border-brand-200 bg-brand-50 p-5 text-center"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                  {t.tier}
                </p>
                <p className="mt-1">
                  <span className="text-3xl font-bold">
                    {formatCents(t.cents)}
                  </span>
                  <span className="text-sm text-brand-500">/dog/mo later</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  $0 during your beta
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live ticker — real photos from the pack */}
      {showcase.length > 0 && (
        <section className="border-b border-brand-200/60 bg-white/60 py-5">
          <div className="mx-auto mb-3 flex max-w-6xl items-center gap-2 px-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-600" />
            </span>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              Live from the pack
            </h2>
          </div>
          <div className="relative overflow-hidden">
            <div className="flex w-max animate-ticker gap-3 px-4">
              {[...showcase, ...showcase].map((p, i) => (
                <figure
                  key={i}
                  className="w-44 shrink-0 overflow-hidden rounded-xl border border-brand-200 bg-white shadow-sm"
                >
                  <img
                    src={p.image_url}
                    alt={p.pet_name ?? 'A good dog'}
                    className="h-28 w-full object-cover"
                    loading="lazy"
                  />
                  <figcaption className="p-2">
                    <p className="truncate text-sm font-semibold text-brand-900">
                      {p.pet_name || 'A good dog'}
                    </p>
                    <p className="truncate text-xs text-brand-500">
                      {p.location ? `${p.location} · ` : ''}
                      {timeAgo(p.created_at)}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card border-t-4 border-t-sky-500">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                {f.tag}
              </span>
              <h3 className="mt-2 text-lg font-semibold leading-snug">{f.title}</h3>
              <p className="mt-2 text-sm text-brand-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* One app replaces the junk drawer */}
      <section className="mx-auto max-w-4xl px-4 pb-2 pt-6">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-brand-500">
          One membership replaces your whole junk drawer of pet apps
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {[
            'AI vet companion',
            'Health-records vault',
            'Grooming & mobile vet',
            'Background-checked sitters',
            'Premium food & Rx delivery',
            'Wearable health tracking',
            'Community feed',
            'Pet travel',
          ].map((x) => (
            <span
              key={x}
              className="rounded-full border border-brand-200 bg-white px-3 py-1 text-brand-700"
            >
              {x}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-semibold sm:text-3xl">
          How {BRAND} works
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-brand-600">
          We're the booking middleman: you tap a button, we fulfill it through
          pre-negotiated, vetted partners — bringing services in-house as we grow.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mx-auto mt-1 max-w-xs text-sm text-brand-600">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — the objections that stop a signup */}
      <section className="border-y border-brand-200/60 bg-white/70">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            Straight answers
          </h2>
          <div className="mt-8 divide-y divide-brand-200/70">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="shrink-0 text-xl leading-none text-brand-400 transition group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-brand-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA — claim, or join the waitlist if the 100 are gone */}
      <section id="join" className="mx-auto max-w-3xl px-4 py-16">
        <div className="card border-brand-200 bg-gradient-to-br from-sky-100 to-brand-100 text-center">
          {full ? (
            <>
              <h3 className="text-2xl font-semibold">
                All {FOUNDING_CAP} founding spots are claimed.
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-brand-700">
                Get on the waitlist and you're first in line for the next cohort —
                we invite in the order people joined.
              </p>
              <div className="mx-auto mt-6 max-w-lg">
                <JoinWaitlist source="landing-full" />
              </div>
            </>
          ) : (
            <>
              <h3 className="text-2xl font-semibold">
                {stats
                  ? `${Math.max(0, stats.cap - stats.claimed)} founding spots left.`
                  : 'Claim your founding spot.'}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-brand-700">
                Free through the beta, your rate locked after. Takes about a
                minute — add your dog and you're in.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={session ? '/dashboard' : '/signup'}
                  className="btn-primary px-7 py-3.5 text-base"
                >
                  {session ? 'Go to dashboard' : 'Claim your founding spot'}
                </Link>
              </div>
              <p className="mt-5 text-xs text-brand-600">
                Not ready to make an account? Leave your email and we'll hold
                your place in line.
              </p>
              <div className="mx-auto mt-3 max-w-sm">
                <JoinWaitlist source="landing" compact />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-200/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-brand-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/doodle.svg?v=crest2" alt="" className="h-6 w-6" />
            <span>{BRAND} — care for every breed</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/login" className="hover:text-brand-800">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-brand-800">
              Get started
            </Link>
            <Link to="/privacy" className="hover:text-brand-800">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-brand-800">
              Terms
            </Link>
            <span className="font-mono text-xs text-brand-400">{BUILD_VERSION}</span>
          </div>
        </div>
      </footer>

      {/* Sticky mobile CTA — the phone screen loses the header on scroll */}
      {!session && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-brand-50/95 px-4 py-3 backdrop-blur sm:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-900">
                {full ? 'Founding spots are gone' : 'Founding Pawthers'}
              </p>
              <p className="truncate text-xs text-brand-500">
                {stats
                  ? full
                    ? 'Join the waitlist'
                    : `${Math.max(0, stats.cap - stats.claimed)} of ${stats.cap} spots left`
                  : 'Free through the beta'}
              </p>
            </div>
            {full ? (
              <a href="#join" className="btn-primary shrink-0 text-sm">
                Join waitlist
              </a>
            ) : (
              <Link to="/signup" className="btn-primary shrink-0 text-sm">
                Claim spot
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
