import { useState } from 'react'
import { joinWaitlist } from '../lib/founding'

/**
 * Waitlist capture. Two skins for two places it appears:
 *   `landing` — on-brand, inside the marketing page.
 *   `gate`    — the navy/gold beta passcode card, which has its own palette.
 * Email is the only required field; the rest is optional because every extra
 * required box costs signups.
 */
export default function JoinWaitlist({
  source,
  variant = 'landing',
  compact = false,
}: {
  source: string
  variant?: 'landing' | 'gate'
  compact?: boolean
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [dogName, setDogName] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gate = variant === 'gate'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await joinWaitlist({ email, name, dog_name: dogName, source })
      setDone(true)
    } catch {
      setError('Something went wrong — try again?')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div
        className={
          gate
            ? 'mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700'
            : 'rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-left'
        }
      >
        <p className={gate ? '' : 'font-semibold text-emerald-800'}>
          You're on the list.
        </p>
        {!gate && (
          <p className="mt-1 text-sm text-emerald-700">
            We'll email your invite as spots open. Founding spots are given out
            in the order people joined.
          </p>
        )}
      </div>
    )
  }

  const inputClass = gate
    ? 'w-full rounded-xl border-[1.5px] border-[#e4ddcf] bg-[#fbfaf7] px-3 py-2.5 text-[#182a44] placeholder:text-[#9aa3b2] focus:border-[#182a44] focus:outline-none focus:ring-2 focus:ring-[#182a44]/15'
    : 'w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-brand-900 placeholder:text-brand-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'

  const buttonClass = gate
    ? 'shrink-0 rounded-xl bg-[#182a44] px-4 text-sm font-semibold text-white hover:bg-[#22375a] disabled:opacity-50'
    : 'shrink-0 rounded-xl bg-sky-600 px-6 py-3 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-50'

  if (compact) {
    return (
      <form onSubmit={submit} className={gate ? 'mt-5' : ''}>
        <div className="flex gap-2">
          <input
            type="email"
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
          />
          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? '…' : 'Join'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-left">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
        />
        <input
          type="text"
          className={inputClass}
          value={dogName}
          onChange={(e) => setDogName(e.target.value)}
          placeholder="Your dog's name"
        />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
        />
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Saving…' : 'Claim my spot'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-brand-500">
        Free during the beta. No card, no obligation — unsubscribe any time.
      </p>
    </form>
  )
}
