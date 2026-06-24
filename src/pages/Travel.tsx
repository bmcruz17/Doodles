const OPTIONS = [
  {
    tag: 'Flights',
    title: 'Fly without the cargo hold',
    body: 'In-cabin bookings and private/charter options so your dog travels with you, not below you.',
  },
  {
    tag: 'Stays',
    title: 'Genuinely pet-friendly rentals',
    body: 'Vetted homes and hotels that actually welcome dogs — no surprise fees or "no pets" at check-in.',
  },
  {
    tag: 'Ground',
    title: 'Cars and last-mile transport',
    body: 'Dog-friendly rental cars and ground transport booked alongside the rest of your trip.',
  },
  {
    tag: 'Relocation',
    title: 'Cross-border, handled',
    body: 'Titer tests, rabies timing, and import paperwork (Hawaii and beyond) managed end to end.',
  },
]

export default function Travel() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Travel</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-600">
        Plan trips around traveling with your dog. Booking opens in a later
        phase — here's what's coming.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <div key={o.tag} className="card border-t-4 border-t-sky-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-600">
              {o.tag}
            </span>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-brand-900">
              {o.title}
            </h2>
            <p className="mt-2 text-sm text-brand-600">{o.body}</p>
            <button className="btn-ghost mt-4 text-sm" disabled>
              Plan a trip (coming soon)
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 bg-gradient-to-br from-sky-100 to-brand-100">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-brand-900">
            Member park &amp; place access
          </h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-600">
            on the roadmap
          </span>
        </div>
        <p className="mt-1 text-sm text-brand-700">
          An AAA-style perk network: your membership unlocks private dog parks,
          sniff spots, and dog-welcoming places wherever you travel — plus
          member-only travel rates and concierge logistics.
        </p>
      </div>
    </div>
  )
}
