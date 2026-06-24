import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { BRAND, BUILD_VERSION } from '../version'

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
  {
    n: '1',
    title: 'Add your dog',
    body: 'Build a profile in a minute — any breed, any mix.',
  },
  {
    n: '2',
    title: 'Book what you need',
    body: 'Pick a service or just ask your AI companion.',
  },
  {
    n: '3',
    title: 'We handle the rest',
    body: 'Vetted partners fulfill it at pre-negotiated rates. You just show up.',
  },
]

export default function Landing() {
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-brand-200/60 bg-brand-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/doodle.svg" alt={BRAND} className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">{BRAND}</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {session ? (
              <Link to="/dashboard" className="btn-primary text-sm">
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Log in
                </Link>
                <Link to="/signup" className="btn-primary text-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(70% 60% at 50% -10%, rgba(78,166,247,0.22) 0%, rgba(244,166,35,0.10) 38%, rgba(250,246,239,0) 72%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-4 py-20 text-center sm:py-28">
          <span className="inline-block rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-sky-600">
            Care for every breed
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            Everything your dog needs,
            <span className="text-sky-600"> in one place.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-brand-700">
            {BRAND} bundles an AI care companion, a health-records vault,
            on-demand services, and pet travel into one membership — so you can
            stop juggling ten apps for one dog.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to={session ? '/dashboard' : '/signup'} className="btn-primary px-6 py-3 text-base">
              {session ? 'Go to dashboard' : 'Get started free'}
            </Link>
            <a href="#how" className="btn-ghost px-6 py-3 text-base">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-brand-500">
            No credit card to start · Built for doodles, made for every dog.
          </p>
        </div>
      </section>

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
              <p className="mx-auto mt-1 max-w-xs text-sm text-brand-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Membership band */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="card flex flex-col items-center gap-4 border-brand-200 bg-gradient-to-br from-sky-100 to-brand-100 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="text-xl font-semibold">
              One membership. Every dog need covered.
            </h3>
            <p className="mt-1 text-sm text-brand-700">
              Marketplace discounts, the AI companion, your health vault, member
              travel rates — plus AAA-style access to private dog parks and
              dog-welcoming places, coming soon.
            </p>
          </div>
          <Link
            to={session ? '/membership' : '/signup'}
            className="btn-primary shrink-0 px-6 py-3 text-base"
          >
            {session ? 'View membership' : 'Join the pack'}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-200/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-brand-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <img src="/doodle.svg" alt="" className="h-6 w-6" />
            <span>{BRAND} — care for every breed</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-brand-800">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-brand-800">
              Get started
            </Link>
            <span className="font-mono text-xs text-brand-400">
              {BUILD_VERSION}
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
