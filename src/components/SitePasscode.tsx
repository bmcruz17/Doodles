import { useState } from 'react'
import { isUnlocked, unlock } from '../lib/gate'
import { supabase } from '../lib/supabase'
import { BRAND } from '../version'

// Paths that must stay publicly reachable even behind the beta wall — the App
// Store requires the privacy policy URL to load without a login/gate.
const PUBLIC_PATHS = ['/privacy', '/terms']

const PAW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90' viewBox='0 0 24 24' fill='%23e7e1d4'%3E%3Ccircle cx='7' cy='9' r='1.7'/%3E%3Ccircle cx='11' cy='6.5' r='1.7'/%3E%3Ccircle cx='15.5' cy='7.5' r='1.7'/%3E%3Cpath d='M12 12c-2.6 0-4.7 1.9-4.7 4 0 1.6 1.3 2.4 2.8 2.4.9 0 1.3-.3 1.9-.3s1 .3 1.9.3c1.5 0 2.8-.8 2.8-2.4 0-2.1-2.1-4-4.7-4Z'/%3E%3C/svg%3E\")"

export default function SitePasscode({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(isUnlocked())
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const path = typeof window !== 'undefined' ? window.location.pathname : '/'
  if (ok || PUBLIC_PATHS.includes(path)) return <>{children}</>

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (unlock(code)) setOk(true)
    else {
      setError(true)
      setCode('')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: '#f4f1ea' }}>
      <div className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: PAW, backgroundSize: '104px 104px', opacity: 0.4 }} />

      <div className="relative w-full max-w-sm rounded-3xl border border-[#ece5d8] bg-white p-9 text-center"
        style={{ boxShadow: '0 20px 50px -12px rgba(23,39,61,0.18)' }}>
        <img
          src="/doodle.svg?v=crest2"
          alt=""
          className="mx-auto h-[76px] w-[76px] rounded-[18px]"
          style={{ boxShadow: '0 8px 20px -6px rgba(23,39,61,0.35)' }}
        />
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#c69022]">
          Private beta
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#182a44]">{BRAND}</h1>
        <p className="mx-auto mt-2.5 max-w-[16rem] text-sm leading-relaxed text-[#6b7688]">
          We're in closed testing. Enter your invite passcode to continue.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border-[1.5px] border-[#e4ddcf] bg-[#fbfaf7] px-4 py-3.5 text-center text-[#182a44] placeholder:text-[#9aa3b2] focus:border-[#182a44] focus:outline-none focus:ring-2 focus:ring-[#182a44]/15"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(false)
            }}
            placeholder="Invite passcode"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">That passcode didn't work.</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#182a44] px-4 py-3.5 font-semibold text-white transition hover:bg-[#22375a]"
          >
            Enter
          </button>
        </form>

        <Waitlist />

        <div className="mt-5 flex justify-center gap-4 border-t border-[#f0ece2] pt-4 text-xs text-[#9aa3b2]">
          <a href="/privacy" className="hover:text-[#6b7688]">Privacy</a>
          <a href="/terms" className="hover:text-[#6b7688]">Terms</a>
        </div>
      </div>
    </div>
  )
}

function Waitlist() {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      await supabase.from('waitlist').insert({ email: email.trim(), source: 'gate' })
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return <p className="mt-5 text-sm font-medium text-emerald-600">You're on the list — we'll be in touch! 🐾</p>
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-5 text-sm font-semibold text-[#1f5fa6] hover:text-[#184b83]">
        Not invited yet? Join the waitlist →
      </button>
    )
  }
  return (
    <form onSubmit={join} className="mt-5 flex gap-2">
      <input
        type="email"
        required
        className="w-full rounded-xl border-[1.5px] border-[#e4ddcf] bg-[#fbfaf7] px-3 py-2.5 text-[#182a44] placeholder:text-[#9aa3b2] focus:border-[#182a44] focus:outline-none focus:ring-2 focus:ring-[#182a44]/15"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
      />
      <button type="submit" disabled={busy}
        className="shrink-0 rounded-xl bg-[#182a44] px-4 text-sm font-semibold text-white hover:bg-[#22375a] disabled:opacity-50">
        {busy ? '…' : 'Join'}
      </button>
    </form>
  )
}
