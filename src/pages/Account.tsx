import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { deleteAccount } from '../lib/api'

export default function Account() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-brand-900">Account &amp; settings</h1>

      <div className="card">
        <p className="text-xs uppercase tracking-wide text-brand-500">Signed in as</p>
        <p className="text-brand-900">{user?.email}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link to="/privacy" className="text-sky-600 underline">Privacy Policy</Link>
          <Link to="/terms" className="text-sky-600 underline">Terms of Service</Link>
        </div>
      </div>

      <FeedbackCard email={user?.email ?? null} userId={user?.id ?? ''} />

      <DeleteCard
        onDeleted={async () => {
          await signOut()
          navigate('/')
        }}
      />
    </div>
  )
}

function FeedbackCard({ email, userId }: { email: string | null; userId: string }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || !userId) return
    setBusy(true)
    try {
      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        email,
        message: message.trim(),
        context: 'account',
      })
      if (!error) {
        setSent(true)
        setMessage('')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-brand-900">Send feedback</h2>
      <p className="mt-1 text-sm text-brand-600">
        Found a bug or have an idea? Tell us — this is a beta and your input shapes it.
      </p>
      {sent ? (
        <p className="mt-3 text-sm text-emerald-600">Thanks — we got it.</p>
      ) : (
        <form onSubmit={submit} className="mt-3 space-y-2">
          <textarea
            className="input min-h-[90px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What's working, what's not, what you wish it did…"
          />
          <button type="submit" disabled={busy || !message.trim()} className="btn-primary">
            {busy ? 'Sending…' : 'Send feedback'}
          </button>
        </form>
      )}
    </div>
  )
}

function DeleteCard({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account')
      setBusy(false)
    }
  }

  return (
    <div className="card border-red-200">
      <h2 className="text-lg font-semibold text-brand-900">Delete account</h2>
      <p className="mt-1 text-sm text-brand-600">
        Permanently deletes your account, your dogs' profiles, records, photos, and all
        associated data. This cannot be undone.
      </p>
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="btn-ghost mt-3 border-red-300 text-red-600">
          Delete my account
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-brand-700">
            Type <strong>DELETE</strong> to confirm.
          </p>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={remove}
              disabled={busy || text !== 'DELETE'}
              className="btn-primary bg-red-600 hover:bg-red-500"
            >
              {busy ? 'Deleting…' : 'Permanently delete'}
            </button>
            <button onClick={() => setConfirming(false)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
