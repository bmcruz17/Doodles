import { useState } from 'react'
import { isUnlocked, unlock } from '../lib/gate'
import { supabase } from '../lib/supabase'
import { BRAND } from '../version'

// Paths that must stay publicly reachable even behind the beta wall — the App
// Store requires the privacy policy URL to load without a login/gate.
const PUBLIC_PATHS = ['/privacy', '/terms']

// Beta wall shown before anything else until the passcode is entered.
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{ background: 'linear-gradient(160deg,#17273d 0%,#0b1524 100%)' }}>
      {/* subtle gold paw pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%23f2b04a'%3E%3Ccircle cx='7' cy='9' r='1.8'/%3E%3Ccircle cx='11' cy='6.5' r='1.8'/%3E%3Ccircle cx='15.5' cy='7.5' r='1.8'/%3E%3Cpath d='M12 12c-2.6 0-4.7 1.9-4.7 4 0 1.6 1.3 2.4 2.8 2.4.9 0 1.3-.3 1.9-.3s1 .3 1.9.3c1.5 0 2.8-.8 2.8-2.4 0-2.1-2.1-4-4.7-4Z'/%3E%3C/svg%3E\")",
          backgroundSize: '92px 92px',
        }}
      />
      {/* top glow */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 40% at 50% 0%, rgba(242,176,74,0.12) 0%, rgba(0,0,0,0) 70%)' }} />

      <div className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur-sm">
        <img src="/doodle.svg?v=crest2" alt="" className="mx-auto h-20 w-20 drop-shadow-lg" />
        <h1 className="mt-4 text-xl font-semibold text-white">{BRAND} — private beta</h1>
        <p className="mt-1.5 text-sm text-slate-300">
          We're in closed testing. Enter your invite passcode to continue.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-center text-white placeholder:text-slate-400 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(false)
            }}
            placeholder="Invite passcode"
            autoFocus
          />
          {error && <p className="text-sm text-red-400">That passcode didn't work.</p>}
          <button
            type="submit"
            className="w-full rounded-xl px-4 py-3 font-semibold text-[#12203a] shadow-lg transition hover:brightness-105"
            style={{ background: 'linear-gradient(180deg,#ffdd93 0%,#e8a032 100%)' }}
          >
            Enter
          </button>
        </form>

        <Waitlist />

        <div className="mt-5 flex justify-center gap-4 text-xs text-slate-400">
          <a href="/privacy" className="hover:text-slate-200">Privacy</a>
          <a href="/terms" className="hover:text-slate-200">Terms</a>
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
    return <p className="mt-5 text-sm text-amber-300">You're on the list — we'll be in touch! 🐾</p>
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-5 text-sm font-medium text-amber-300 hover:text-amber-200">
        Not invited yet? Join the waitlist →
      </button>
    )
  }
  return (
    <form onSubmit={join} className="mt-5 flex gap-2">
      <input
        type="email"
        required
        className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white placeholder:text-slate-400 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
      />
      <button type="submit" disabled={busy}
        className="shrink-0 rounded-xl border border-amber-400/40 px-3 text-sm font-medium text-amber-300 hover:bg-amber-400/10">
        {busy ? '…' : 'Join'}
      </button>
    </form>
  )
}
