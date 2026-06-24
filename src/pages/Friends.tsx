import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { addFriend } from '../lib/api'
import type { Friendship } from '../lib/types'

export default function Friends() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function load() {
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .order('created_at', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const uid = user?.id
  const incoming = rows.filter((r) => r.status === 'pending' && r.addressee_id === uid)
  const sent = rows.filter((r) => r.status === 'pending' && r.requester_id === uid)
  const friends = rows.filter((r) => r.status === 'accepted')

  function nameFor(r: Friendship): string {
    return r.requester_id === uid ? r.addressee_name : r.requester_name
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await addFriend(email.trim())
      setMsg({ text: res.message, ok: res.status !== 'not_member' })
      if (res.status === 'sent' || res.status === 'accepted') setEmail('')
      load()
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : 'Could not send request',
        ok: false,
      })
    } finally {
      setBusy(false)
    }
  }

  async function accept(id: string) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id)
    load()
  }
  async function remove(id: string) {
    await supabase.from('friendships').delete().eq('id', id)
    load()
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">Friends</h1>
        <p className="text-sm text-brand-600">
          Connect with other members by the email they signed up with.
        </p>
      </div>

      <InviteCard />

      <form onSubmit={submit} className="card space-y-3">
        <label className="label">Add a friend by email</label>
        <div className="flex gap-2">
          <input
            type="email"
            className="input flex-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@email.com"
          />
          <button type="submit" disabled={busy || !email.trim()} className="btn-primary">
            {busy ? 'Sending…' : 'Add'}
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {msg.text}
          </p>
        )}
      </form>

      {loading ? (
        <p className="text-brand-600">Loading…</p>
      ) : (
        <>
          {incoming.length > 0 && (
            <Section title="Friend requests">
              {incoming.map((r) => (
                <Row key={r.id} name={r.requester_name}>
                  <button onClick={() => accept(r.id)} className="btn-primary px-3 py-1 text-xs">
                    Accept
                  </button>
                  <button onClick={() => remove(r.id)} className="btn-ghost px-3 py-1 text-xs">
                    Decline
                  </button>
                </Row>
              ))}
            </Section>
          )}

          <Section title={`Friends${friends.length ? ` (${friends.length})` : ''}`}>
            {friends.length === 0 ? (
              <p className="text-sm text-brand-500">
                No friends yet — add someone by their email above.
              </p>
            ) : (
              friends.map((r) => (
                <Row key={r.id} name={nameFor(r)}>
                  <button onClick={() => remove(r.id)} className="text-xs text-brand-400 hover:text-red-500">
                    Remove
                  </button>
                </Row>
              ))
            )}
          </Section>

          {sent.length > 0 && (
            <Section title="Pending sent">
              {sent.map((r) => (
                <Row key={r.id} name={r.addressee_name}>
                  <span className="text-xs text-brand-500">Pending</span>
                  <button onClick={() => remove(r.id)} className="text-xs text-brand-400 hover:text-red-500">
                    Cancel
                  </button>
                </Row>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

// Cross-platform invite: Web Share (phones) → native share sheet (incl.
// contacts/Messages); falls back to copying the link. Reading the contact list
// directly is native-only (Capacitor Contacts) / Chrome-Android (Contact
// Picker), so sharing a link is the universal path.
function InviteCard() {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/signup`
  const text = 'Join me on PackHub — everything for our dogs in one app.'

  async function invite() {
    const nav = navigator as Navigator & {
      share?: (d: { title?: string; text?: string; url?: string }) => Promise<void>
    }
    if (nav.share) {
      try {
        await nav.share({ title: 'PackHub', text, url: link })
        return
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${link}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="card flex flex-col gap-2 border-sky-200 bg-sky-50/60 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="font-semibold text-brand-900">Invite friends from your phone</h2>
        <p className="text-sm text-brand-600">
          Share an invite to anyone in your contacts. When they join, add them here.
        </p>
      </div>
      <button onClick={invite} className="btn-primary shrink-0">
        {copied ? 'Link copied!' : 'Share invite'}
      </button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 font-semibold text-sky-700">
        {(name || '?').charAt(0).toUpperCase()}
      </div>
      <span className="flex-1 truncate text-sm font-medium text-brand-900">{name}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
