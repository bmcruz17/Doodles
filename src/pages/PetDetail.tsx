import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { uploadPetPhoto } from '../lib/photos'
import PetAvatar from '../components/PetAvatar'
import type { Pet } from '../lib/types'

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
          <Link to={`/pets/${pet.id}/companion`} className="card transition hover:border-brand-300">
            <h3 className="font-semibold text-brand-900">🤖 AI Companion</h3>
            <p className="mt-1 text-sm text-brand-600">
              Ask anything about {pet.name}, grounded in their records.
            </p>
          </Link>
          <Link to={`/pets/${pet.id}/vault`} className="card transition hover:border-brand-300">
            <h3 className="font-semibold text-brand-900">📋 Health Vault</h3>
            <p className="mt-1 text-sm text-brand-600">
              Records, vaccinations, and documents.
            </p>
          </Link>
          <Link to="/membership" className="card transition hover:border-brand-300">
            <h3 className="font-semibold text-brand-900">⭐ Membership</h3>
            <p className="mt-1 text-sm text-brand-600">
              Unlock discounts, AI, and member travel rates.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
