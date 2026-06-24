import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { uploadPetPhoto } from '../lib/photos'
import type { Sex } from '../lib/types'

// Parse a typed birthday into an ISO date (YYYY-MM-DD), or null if invalid.
// Accepts separators (/, -, .) OR bare digits: MM/DD/YYYY, M/D/YY, YYYY-MM-DD,
// 03222020 (MMDDYYYY), 032220 (MMDDYY).
function iso(y: string, mo: string, d: string): string | null {
  const mn = Number(mo)
  const dn = Number(d)
  if (mn < 1 || mn > 12 || dn < 1 || dn > 31) return null
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseBirthdate(input: string): string | null {
  const s = input.trim()
  if (!s) return null

  // YYYY-MM-DD with separators
  let m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/)
  if (m) return iso(m[1], m[2], m[3])

  // MM/DD/YYYY or M/D/YY with separators
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return iso(y, m[1], m[2])
  }

  // Bare digits typed on a numeric keypad.
  const digits = s.replace(/\D/g, '')
  if (/^\d{8}$/.test(digits)) {
    // Prefer MMDDYYYY; fall back to YYYYMMDD.
    return (
      iso(digits.slice(4), digits.slice(0, 2), digits.slice(2, 4)) ||
      iso(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6))
    )
  }
  if (/^\d{6}$/.test(digits)) {
    // MMDDYY
    return iso(`20${digits.slice(4)}`, digits.slice(0, 2), digits.slice(2, 4))
  }

  return null
}

export default function CreatePet() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    breed: '',
    coat_type: '',
    birthdate: '',
    weight_lbs: '',
    sex: 'unknown' as Sex,
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setPhoto(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)

    // Accept a typed birthday in MM/DD/YYYY (or YYYY-MM-DD); store as ISO date.
    const birthdateIso = parseBirthdate(form.birthdate)
    if (form.birthdate.trim() && !birthdateIso) {
      setError('Enter the birthday as MM/DD/YYYY (e.g. 03/14/2021).')
      return
    }

    setBusy(true)
    try {
      const { data, error: insertError } = await supabase
        .from('pets')
        .insert({
          owner_id: user.id,
          name: form.name,
          breed: form.breed || null,
          coat_type: form.coat_type || null,
          birthdate: birthdateIso,
          weight_lbs: form.weight_lbs ? Number(form.weight_lbs) : null,
          sex: form.sex,
          photo_url: null,
          notes: null,
        })
        .select()
        .single()
      if (insertError) throw insertError

      // Upload the photo (if any) now that we have the pet id, then save its path.
      if (photo) {
        try {
          const path = await uploadPetPhoto(user.id, data.id, photo)
          await supabase.from('pets').update({ photo_url: path }).eq('id', data.id)
        } catch {
          // Non-fatal: the pet is created; they can add a photo later.
        }
      }

      navigate(`/pets/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create pet')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold text-brand-900">
        New pet profile
      </h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="flex items-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-3xl">
              🐶
            </div>
          )}
          <div>
            <label className="label" htmlFor="photo">Photo</label>
            <input
              id="photo"
              type="file"
              accept="image/*"
              className="input"
              onChange={onPhotoChange}
            />
            <p className="mt-1 text-xs text-brand-500">Optional — add a pic of your pup.</p>
          </div>
        </div>

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
            <label className="label" htmlFor="breed">Breed / mix</label>
            <input
              id="breed"
              className="input"
              value={form.breed}
              onChange={(e) => update('breed', e.target.value)}
              placeholder="Golden Retriever, Goldendoodle, mixed…"
            />
          </div>
          <div>
            <label className="label" htmlFor="coat_type">Coat type</label>
            <select
              id="coat_type"
              className="input"
              value={form.coat_type}
              onChange={(e) => update('coat_type', e.target.value)}
            >
              <option value="">—</option>
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
              <option value="wavy">Wavy</option>
              <option value="curly">Curly</option>
              <option value="double">Double</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="label" htmlFor="birthdate">Birthdate</label>
            <input
              id="birthdate"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="input"
              value={form.birthdate}
              onChange={(e) => update('birthdate', e.target.value)}
              placeholder="MM/DD/YYYY"
            />
          </div>
          <div className="min-w-0">
            <label className="label" htmlFor="weight_lbs">Weight (lbs)</label>
            <input
              id="weight_lbs"
              type="number"
              step="0.1"
              inputMode="decimal"
              className="input"
              value={form.weight_lbs}
              onChange={(e) => update('weight_lbs', e.target.value)}
              placeholder="45"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
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

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Create pet'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
