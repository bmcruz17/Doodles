import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { generateSampleData } from '../lib/devices'
import { deviceInsights, tractiveSync } from '../lib/api'
import type { Device, DeviceAlert, DeviceDaily, Pet } from '../lib/types'

function avg(rows: DeviceDaily[], key: keyof DeviceDaily): number | null {
  const vals = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number')
  if (!vals.length) return null
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
}

const SEV: Record<string, string> = {
  info: 'border-l-emerald-400 bg-emerald-50',
  watch: 'border-l-amber-400 bg-amber-50',
  urgent: 'border-l-red-400 bg-red-50',
}

export default function WearableHealth() {
  const { petId } = useParams<{ petId: string }>()
  const { user } = useAuth()
  const [pet, setPet] = useState<Pet | null>(null)
  const [device, setDevice] = useState<Device | null>(null)
  const [daily, setDaily] = useState<DeviceDaily[]>([])
  const [alerts, setAlerts] = useState<DeviceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<string | null>(null)

  async function load() {
    if (!petId) return
    const [petRes, devRes, dailyRes, alertRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase.from('devices').select('*').eq('pet_id', petId).maybeSingle(),
      supabase.from('device_daily').select('*').eq('pet_id', petId).order('day', { ascending: true }),
      supabase.from('device_alerts').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
    ])
    setPet(petRes.data)
    setDevice((devRes.data as Device | null) ?? null)
    setDaily(dailyRes.data ?? [])
    setAlerts(alertRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId])

  async function connect() {
    if (!petId || !user) return
    setBusy('connect')
    try {
      const { data } = await supabase
        .from('devices')
        .insert({ pet_id: petId, owner_id: user.id, name: 'PackHub Band' })
        .select()
        .single()
      setDevice((data as Device) ?? null)
    } finally {
      setBusy(null)
    }
  }

  async function sample() {
    if (!petId || !device) return
    setBusy('sample')
    try {
      await generateSampleData(petId, device.id)
      await load()
    } finally {
      setBusy(null)
    }
  }

  async function analyze() {
    if (!petId) return
    setBusy('analyze')
    setAiSummary(null)
    try {
      const res = await deviceInsights(petId)
      setAiSummary(res.summary)
      await load()
    } catch {
      setAiSummary('Could not analyze right now.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <p className="text-brand-600">Loading vitals…</p>
  if (!pet) return <p className="text-brand-600">Pet not found.</p>

  const last7 = daily.slice(-7)
  const metrics: { label: string; value: string }[] = [
    { label: 'Avg steps', value: fmt(avg(last7, 'steps')) },
    { label: 'Avg heart rate', value: fmt(avg(last7, 'avg_heart_rate'), ' bpm') },
    { label: 'Avg resp rate', value: fmt(avg(last7, 'avg_resp_rate'), ' /min') },
    { label: 'Avg sleep', value: hrs(avg(last7, 'sleep_minutes')) },
    { label: 'Avg water', value: fmt(avg(last7, 'water_ml'), ' ml') },
    { label: 'Scratching', value: fmt(avg(last7, 'scratch_events'), '/day') },
    { label: 'Limp score', value: fmt(avg(last7, 'limp_score')) },
    { label: 'Play', value: fmt(avg(last7, 'play_minutes'), ' min') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/pets/${pet.id}`} className="text-sm text-brand-600 hover:text-brand-800">
          ← {pet.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-900">Wearable &amp; vitals</h1>
        <p className="text-sm text-brand-600">
          Continuous health monitoring from {pet.name}'s PackHub Band, interpreted by AI.
        </p>
      </div>

      {!device ? (
        <div className="card border-sky-200 bg-sky-50/60">
          <h2 className="text-lg font-semibold text-brand-900">Connect a wearable</h2>
          <p className="mt-1 text-sm text-brand-600">
            Pair {pet.name}'s PackHub Band to track activity, heart &amp; respiratory
            rate, sleep, scratching, gait/limp, and food &amp; water — all read by the
            AI companion.
          </p>
          <button onClick={connect} disabled={busy === 'connect'} className="btn-primary mt-3">
            {busy === 'connect' ? 'Pairing…' : 'Connect PackHub Band'}
          </button>
          <div className="mt-4 border-t border-sky-200 pt-4">
            <p className="text-sm font-medium text-brand-800">Already have a Tractive tracker?</p>
            <p className="text-xs text-brand-600">Connect it to sync activity into PackHub now.</p>
            <TractiveConnect petId={pet.id} onConnected={load} />
          </div>
        </div>
      ) : (
        <>
          {/* AI insights */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                AI health signals
              </h2>
              <button onClick={analyze} disabled={busy === 'analyze'} className="btn-ghost text-sm">
                {busy === 'analyze' ? 'Analyzing…' : 'Run AI analysis'}
              </button>
            </div>
            {aiSummary && <p className="mb-2 text-sm text-brand-700">{aiSummary}</p>}
            {alerts.length === 0 ? (
              <p className="text-sm text-brand-500">
                No signals yet. Add data, then run the AI analysis.
              </p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a) => (
                  <div key={a.id} className={`rounded-lg border-l-4 p-3 ${SEV[a.severity]}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {a.severity}
                      </span>
                      <span className="text-sm font-semibold text-brand-900">{a.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-brand-700">{a.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Metric tiles */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
              7-day averages
            </h2>
            {daily.length === 0 ? (
              <div className="card text-sm text-brand-600">
                No data yet.{' '}
                <button onClick={sample} disabled={busy === 'sample'} className="text-sky-600 underline">
                  {busy === 'sample' ? 'Generating…' : 'Generate sample data'}
                </button>{' '}
                to preview the dashboard.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((m) => (
                  <div key={m.label} className="card">
                    <p className="text-xs uppercase tracking-wide text-brand-500">{m.label}</p>
                    <p className="mt-1 text-lg font-semibold text-brand-900">{m.value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Trend bars */}
          {daily.length > 0 && (
            <section className="space-y-4">
              <Trend title="Steps" rows={daily} field="steps" />
              <Trend title="Scratching events" rows={daily} field="scratch_events" />
              <Trend title="Limp score" rows={daily} field="limp_score" max={1} />
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={sample} disabled={busy === 'sample'} className="btn-ghost text-sm">
              {busy === 'sample' ? 'Generating…' : 'Generate sample data'}
            </button>
            {device.last_seen_at && (
              <span className="self-center text-xs text-brand-400">
                Last sync {new Date(device.last_seen_at).toLocaleString()}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function TractiveConnect({ petId, onConnected }: { petId: string; onConnected: () => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await tractiveSync(petId, email, password)
      setMsg(res.message)
      if (res.status === 'connected') {
        setEmail('')
        setPassword('')
        onConnected()
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not connect')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost mt-2 text-sm">
        Connect Tractive
      </button>
    )
  }
  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Tractive email" />
      <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tractive password" />
      <p className="text-xs text-brand-400">
        Used once to link your tracker; we store only the session token, never your password.
      </p>
      {msg && <p className="text-sm text-brand-600">{msg}</p>}
      <button type="submit" disabled={busy} className="btn-primary text-sm">
        {busy ? 'Connecting…' : 'Connect & sync'}
      </button>
    </form>
  )
}

function fmt(v: number | null, suffix = ''): string {
  return v == null ? '—' : `${v}${suffix}`
}
function hrs(mins: number | null): string {
  return mins == null ? '—' : `${(mins / 60).toFixed(1)} h`
}

function Trend({
  title,
  rows,
  field,
  max,
}: {
  title: string
  rows: DeviceDaily[]
  field: keyof DeviceDaily
  max?: number
}) {
  const vals = rows.map((r) => (typeof r[field] === 'number' ? (r[field] as number) : 0))
  const top = max ?? Math.max(1, ...vals)
  return (
    <div className="card">
      <h3 className="mb-2 text-sm font-semibold text-brand-800">{title}</h3>
      <div className="flex h-24 items-end gap-1">
        {rows.map((r) => {
          const v = typeof r[field] === 'number' ? (r[field] as number) : 0
          return (
            <div key={r.id} className="flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-sky-500"
                style={{ height: `${Math.max(2, (v / top) * 100)}%` }}
                title={`${r.day}: ${v}`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
