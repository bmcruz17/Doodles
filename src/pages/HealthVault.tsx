import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type {
  HealthRecord,
  HealthRecordType,
  Pet,
  Vaccination,
} from '../lib/types'

const RECORD_TYPES: HealthRecordType[] = [
  'vet_visit',
  'medication',
  'allergy',
  'weight_log',
  'lab_result',
  'note',
]

export default function HealthVault() {
  const { petId } = useParams<{ petId: string }>()
  const { user } = useAuth()
  const [pet, setPet] = useState<Pet | null>(null)
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!petId) return
    const [petRes, recRes, vaxRes] = await Promise.all([
      supabase.from('pets').select('*').eq('id', petId).single(),
      supabase
        .from('health_records')
        .select('*')
        .eq('pet_id', petId)
        .order('recorded_at', { ascending: false }),
      supabase
        .from('vaccinations')
        .select('*')
        .eq('pet_id', petId)
        .order('administered_at', { ascending: false }),
    ])
    setPet(petRes.data)
    setRecords(recRes.data ?? [])
    setVaccinations(vaxRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId])

  if (loading) return <p className="text-brand-600">Loading vault…</p>
  if (!pet) return <p className="text-brand-600">Pet not found.</p>

  return (
    <div className="space-y-8">
      <div>
        <Link to={`/pets/${pet.id}`} className="text-sm text-brand-600 hover:text-brand-800">
          ← {pet.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-900">
          {pet.name}'s Health Vault
        </h1>
        <p className="text-sm text-brand-600">
          Records, vaccinations, and documents — the foundation for {pet.name}'s
          AI companion.
        </p>
      </div>

      <RecordsSection
        petId={pet.id}
        userId={user?.id ?? ''}
        records={records}
        onChange={refresh}
      />

      <VaccinationsSection
        petId={pet.id}
        userId={user?.id ?? ''}
        vaccinations={vaccinations}
        onChange={refresh}
      />
    </div>
  )
}

// --------------------------------------------------------------------------
// Storage helpers
// --------------------------------------------------------------------------
async function uploadDocument(
  userId: string,
  petId: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${petId}/${Date.now()}_${safeName}`
  const { error } = await supabase.storage
    .from('pet-documents')
    .upload(path, file, { upsert: false })
  if (error) throw error
  return path
}

function DocumentLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  async function open() {
    const { data } = await supabase.storage
      .from('pet-documents')
      .createSignedUrl(path, 60)
    if (data?.signedUrl) {
      setUrl(data.signedUrl)
      window.open(data.signedUrl, '_blank', 'noopener')
    }
  }
  return (
    <button onClick={open} className="text-xs text-brand-600 underline hover:text-brand-800">
      {url ? 'Document' : 'View document'}
    </button>
  )
}

// --------------------------------------------------------------------------
// Health records
// --------------------------------------------------------------------------
function RecordsSection({
  petId,
  userId,
  records,
  onChange,
}: {
  petId: string
  userId: string
  records: HealthRecord[]
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<HealthRecordType>('vet_visit')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let document_url: string | null = null
      if (file) document_url = await uploadDocument(userId, petId, file)
      const { error: insertError } = await supabase
        .from('health_records')
        .insert({
          pet_id: petId,
          record_type: type,
          data: { title, notes },
          document_url,
          recorded_at: recordedAt
            ? new Date(recordedAt).toISOString()
            : new Date().toISOString(),
        })
      if (insertError) throw insertError
      setTitle('')
      setNotes('')
      setRecordedAt('')
      setFile(null)
      setOpen(false)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save record')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-900">Health records</h2>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-sm">
          {open ? 'Close' : '+ Add record'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="card mb-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as HealthRecordType)}
              >
                {RECORD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={recordedAt}
                onChange={(e) => setRecordedAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Annual wellness exam"
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vet observations, dosages, results…"
            />
          </div>
          <div>
            <label className="label">Document (optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save record'}
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <p className="text-sm text-brand-500">No records yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.id} className="card flex items-start justify-between gap-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs uppercase tracking-wide text-brand-700">
                    {r.record_type.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-medium text-brand-900">
                    {r.data?.title || 'Untitled'}
                  </span>
                </div>
                {r.data?.notes && (
                  <p className="mt-1 text-sm text-brand-600">{r.data.notes}</p>
                )}
                {r.document_url && (
                  <div className="mt-1">
                    <DocumentLink path={r.document_url} />
                  </div>
                )}
              </div>
              <time className="shrink-0 text-xs text-brand-500">
                {new Date(r.recorded_at).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --------------------------------------------------------------------------
// Vaccinations
// --------------------------------------------------------------------------
function VaccinationsSection({
  petId,
  userId,
  vaccinations,
  onChange,
}: {
  petId: string
  userId: string
  vaccinations: Vaccination[]
  onChange: () => void
}) {
  const [open, setOpen] = useState(false)
  const [vaccine, setVaccine] = useState('')
  const [administeredAt, setAdministeredAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [vet, setVet] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      let certificate_url: string | null = null
      if (file) certificate_url = await uploadDocument(userId, petId, file)
      const { error: insertError } = await supabase
        .from('vaccinations')
        .insert({
          pet_id: petId,
          vaccine,
          administered_at: administeredAt,
          expires_at: expiresAt || null,
          veterinarian: vet || null,
          certificate_url,
        })
      if (insertError) throw insertError
      setVaccine('')
      setAdministeredAt('')
      setExpiresAt('')
      setVet('')
      setFile(null)
      setOpen(false)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vaccination')
    } finally {
      setBusy(false)
    }
  }

  function expiryClass(expires_at: string | null): string {
    if (!expires_at) return 'text-brand-500'
    return new Date(expires_at) < new Date()
      ? 'text-red-400'
      : 'text-brand-600'
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-brand-900">Vaccinations</h2>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-sm">
          {open ? 'Close' : '+ Add vaccination'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="card mb-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Vaccine</label>
              <input
                className="input"
                required
                value={vaccine}
                onChange={(e) => setVaccine(e.target.value)}
                placeholder="Rabies"
              />
            </div>
            <div>
              <label className="label">Veterinarian</label>
              <input
                className="input"
                value={vet}
                onChange={(e) => setVet(e.target.value)}
                placeholder="Dr. Smith"
              />
            </div>
            <div>
              <label className="label">Administered</label>
              <input
                type="date"
                className="input"
                required
                value={administeredAt}
                onChange={(e) => setAdministeredAt(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Expires</label>
              <input
                type="date"
                className="input"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">Certificate (optional)</label>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="input"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save vaccination'}
          </button>
        </form>
      )}

      {vaccinations.length === 0 ? (
        <p className="text-sm text-brand-500">No vaccinations yet.</p>
      ) : (
        <ul className="space-y-2">
          {vaccinations.map((v) => (
            <li key={v.id} className="card flex items-start justify-between gap-4 py-3">
              <div>
                <span className="text-sm font-medium text-brand-900">
                  {v.vaccine}
                </span>
                {v.veterinarian && (
                  <p className="text-xs text-brand-500">{v.veterinarian}</p>
                )}
                {v.certificate_url && (
                  <div className="mt-1">
                    <DocumentLink path={v.certificate_url} />
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right text-xs">
                <div className="text-brand-500">
                  Given {new Date(v.administered_at).toLocaleDateString()}
                </div>
                {v.expires_at && (
                  <div className={expiryClass(v.expires_at)}>
                    Expires {new Date(v.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
