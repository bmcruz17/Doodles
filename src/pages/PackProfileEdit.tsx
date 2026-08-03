import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getMyPack, uploadPackAvatar, normalizeHandle } from '../lib/packProfile'
import type { PackProfile, Pet } from '../lib/types'

export default function PackProfileEdit() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [existing, setExisting] = useState<PackProfile | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([getMyPack(user.id), supabase.from('pets').select('*').order('created_at')]).then(
      ([pack, petRes]) => {
        if (pack) {
          setExisting(pack)
          setHandle(pack.handle)
          setDisplayName(pack.display_name)
          setBio(pack.bio)
          setPreview(pack.avatar_url)
        }
        setPets(petRes.data ?? [])
        setLoading(false)
      },
    )
  }, [user])

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setAvatar(f)
    if (f) setPreview(URL.createObjectURL(f))
  }

  // Suggest a display name / handle from the household's dogs.
  const dogNames = pets.map((p) => p.name).filter(Boolean)
  const suggestion =
    dogNames.length === 1
      ? dogNames[0]
      : dogNames.length === 2
        ? `${dogNames[0]} & ${dogNames[1]}`
        : dogNames.length > 2
          ? `${dogNames[0]}, ${dogNames[1]} & the pack`
          : ''

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const h = normalizeHandle(handle)
    if (h.length < 2) {
      setError('Pick a handle (letters, numbers, _ or .).')
      return
    }
    setBusy(true)
    setError(null)
    try {
      let avatar_url = existing?.avatar_url ?? null
      if (avatar) avatar_url = await uploadPackAvatar(user.id, avatar)
      const { error: upErr } = await supabase.from('pack_profiles').upsert(
        {
          user_id: user.id,
          handle: h,
          display_name: displayName.trim() || suggestion || h,
          bio: bio.trim(),
          avatar_url,
        },
        { onConflict: 'user_id' },
      )
      if (upErr) {
        setError(/duplicate|unique/i.test(upErr.message) ? 'That handle is taken.' : upErr.message)
        return
      }
      navigate(`/u/${h}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-brand-600">Loading…</p>

  return (
    <form onSubmit={save} className="mx-auto max-w-md space-y-4">
      <div>
        <Link to="/feed" className="text-sm text-brand-600 hover:text-brand-800">← Feed</Link>
        <h1 className="mt-2 text-2xl font-semibold text-brand-900">
          {existing ? 'Edit your pack profile' : 'Create your pack profile'}
        </h1>
        <p className="mt-1 text-sm text-brand-600">
          One profile for your household — it can represent one dog or your whole pack.
          This is who your posts show up as.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
            {preview ? (
              <img src={preview} alt="" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-2xl">
                🐾
              </div>
            )}
          </label>
          <div className="text-xs text-brand-500">Tap to add a profile photo</div>
        </div>

        <div>
          <label className="label">Handle</label>
          <div className="flex items-center gap-1">
            <span className="text-brand-400">@</span>
            <input
              className="input"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="thedoodleduo"
            />
          </div>
        </div>

        <div>
          <label className="label">Display name</label>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={suggestion || 'The Doodle Duo'}
          />
          {suggestion && !displayName && (
            <button
              type="button"
              onClick={() => setDisplayName(suggestion)}
              className="mt-1 text-xs text-sky-600"
            >
              Use "{suggestion}"
            </button>
          )}
        </div>

        <div>
          <label className="label">Bio</label>
          <textarea
            className="input min-h-[70px]"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Two doodles causing chaos in Austin 🐶🐶"
          />
        </div>

        {pets.length > 0 && (
          <p className="text-xs text-brand-500">
            Represents: {dogNames.join(', ')}
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Saving…' : existing ? 'Save profile' : 'Create profile'}
        </button>
      </div>
    </form>
  )
}
