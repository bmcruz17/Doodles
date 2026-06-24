import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { uploadPostPhoto, extractHashtags } from '../lib/posts'
import type { Pet, Post, PostComment } from '../lib/types'

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [authorName, setAuthorName] = useState<string>('')
  const [likes, setLikes] = useState<Record<string, number>>({})
  const [likedByMe, setLikedByMe] = useState<Set<string>>(new Set())
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  async function load() {
    const [{ data: postRows }, { data: likeRows }] = await Promise.all([
      supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(60),
      supabase.from('post_likes').select('post_id, user_id'),
    ])
    const ps = postRows ?? []
    setPosts(ps)

    const counts: Record<string, number> = {}
    const mine = new Set<string>()
    for (const l of likeRows ?? []) {
      counts[l.post_id] = (counts[l.post_id] ?? 0) + 1
      if (l.user_id === user?.id) mine.add(l.post_id)
    }
    setLikes(counts)
    setLikedByMe(mine)

    if (ps.length) {
      const { data: cRows } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', ps.map((p) => p.id))
      const cc: Record<string, number> = {}
      for (const c of cRows ?? []) cc[c.post_id] = (cc[c.post_id] ?? 0) + 1
      setCommentCounts(cc)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('pets').select('*').order('created_at'),
      supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
    ]).then(([petRes, profRes]) => {
      setPets(petRes.data ?? [])
      const n = (profRes.data as { name: string | null } | null)?.name
      setAuthorName(n?.trim() || user.email?.split('@')[0] || 'Member')
    })
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function toggleLike(postId: string) {
    if (!user) return
    const liked = likedByMe.has(postId)
    // optimistic
    setLikedByMe((s) => {
      const n = new Set(s)
      liked ? n.delete(postId) : n.add(postId)
      return n
    })
    setLikes((c) => ({ ...c, [postId]: (c[postId] ?? 0) + (liked ? -1 : 1) }))
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id })
    }
  }

  // Sponsored (vendor) posts only show to owners whose dog matches the target
  // breed; member posts always show. Untargeted vendor posts show to everyone.
  const petBreeds = pets
    .map((p) => (p.breed || '').toLowerCase().trim())
    .filter(Boolean)
  function matchesBreed(target: string | null): boolean {
    if (!target || !target.trim()) return true
    const t = target.toLowerCase().trim()
    return petBreeds.some((b) => b.includes(t) || t.includes(b))
  }
  const visible = posts.filter(
    (p) => p.kind !== 'vendor' || matchesBreed(p.target_breed),
  )

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">The Pack</h1>
          <p className="text-sm text-brand-600">
            Live shots from dogs around the community. Share yours.
          </p>
        </div>
        <Link to="/friends" className="btn-ghost shrink-0 text-sm">
          Friends
        </Link>
      </div>

      <Composer
        userId={user?.id ?? ''}
        authorName={authorName}
        pets={pets}
        onPosted={load}
      />

      {loading ? (
        <p className="text-brand-600">Loading the feed…</p>
      ) : visible.length === 0 ? (
        <div className="card text-center text-sm text-brand-500">
          No posts yet — be the first to share a photo of your dog!
        </div>
      ) : (
        visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            userId={user?.id ?? ''}
            authorName={authorName}
            likeCount={likes[post.id] ?? 0}
            liked={likedByMe.has(post.id)}
            commentCount={commentCounts[post.id] ?? 0}
            onToggleLike={() => toggleLike(post.id)}
            onCommentAdded={() =>
              setCommentCounts((c) => ({ ...c, [post.id]: (c[post.id] ?? 0) + 1 }))
            }
            canDelete={post.author_id === user?.id}
            onDeleted={load}
            timeAgo={timeAgo}
          />
        ))
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
function Composer({
  userId,
  authorName,
  pets,
  onPosted,
}: {
  userId: string
  authorName: string
  pets: Pet[]
  onPosted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [petId, setPetId] = useState('')
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
    if (f) setOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || (!file && !caption.trim())) return
    setBusy(true)
    setError(null)
    try {
      let image_url: string | null = null
      if (file) image_url = await uploadPostPhoto(userId, file)
      const pet = pets.find((p) => p.id === petId)
      const { error: insErr } = await supabase.from('posts').insert({
        author_id: userId,
        author_name: authorName || 'Member',
        pet_id: petId || null,
        pet_name: pet?.name ?? null,
        caption: caption.trim(),
        image_url,
        location: location.trim() || null,
        hashtags: extractHashtags(caption),
      })
      if (insErr) throw insErr
      setCaption('')
      setLocation('')
      setFile(null)
      setPreview(null)
      setOpen(false)
      if (fileRef.current) fileRef.current.value = ''
      onPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <div className="flex items-center gap-3">
        <label className="btn-primary cursor-pointer">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={pick}
          />
          📸 Snap / upload
        </label>
        <input
          className="input flex-1"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Say something… #goodboy"
        />
      </div>

      {preview && (
        <img src={preview} alt="" className="max-h-72 w-full rounded-xl object-cover" />
      )}

      {open && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pets.length > 0 && (
            <div>
              <label className="label">Which dog?</label>
              <select
                className="input"
                value={petId}
                onChange={(e) => setPetId(e.target.value)}
              >
                <option value="">— Optional —</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zilker Park, Austin"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {open && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={() => {
              setOpen(false)
              setCaption('')
              setLocation('')
              setFile(null)
              setPreview(null)
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || (!file && !caption.trim())}
            className="btn-primary text-sm"
          >
            {busy ? 'Posting…' : 'Share'}
          </button>
        </div>
      )}
    </form>
  )
}

// --------------------------------------------------------------------------
function PostCard({
  post,
  userId,
  authorName,
  likeCount,
  liked,
  commentCount,
  onToggleLike,
  onCommentAdded,
  canDelete,
  onDeleted,
  timeAgo,
}: {
  post: Post
  userId: string
  authorName: string
  likeCount: number
  liked: boolean
  commentCount: number
  onToggleLike: () => void
  onCommentAdded: () => void
  canDelete: boolean
  onDeleted: () => void
  timeAgo: (iso: string) => string
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadComments() {
    const { data } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
    setComments(data ?? [])
  }

  function toggleComments() {
    const next = !showComments
    setShowComments(next)
    if (next && comments.length === 0) loadComments()
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !userId) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: post.id,
          author_id: userId,
          author_name: authorName || 'Member',
          body: body.trim(),
        })
        .select()
        .single()
      if (!error && data) {
        setComments((c) => [...c, data])
        setBody('')
        onCommentAdded()
      }
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm('Delete this post?')) return
    await supabase.from('posts').delete().eq('id', post.id)
    onDeleted()
  }

  const isVendor = post.kind === 'vendor'
  const headTitle = isVendor
    ? post.vendor_name || 'Featured'
    : post.pet_name || post.author_name
  const initial = (headTitle || '?').charAt(0).toUpperCase()

  return (
    <article className="card overflow-hidden p-0">
      <div className="flex items-center gap-3 p-4">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full font-semibold ${
            isVendor ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-brand-900">
            {headTitle}
            {!isVendor && post.pet_name && (
              <span className="font-normal text-brand-500"> · {post.author_name}</span>
            )}
          </p>
          <p className="text-xs text-brand-500">
            {isVendor ? (
              <span className="font-medium uppercase tracking-wide text-amber-600">
                Sponsored
              </span>
            ) : (
              <>
                {post.location ? `${post.location} · ` : ''}
                {timeAgo(post.created_at)}
              </>
            )}
          </p>
        </div>
        {canDelete && (
          <button onClick={remove} className="text-xs text-brand-400 hover:text-red-500">
            Delete
          </button>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.caption || 'Dog photo'}
          className="max-h-[32rem] w-full bg-brand-100 object-cover"
          loading="lazy"
        />
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleLike}
            className={`flex items-center gap-1 text-sm ${
              liked ? 'text-red-500' : 'text-brand-600 hover:text-red-500'
            }`}
          >
            <span aria-hidden>{liked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && likeCount}
          </button>
          <button
            onClick={toggleComments}
            className="flex items-center gap-1 text-sm text-brand-600 hover:text-sky-600"
          >
            <span aria-hidden>💬</span>
            {commentCount > 0 ? commentCount : 'Comment'}
          </button>
        </div>

        {post.caption && (
          <p className="text-sm text-brand-800">{post.caption}</p>
        )}

        {isVendor && (
          <a
            href={post.link_url || '/marketplace'}
            target={post.link_url ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="btn-primary mt-1 inline-flex text-sm"
          >
            {post.cta || 'Learn more'}
          </a>
        )}

        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((h) => (
              <span key={h} className="text-xs font-medium text-sky-600">
                #{h}
              </span>
            ))}
          </div>
        )}

        {showComments && (
          <div className="space-y-2 border-t border-brand-100 pt-3">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <span className="font-semibold text-brand-800">{c.author_name}</span>{' '}
                <span className="text-brand-700">{c.body}</span>
              </div>
            ))}
            <form onSubmit={addComment} className="flex gap-2 pt-1">
              <input
                className="input flex-1"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a comment…"
              />
              <button
                type="submit"
                disabled={busy || !body.trim()}
                className="btn-ghost text-sm"
              >
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </article>
  )
}
