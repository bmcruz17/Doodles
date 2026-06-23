import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
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
  const [pet, setPet] = useState<Pet | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) return <p className="text-brand-300">Loading…</p>
  if (!pet) return <p className="text-brand-300">Pet not found.</p>

  const age = ageFrom(pet.birthdate)

  const facts: [string, string | null][] = [
    ['Doodle type', pet.doodle_type],
    ['Breed', pet.breed],
    ['Coat', pet.coat_type],
    ['Sex', pet.sex],
    ['Age', age],
    ['Weight', pet.weight_lbs ? `${pet.weight_lbs} lbs` : null],
  ]

  return (
    <div>
      <Link to="/" className="text-sm text-brand-300 hover:text-brand-100">
        ← Back to dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          {pet.photo_url ? (
            <img
              src={pet.photo_url}
              alt={pet.name}
              className="h-24 w-24 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-800 text-4xl">
              🐩
            </div>
          )}
          <div>
            <h1 className="text-3xl font-semibold text-brand-50">{pet.name}</h1>
            <p className="text-brand-300">
              {pet.doodle_type || pet.breed || 'Doodle'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold text-brand-50">Profile</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs uppercase tracking-wide text-brand-400">
                  {label}
                </dt>
                <dd className="text-sm text-brand-100">{value || '—'}</dd>
              </div>
            ))}
          </dl>
          {pet.notes && (
            <p className="mt-4 border-t border-brand-800 pt-4 text-sm text-brand-200">
              {pet.notes}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Link to={`/pets/${pet.id}/companion`} className="card transition hover:border-brand-600">
            <h3 className="font-semibold text-brand-50">🤖 AI Companion</h3>
            <p className="mt-1 text-sm text-brand-300">
              Ask anything about {pet.name}, grounded in their records.
            </p>
          </Link>
          <Link to={`/pets/${pet.id}/vault`} className="card transition hover:border-brand-600">
            <h3 className="font-semibold text-brand-50">📋 Health Vault</h3>
            <p className="mt-1 text-sm text-brand-300">
              Records, vaccinations, and documents.
            </p>
          </Link>
          <Link to="/membership" className="card transition hover:border-brand-600">
            <h3 className="font-semibold text-brand-50">⭐ Membership</h3>
            <p className="mt-1 text-sm text-brand-300">
              Unlock discounts, AI, and member travel rates.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
