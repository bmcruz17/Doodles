import { useEffect, useState } from 'react'
import { resolvePhotoUrl } from '../lib/photos'

// Renders a pet's photo (resolving a signed URL from a stored path) or a
// friendly emoji fallback. `size` controls the square dimension in px.
export default function PetAvatar({
  photoUrl,
  name,
  size = 64,
  rounded = 'full',
}: {
  photoUrl: string | null
  name?: string
  size?: number
  rounded?: 'full' | '2xl'
}) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setUrl(null)
    resolvePhotoUrl(photoUrl).then((u) => active && setUrl(u))
    return () => {
      active = false
    }
  }, [photoUrl])

  const radius = rounded === 'full' ? 'rounded-full' : 'rounded-2xl'
  const style = { width: size, height: size }

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'Pet'}
        style={style}
        className={`${radius} object-cover`}
      />
    )
  }

  return (
    <div
      style={style}
      className={`flex items-center justify-center ${radius} bg-brand-100`}
    >
      <span style={{ fontSize: size * 0.5 }}>🐶</span>
    </div>
  )
}
