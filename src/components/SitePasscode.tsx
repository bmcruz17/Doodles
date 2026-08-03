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
    <div className="relative flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 24 24' fill='%231a6fc0'%3E%3Ccircle cx='7' cy='9' r='1.8'/%3E%3Ccircle cx='11' cy='6.5' r='1.8'/%3E%3Ccircle cx='15.5' cy='7.5' r='1.8'/%3E%3Cpath d='M12 12c-2.6 0-4.7 1.9-4.7 4 0 1.6 1.3 2.4 2.8 2.4.9 0 1.3-.3 1.9-.3s1 .3 1.9.3c1.5 0 2.8-.8 2.8-2.4 0-2.1-2.1-4-4.7-4Z'/%3E%3C/svg%3E\")",
          backgroundSize: '90px 90px',
        }}
      />
      <div className="card relative w-full max-w-sm text-center">
        <img src="/doodle.svg" alt="" className="mx-auto mb-4 h-14 w-14" />
        <h1 className="text-xl font-semibold text-brand-900">{BRAND} — private beta</h1>
        <p className="mt-1 text-sm text-brand-600">
          We're in closed testing. Enter your invite passcode to continue.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className="input text-center"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setError(false)
            }}
            placeholder="Invite passcode"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">That passcode didn't work.</p>}
          <button type="submit" className="btn-primary w-full">
            Enter
          </button>
        </form>

        <Waitlist />

        <div className="mt-4 flex justify-center gap-4 text-xs text-brand-400">
          <a href="/privacy" className="hover:text-brand-600">Privacy</a>
          <a href="/terms" className="hover:text-brand-600">Terms</a>
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
    return <p className="mt-4 text-sm text-emerald-600">You're on the list — we'll be in touch!</p>
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-xs text-sky-600 hover:text-sky-700">
        Not invited yet? Join the waitlist →
      </button>
    )
  }
  return (
    <form onSubmit={join} className="mt-4 flex gap-2">
      <input
        type="email"
        required
        className="input"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
      />
      <button type="submit" disabled={busy} className="btn-ghost text-sm">
        {busy ? '…' : 'Join'}
      </button>
    </form>
  )
}
