import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BRAND } from '../version'
import type { Pet } from '../lib/types'

export default function Dashboard() {
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (active) {
          setPets(data ?? [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return <p className="text-brand-300">Loading your pack…</p>
  }

  // First-login onboarding: prompt to create a pet profile.
  if (pets.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center">
        <div className="card">
          <img src="/doodle.svg" alt="" className="mx-auto mb-4 h-16 w-16" />
          <h1 className="text-xl font-semibold text-brand-50">
            Welcome to {BRAND}!
          </h1>
          <p className="mt-2 text-sm text-brand-300">
            Let's start by creating a profile for your dog. It powers the AI
            companion, your health vault, and member perks.
          </p>
          <Link to="/pets/new" className="btn-primary mt-5 inline-flex">
            Create your pet profile
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-brand-50">Your pack</h1>
        <Link to="/pets/new" className="btn-primary">
          + Add a pet
        </Link>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {pets.map((pet) => (
          <Link key={pet.id} to={`/pets/${pet.id}`} className="card transition hover:border-brand-600">
            <div className="flex items-center gap-4">
              {pet.photo_url ? (
                <img
                  src={pet.photo_url}
                  alt={pet.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-800 text-2xl">
                  🐶
                </div>
              )}
              <div>
                <h2 className="text-lg font-semibold text-brand-50">{pet.name}</h2>
                <p className="text-sm text-brand-300">
                  {pet.breed || 'Dog'}
                </p>
                {pet.coat_type && (
                  <p className="text-xs text-brand-400">{pet.coat_type} coat</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
