import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Sex } from '../lib/types'

export default function CreatePet() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    doodle_type: '',
    breed: '',
    coat_type: '',
    birthdate: '',
    weight_lbs: '',
    sex: 'unknown' as Sex,
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setBusy(true)
    try {
      const { data, error: insertError } = await supabase
        .from('pets')
        .insert({
          owner_id: user.id,
          name: form.name,
          doodle_type: form.doodle_type || null,
          breed: form.breed || null,
          coat_type: form.coat_type || null,
          birthdate: form.birthdate || null,
          weight_lbs: form.weight_lbs ? Number(form.weight_lbs) : null,
          sex: form.sex,
          photo_url: null,
          notes: null,
        })
        .select()
        .single()
      if (insertError) throw insertError
      navigate(`/pets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pet')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-brand-50">
        New pet profile
      </h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Name *</label>
          <input
            id="name"
            required
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Aspen"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="doodle_type">Doodle type</label>
            <input
              id="doodle_type"
              className="input"
              value={form.doodle_type}
              onChange={(e) => update('doodle_type', e.target.value)}
              placeholder="Goldendoodle"
            />
          </div>
          <div>
            <label className="label" htmlFor="breed">Breed / mix</label>
            <input
              id="breed"
              className="input"
              value={form.breed}
              onChange={(e) => update('breed', e.target.value)}
              placeholder="mini_goldendoodle"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="coat_type">Coat type</label>
            <select
              id="coat_type"
              className="input"
              value={form.coat_type}
              onChange={(e) => update('coat_type', e.target.value)}
            >
              <option value="">—</option>
              <option value="wavy">Wavy</option>
              <option value="curly">Curly</option>
              <option value="straight">Straight</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sex">Sex</label>
            <select
              id="sex"
              className="input"
              value={form.sex}
              onChange={(e) => update('sex', e.target.value as Sex)}
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="birthdate">Birthdate</label>
            <input
              id="birthdate"
              type="date"
              className="input"
              value={form.birthdate}
              onChange={(e) => update('birthdate', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="weight_lbs">Weight (lbs)</label>
            <input
              id="weight_lbs"
              type="number"
              step="0.1"
              className="input"
              value={form.weight_lbs}
              onChange={(e) => update('weight_lbs', e.target.value)}
              placeholder="45"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Create pet'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
