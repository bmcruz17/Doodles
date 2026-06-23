const OPTIONS = [
  {
    icon: '✈️',
    title: 'Flights',
    body: 'In-cabin and private/charter arrangements so your doodle never flies cargo.',
  },
  {
    icon: '🏡',
    title: 'Pet-friendly rentals',
    body: 'Vetted Airbnb and rental partners that actually welcome doodles.',
  },
  {
    icon: '🚗',
    title: 'Car rentals & ground transport',
    body: 'Doodle-friendly cars and ground transport for the last mile.',
  },
  {
    icon: '🌺',
    title: 'Hawaii & island logistics',
    body: 'FAVN titers, rabies timing, and AQS paperwork handled end to end.',
  },
]

export default function Travel() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-brand-50">Doodle Travel</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-300">
        The lifestyle layer: travel planning built around traveling with your
        doodle. Booking opens in a later phase — here's what's coming.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <div key={o.title} className="card">
            <div className="text-3xl">{o.icon}</div>
            <h2 className="mt-2 text-lg font-semibold text-brand-50">{o.title}</h2>
            <p className="mt-1 text-sm text-brand-300">{o.body}</p>
            <button className="btn-ghost mt-4 text-sm" disabled>
              Plan a trip (coming soon)
            </button>
          </div>
        ))}
      </div>

      <div className="card mt-6 border-brand-700 bg-brand-900/40">
        <h3 className="font-semibold text-brand-50">Member travel rates</h3>
        <p className="mt-1 text-sm text-brand-300">
          Membership unlocks member-only travel pricing and concierge logistics.
          Manage your membership from the Membership tab.
        </p>
      </div>
    </div>
  )
}
