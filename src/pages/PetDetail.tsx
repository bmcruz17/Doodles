import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { uploadPetPhoto, uploadPetFile } from '../lib/photos'
import PetAvatar from '../components/PetAvatar'
import type { Json, Pet } from '../lib/types'

// ZXing is heavy — only load it when the camera scanner is opened.
const BarcodeScanner = lazy(() => import('../components/BarcodeScanner'))

function ageFrom(birthdate: string | null): string | null {
  if (!birthdate) return null
  const birth = new Date(birthdate)
  const now = new Date()
  const months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth())
  if (months < 12) return `${months} mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem ? `${years} yr ${rem} mo` : `${years} yr`
}

export default function PetDetail() {
  const { petId } = useParams<{ petId: string }>()
  const { user } = useAuth()
  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [chip, setChip] = useState('')
  const [savingChip, setSavingChip] = useState(false)
  const [chipUploading, setChipUploading] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [chipMsg, setChipMsg] = useState<string | null>(null)
  const [neutered, setNeutered] = useState<'yes' | 'no' | 'unknown'>('unknown')
  const [interests, setInterests] = useState('')
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [prefsMsg, setPrefsMsg] = useState<string | null>(null)

  async function savePrefs() {
    if (!pet) return
    setSavingPrefs(true)
    setPrefsMsg(null)
    try {
      const next = {
        neutered: neutered === 'yes' ? true : neutered === 'no' ? false : null,
        interests: interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      await supabase.from('pets').update(next).eq('id', pet.id)
      setPet({ ...pet, ...next })
      setPrefsMsg('Saved.')
    } catch (err) {
      setPrefsMsg(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSavingPrefs(false)
    }
  }

  function profileObj(p: Pet): Record<string, unknown> {
    return p.ai_profile && typeof p.ai_profile === 'object' && !Array.isArray(p.ai_profile)
      ? (p.ai_profile as Record<string, unknown>)
      : {}
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !pet) return
    setUploading(true)
    try {
      const path = await uploadPetPhoto(user.id, pet.id, file)
      await supabase.from('pets').update({ photo_url: path }).eq('id', pet.id)
      setPet({ ...pet, photo_url: path })
    } finally {
      setUploading(false)
    }
  }

  async function saveChip() {
    if (!pet) return
    setSavingChip(true)
    setChipMsg(null)
    try {
      const num = chip.trim()
      const next = {
        ...profileObj(pet),
        microchip: { status: num ? 'yes' : 'unknown', number: num || null },
      } as Json
      await supabase.from('pets').update({ ai_profile: next }).eq('id', pet.id)
      setPet({ ...pet, ai_profile: next })
      setChipMsg('Saved.')
    } catch (err) {
      setChipMsg(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSavingChip(false)
    }
  }

  async function onChipDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user || !pet) return
    setChipUploading(true)
    setChipMsg(null)
    try {
      const path = await uploadPetFile(user.id, pet.id, file)
      await supabase.from('health_records').insert({
        pet_id: pet.id,
        record_type: 'note',
        data: { title: 'Microchip paperwork', notes: 'Uploaded from the pet page.' },
        document_url: path,
      })
      setChipMsg('Document saved to the health vault.')
    } catch (err) {
      setChipMsg(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setChipUploading(false)
    }
  }

  useEffect(() => {
    if (!petId) return
    let active = true
    supabase
      .from('pets')
      .select('*')
      .eq('id', petId)
      .single()
      .then(({ data }) => {
        if (active) {
          setPet(data)
          const num = (data && (profileObj(data).microchip as any))?.number
          if (num) setChip(String(num))
          if (data) {
            setNeutered(
              data.neutered === true ? 'yes' : data.neutered === false ? 'no' : 'unknown',
            )
            setInterests((data.interests ?? []).join(', '))
          }
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [petId])

  if (loading) return <p className="text-brand-600">Loading…</p>
  if (!pet) return <p className="text-brand-600">Pet not found.</p>

  const age = ageFrom(pet.birthdate)

  const facts: [string, string | null][] = [
    ['Breed', pet.breed],
    ['Coat', pet.coat_type],
    ['Sex', pet.sex],
    ['Age', age],
    ['Weight', pet.weight_lbs ? `${pet.weight_lbs} lbs` : null],
  ]

  return (
    <div>
      <Link to="/dashboard" className="text-sm text-brand-600 hover:text-brand-800">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <div className="relative">
            <PetAvatar photoUrl={pet.photo_url} name={pet.name} size={96} rounded="2xl" />
            <label
              title="Change photo"
              className="absolute -bottom-1 -right-1 cursor-pointer rounded-full bg-sky-600 p-2 text-sm text-white shadow hover:bg-sky-500"
            >
              <input type="file" accept="image/*" className="hidden" onChange={onPhoto} disabled={uploading} />
              {uploading ? '…' : '📷'}
            </label>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-brand-900">{pet.name}</h1>
            <p className="text-brand-600">
              {pet.breed || 'Dog'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-brand-900">Profile</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-brand-500">
                  {label}
                </dt>
                <dd className="text-sm text-brand-800">{value || '—'}</dd>
              </div>
            ))}
          </dl>
          {pet.notes && (
            <p className="mt-4 border-t border-brand-200 pt-4 text-sm text-brand-700">
              {pet.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link to={`/pets/${pet.id}/companion`} className="card flex items-center justify-between gap-3 transition hover:border-sky-400">
            <div>
              <h3 className="font-semibold text-brand-900">AI Companion</h3>
              <p className="mt-1 text-sm text-brand-600">
                Ask anything about {pet.name}, answered from their records.
              </p>
            </div>
            <span className="text-brand-300">→</span>
          </Link>
          <Link to={`/pets/${pet.id}/vault`} className="card flex items-center justify-between gap-3 transition hover:border-sky-400">
            <div>
              <h3 className="font-semibold text-brand-900">Health Vault</h3>
              <p className="mt-1 text-sm text-brand-600">
                Vaccinations, vet visits, and documents.
              </p>
            </div>
            <span className="text-brand-300">→</span>
          </Link>
          <Link to="/membership" className="card flex items-center justify-between gap-3 transition hover:border-sky-400">
            <div>
              <h3 className="font-semibold text-brand-900">Membership</h3>
              <p className="mt-1 text-sm text-brand-600">
                Discounts, the AI companion, and member travel rates.
              </p>
            </div>
            <span className="text-brand-300">→</span>
          </Link>
        </div>
      </div>

      {/* Microchip */}
      <div className="card mt-5">
        <h2 className="text-lg font-semibold text-brand-900">Microchip</h2>
        <p className="mb-3 mt-1 text-sm text-brand-600">
          Add {pet.name}'s 15-digit chip number — type it, scan the barcode on the
          paperwork, or upload the document. (A phone can't read the implanted chip
          itself, but it can read the number off the paperwork.)
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="label">Chip number</label>
            <input
              className="input"
              inputMode="numeric"
              value={chip}
              onChange={(e) => setChip(e.target.value)}
              placeholder="e.g. 985112345678901"
            />
          </div>
          <button type="button" onClick={() => setScanOpen(true)} className="btn-ghost">
            📷 Scan barcode
          </button>
          <button onClick={saveChip} disabled={savingChip} className="btn-primary">
            {savingChip ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="btn-ghost cursor-pointer text-sm">
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onChipDoc}
              disabled={chipUploading}
            />
            {chipUploading ? 'Uploading…' : 'Upload paperwork'}
          </label>
          <a
            href="https://www.aaha.org/your-pet/pet-microchip-lookup/microchip-search/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-sky-600 underline hover:text-sky-700"
          >
            Look it up in the registry
          </a>
          {chipMsg && <span className="text-sm text-brand-600">{chipMsg}</span>}
        </div>
      </div>

      {/* Profile & preferences (powers care tips + relevant offers) */}
      <div className="card mt-5">
        <h2 className="text-lg font-semibold text-brand-900">Profile &amp; preferences</h2>
        <p className="mb-3 mt-1 text-sm text-brand-600">
          Helps {pet.name}'s AI companion tailor advice and surfaces relevant
          offers in your feed. We never share your individual info with vendors.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="label">Spayed / neutered</label>
            <select
              className="input"
              value={neutered}
              onChange={(e) => setNeutered(e.target.value as 'yes' | 'no' | 'unknown')}
            >
              <option value="unknown">Prefer not to say</option>
              <option value="yes">Yes</option>
              <option value="no">No / intact</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="label">Favorite toys, treats &amp; activities</label>
            <input
              className="input"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder="tennis balls, peanut butter, hiking"
            />
          </div>
          <button onClick={savePrefs} disabled={savingPrefs} className="btn-primary">
            {savingPrefs ? 'Saving…' : 'Save'}
          </button>
        </div>
        {prefsMsg && <p className="mt-2 text-sm text-brand-600">{prefsMsg}</p>}
      </div>

      {scanOpen && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onResult={(t) => {
              setChip(t.replace(/\D/g, ''))
              setScanOpen(false)
            }}
            onClose={() => setScanOpen(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
