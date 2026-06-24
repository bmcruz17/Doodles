import { useEffect, useState } from 'react'
import {
  adminOverview,
  adminAction,
  type AdminOverview,
} from '../lib/api'

type Board = 'vendors' | 'bookings' | 'sitters'

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Admin() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading')
  const [board, setBoard] = useState<Board>('vendors')
  const [working, setWorking] = useState<string | null>(null)

  async function load() {
    try {
      const res = await adminOverview()
      setData(res)
      setState('ok')
    } catch (err) {
      const m = err instanceof Error ? err.message : ''
      setState(/forbidden|403/i.test(m) ? 'denied' : 'error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function move(
    action: 'set_vendor_status' | 'set_booking_status' | 'set_sitter_status',
    id: string,
    value: string,
    verified?: boolean,
  ) {
    setWorking(id)
    try {
      await adminAction(action, id, value, verified)
      await load()
    } finally {
      setWorking(null)
    }
  }

  if (state === 'loading') return <p className="text-brand-600">Loading admin…</p>
  if (state === 'denied')
    return (
      <div className="card mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold text-brand-900">Admins only</h1>
        <p className="mt-1 text-sm text-brand-600">
          This area is restricted to PackHub operators.
        </p>
      </div>
    )
  if (state === 'error' || !data)
    return <p className="text-red-500">Couldn't load the admin dashboard.</p>

  const m = data.metrics
  const vendorName = new Map(data.vendors.map((v) => [v.id, v.name]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">Ops dashboard</h1>
        <p className="text-sm text-brand-600">
          Track vendors, bookings, and sitter verification as you scale.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Members" value={m.members} />
        <Metric label="Pets" value={m.pets} />
        <Metric label="Active vendors" value={`${m.active_vendors}/${m.vendors}`} />
        <Metric label="Bookings" value={m.bookings} />
        <Metric label="GMV" value={money(m.gmv)} />
        <Metric label="Commission" value={money(m.commission)} accent />
      </div>

      {/* Board switcher */}
      <div className="flex gap-2">
        {(['vendors', 'bookings', 'sitters'] as Board[]).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              board === b
                ? 'bg-sky-600 text-white'
                : 'border border-brand-200 bg-white text-brand-700 hover:border-sky-400'
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {board === 'vendors' && (
        <Kanban
          columns={[
            { key: 'pending', label: 'Applied / review' },
            { key: 'active', label: 'Active' },
            { key: 'paused', label: 'Paused' },
          ]}
          items={data.vendors.map((v) => ({ id: v.id, col: v.status, node: (
            <Card title={v.name} subtitle={`${v.category.replace('_', ' ')}${v.location ? ` · ${v.location}` : ''}`}>
              <span className="text-xs text-emerald-700">{v.member_discount_pct}% member discount</span>
              <div className="mt-2 flex flex-wrap gap-1">
                {v.status !== 'active' && (
                  <Move busy={working === v.id} onClick={() => move('set_vendor_status', v.id, 'active')}>
                    Approve →
                  </Move>
                )}
                {v.status !== 'paused' && (
                  <Move busy={working === v.id} ghost onClick={() => move('set_vendor_status', v.id, 'paused')}>
                    Pause
                  </Move>
                )}
                {v.status === 'paused' && (
                  <Move busy={working === v.id} onClick={() => move('set_vendor_status', v.id, 'active')}>
                    Reactivate
                  </Move>
                )}
              </div>
            </Card>
          ) }))}
        />
      )}

      {board === 'bookings' && (
        <Kanban
          columns={[
            { key: 'requested', label: 'New requests' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'completed', label: 'Completed' },
            { key: 'cancelled', label: 'Cancelled' },
          ]}
          items={data.bookings.map((b) => ({ id: b.id, col: b.status, node: (
            <Card
              title={vendorName.get(b.vendor_id ?? '') || 'Service'}
              subtitle={new Date(b.created_at).toLocaleDateString()}
            >
              <span className="text-xs text-brand-600">
                {money(Number(b.amount))} · {money(Number(b.commission))} comm.
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {b.status === 'requested' && (
                  <Move busy={working === b.id} onClick={() => move('set_booking_status', b.id, 'confirmed')}>
                    Confirm →
                  </Move>
                )}
                {b.status === 'confirmed' && (
                  <Move busy={working === b.id} onClick={() => move('set_booking_status', b.id, 'completed')}>
                    Complete →
                  </Move>
                )}
                {b.status !== 'cancelled' && b.status !== 'completed' && (
                  <Move busy={working === b.id} ghost onClick={() => move('set_booking_status', b.id, 'cancelled')}>
                    Cancel
                  </Move>
                )}
              </div>
            </Card>
          ) }))}
        />
      )}

      {board === 'sitters' && (
        <Kanban
          columns={[
            { key: 'review', label: 'Pending review' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ]}
          items={data.sitters.map((s) => ({
            id: s.id,
            col:
              s.background_check_status === 'approved'
                ? 'approved'
                : s.background_check_status === 'rejected'
                  ? 'rejected'
                  : 'review',
            node: (
              <Card title={s.display_name || 'Sitter'} subtitle={s.location || '—'}>
                <span className="text-xs text-brand-600">
                  Check: {s.background_check_status.replace('_', ' ')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.background_check_status !== 'approved' && (
                    <Move busy={working === s.id} onClick={() => move('set_sitter_status', s.id, 'approved', true)}>
                      Approve ✓
                    </Move>
                  )}
                  {s.background_check_status !== 'rejected' && (
                    <Move busy={working === s.id} ghost onClick={() => move('set_sitter_status', s.id, 'rejected', false)}>
                      Reject
                    </Move>
                  )}
                </div>
              </Card>
            ),
          }))}
        />
      )}
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'border-emerald-200 bg-emerald-50/60' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-brand-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? 'text-emerald-700' : 'text-brand-900'}`}>
        {value}
      </p>
    </div>
  )
}

type Item = { id: string; col: string; node: React.ReactNode }

function Kanban({
  columns,
  items,
}: {
  columns: { key: string; label: string }[]
  items: Item[]
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((c) => {
        const colItems = items.filter((i) => i.col === c.key)
        return (
          <div key={c.key} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-800">{c.label}</h3>
              <span className="rounded-full bg-brand-100 px-2 text-xs text-brand-600">
                {colItems.length}
              </span>
            </div>
            <div className="space-y-2 rounded-xl bg-brand-100/50 p-2">
              {colItems.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-brand-400">Empty</p>
              ) : (
                colItems.map((i) => <div key={i.id}>{i.node}</div>)
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-brand-200 bg-white p-3 shadow-sm">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      {subtitle && <p className="text-xs text-brand-500">{subtitle}</p>}
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Move({
  children,
  onClick,
  busy,
  ghost,
}: {
  children: React.ReactNode
  onClick: () => void
  busy?: boolean
  ghost?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
        ghost
          ? 'border border-brand-200 text-brand-600 hover:bg-brand-100'
          : 'bg-sky-600 text-white hover:bg-sky-500'
      }`}
    >
      {busy ? '…' : children}
    </button>
  )
}
