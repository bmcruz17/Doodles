const OPTIONS = [
  {
    icon: '✈️',
    title: 'Flights',
    body: 'In-cabin and private/charter arrangements so your dog never flies cargo.',
  },
  {
    icon: '🏡',
    title: 'Pet-friendly rentals',
    body: 'Vetted Airbnb and rental partners that actually welcome dogs.',
  },
  {
    icon: '🚗',
    title: 'Car rentals & ground transport',
    body: 'Dog-friendly cars and ground transport for the last mile.',
  },
  {
    icon: '🌺',
    title: 'Relocation & island logistics',
    body: 'FAVN titers, rabies timing, and import paperwork (e.g. Hawaii) handled end to end.',
  },
]

export default function Travel() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-900">Travel</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-600">
        The lifestyle layer: travel planning built around traveling with your
        dog. Booking opens in a later phase — here's what's coming.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <div key={o.title} className="card">
            <div className="text-3xl">{o.icon}</div>
            <h2 className="mt-2 text-lg font-semibold text-brand-900">{o.title}</h2>
            <p className="mt-1 text-sm text-brand-600">{o.body}</p>
            <button className="btn-ghost mt-4 text-sm" disabled>
              Plan a trip (coming soon)
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 border-brand-200 bg-white">
        <h3 className="font-semibold text-brand-900">
          🅿️ Member park &amp; place access
          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 align-middle text-xs font-normal text-brand-600">
            on the roadmap
          </span>
        </h3>
        <p className="mt-1 text-sm text-brand-600">
          An AAA-style perk network: membership unlocks access to private dog
          parks, sniff spots, and dog-welcoming places wherever you travel —
          plus member-only travel rates and concierge logistics.
        </p>
      </div>
    </div>
  )
}
