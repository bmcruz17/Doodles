import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { getPackByHandle } from '../lib/packProfile'
import type { PackProfile, Post } from '../lib/types'

export default function PackProfileView() {
  const { handle } = useParams<{ handle: string }>()
  const { user } = useAuth()
  const [pack, setPack] = useState<PackProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!handle) return
    let active = true
    getPackByHandle(handle).then(async (p) => {
      if (!active) return
      setPack(p)
      if (p) {
        const { data } = await supabase
          .from('posts')
          .select('*')
          .eq('author_id', p.user_id)
          .eq('kind', 'member')
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false })
        setPosts(data ?? [])
      }
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [handle])

  if (loading) return <p className="text-brand-600">Loading…</p>
  if (!pack)
    return (
      <div className="mx-auto max-w-md text-center">
        <p className="text-brand-600">No pack found at @{handle}.</p>
        <Link to="/feed" className="mt-3 inline-block text-sky-600">← Back to the feed</Link>
      </div>
    )

  const isMine = user?.id === pack.user_id

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/feed" className="text-sm text-brand-600 hover:text-brand-800">← Feed</Link>

      <header className="mt-3 flex items-center gap-5">
        {pack.avatar_url ? (
          <img src={pack.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover sm:h-24 sm:w-24" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-3xl sm:h-24 sm:w-24">
            🐾
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-xl font-semibold text-brand-900">
              {pack.display_name || `@${pack.handle}`}
            </h1>
            {isMine && (
              <Link to="/profile" className="btn-ghost px-2 py-1 text-xs">Edit</Link>
            )}
          </div>
          <p className="text-sm text-brand-500">@{pack.handle}</p>
          <p className="mt-1 text-sm text-brand-700">
            <span className="font-semibold">{posts.length}</span>{' '}
            <span className="text-brand-500">posts</span>
          </p>
        </div>
      </header>

      {pack.bio && <p className="mt-3 text-sm text-brand-700">{pack.bio}</p>}

      <div className="mt-5 grid grid-cols-3 gap-1 sm:gap-2">
        {posts.length === 0 ? (
          <p className="col-span-3 py-8 text-center text-sm text-brand-500">No posts yet.</p>
        ) : (
          posts.map((p) => (
            <div key={p.id} className="aspect-square overflow-hidden rounded-md bg-brand-100">
              {p.image_url && (
                <img src={p.image_url} alt={p.caption} className="h-full w-full object-cover" loading="lazy" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
