import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Campaign, CampaignDeal, CreatorProfile } from '../lib/types'

const COMMISSION = 0.18

function money(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export default function Creator() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [deals, setDeals] = useState<CampaignDeal[]>([])
  const [stats, setStats] = useState({ posts: 0, likes: 0, comments: 0 })
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  async function load() {
    if (!user) return
    const [{ data: prof }, { data: camps }, { data: myDeals }, { data: myPosts }] =
      await Promise.all([
        supabase.from('creator_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase
          .from('campaigns')
          .select('*')
          .eq('status', 'open')
          .order('created_at', { ascending: false }),
        supabase.from('campaign_deals').select('*').eq('creator_id', user.id),
        supabase.from('posts').select('id').eq('author_id', user.id),
      ])
    setProfile((prof as CreatorProfile | null) ?? null)
    setCampaigns(camps ?? [])
    setDeals(myDeals ?? [])

    const postIds = (myPosts ?? []).map((p) => p.id)
    let likes = 0
    let comments = 0
    if (postIds.length) {
      const [{ count: lc }, { count: cc }] = await Promise.all([
        supabase
          .from('post_likes')
          .select('post_id', { count: 'exact', head: true })
          .in('post_id', postIds),
        supabase
          .from('post_comments')
          .select('id', { count: 'exact', head: true })
          .in('post_id', postIds),
      ])
      likes = lc ?? 0
      comments = cc ?? 0
    }
    setStats({ posts: postIds.length, likes, comments })
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function apply(c: Campaign) {
    if (!user || !profile) return
    const payout = Number(c.payout_per_post)
    await supabase.from('campaign_deals').insert({
      campaign_id: c.id,
      creator_id: user.id,
      creator_handle: profile.handle,
      status: 'applied',
      payout,
      commission: Math.round(payout * COMMISSION * 100) / 100,
    })
    load()
  }

  if (loading) return <p className="text-brand-600">Loading creator studio…</p>

  if (!profile || editing) {
    return (
      <CreatorApplication
        userId={user?.id ?? ''}
        existing={profile}
        onDone={() => {
          setEditing(false)
          load()
        }}
        onCancel={profile ? () => setEditing(false) : undefined}
      />
    )
  }

  const earnings = deals
    .filter((d) => d.status === 'paid')
    .reduce((s, d) => s + (Number(d.payout) - Number(d.commission)), 0)
  const pendingEarn = deals
    .filter((d) => ['accepted', 'delivered'].includes(d.status))
    .reduce((s, d) => s + (Number(d.payout) - Number(d.commission)), 0)
  const appliedCampaignIds = new Set(deals.map((d) => d.campaign_id))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand-900">
            Creator studio
            {profile.verified && <span className="ml-2 text-sky-600">✓</span>}
          </h1>
          <p className="text-sm text-brand-600">
            @{profile.handle || 'yourhandle'} · {profile.niche || 'Dog creator'}
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
          Edit profile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Followers" value={profile.follower_count.toLocaleString()} />
        <Stat label="Posts" value={stats.posts} />
        <Stat label="Likes" value={stats.likes} />
        <Stat label="Comments" value={stats.comments} />
        <Stat label="Earned" value={money(earnings)} accent />
        <Stat label="Pending" value={money(pendingEarn)} />
      </div>

      {/* Brand campaigns */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Brand deals for you
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-brand-500">
            No open campaigns right now — check back soon.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => {
              const applied = appliedCampaignIds.has(c.id)
              return (
                <div key={c.id} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-brand-900">{c.title}</h3>
                      <p className="text-xs uppercase tracking-wide text-brand-500">
                        {c.vendor_name}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {money(Number(c.payout_per_post))}/post
                    </span>
                  </div>
                  {c.brief && <p className="mt-2 text-sm text-brand-600">{c.brief}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.target_breed && (
                      <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                        {c.target_breed}
                      </span>
                    )}
                    {c.target_life_stage && (
                      <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs text-brand-700">
                        {c.target_life_stage}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => apply(c)}
                    disabled={applied}
                    className="btn-primary mt-3 text-sm disabled:opacity-60"
                  >
                    {applied ? 'Applied ✓' : 'Apply'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* My deals */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-500">
          Your deals
        </h2>
        {deals.length === 0 ? (
          <p className="text-sm text-brand-500">No deals yet — apply to a campaign above.</p>
        ) : (
          <div className="space-y-2">
            {deals.map((d) => (
              <div key={d.id} className="card flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-brand-900">
                    {campaigns.find((c) => c.id === d.campaign_id)?.title || 'Campaign'}
                  </p>
                  <p className="text-xs text-brand-500">
                    You earn {money(Number(d.payout) - Number(d.commission))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <DealBadge status={d.status} />
                  {d.status === 'accepted' && (
                    <button
                      onClick={async () => {
                        await supabase
                          .from('campaign_deals')
                          .update({ status: 'delivered' })
                          .eq('id', d.id)
                        load()
                      }}
                      className="btn-ghost px-2 py-1 text-xs"
                    >
                      Mark delivered
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`card ${accent ? 'border-emerald-200 bg-emerald-50/60' : ''}`}>
      <p className="text-xs uppercase tracking-wide text-brand-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${accent ? 'text-emerald-700' : 'text-brand-900'}`}>
        {value}
      </p>
    </div>
  )
}

function DealBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    applied: 'bg-brand-100 text-brand-600',
    accepted: 'bg-sky-100 text-sky-700',
    delivered: 'bg-amber-100 text-amber-700',
    paid: 'bg-emerald-100 text-emerald-700',
    declined: 'bg-red-100 text-red-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone[status] ?? ''}`}>
      {status}
    </span>
  )
}

// --------------------------------------------------------------------------
function CreatorApplication({
  userId,
  existing,
  onDone,
  onCancel,
}: {
  userId: string
  existing: CreatorProfile | null
  onDone: () => void
  onCancel?: () => void
}) {
  const [handle, setHandle] = useState(existing?.handle ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [niche, setNiche] = useState(existing?.niche ?? '')
  const [breeds, setBreeds] = useState((existing?.breeds ?? []).join(', '))
  const [instagram, setInstagram] = useState(existing?.instagram ?? '')
  const [tiktok, setTiktok] = useState(existing?.tiktok ?? '')
  const [youtube, setYoutube] = useState(existing?.youtube ?? '')
  const [followers, setFollowers] = useState(existing?.follower_count?.toString() ?? '')
  const [rate, setRate] = useState(existing?.rate_per_post?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      const { error: upErr } = await supabase.from('creator_profiles').upsert(
        {
          user_id: userId,
          handle: handle.trim().replace(/^@/, ''),
          bio: bio.trim(),
          niche: niche.trim() || null,
          breeds: breeds.split(',').map((b) => b.trim()).filter(Boolean),
          instagram: instagram.trim() || null,
          tiktok: tiktok.trim() || null,
          youtube: youtube.trim() || null,
          follower_count: Number(followers) || 0,
          rate_per_post: rate ? Number(rate) : null,
          status: 'active',
        },
        { onConflict: 'user_id' },
      )
      if (upErr) throw upErr
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-brand-900">
          {existing ? 'Edit creator profile' : 'Become a PackHub creator'}
        </h1>
        <p className="mt-1 text-sm text-brand-600">
          Make content about your dog, get matched with paying brands, and earn —
          all from one dashboard. We connect you to vendors advertising on PackHub.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Handle</label>
            <input className="input" required value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="doodlesofaustin" />
          </div>
          <div>
            <label className="label">Niche</label>
            <input className="input" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Doodle lifestyle, training" />
          </div>
        </div>
        <div>
          <label className="label">Bio</label>
          <textarea className="input min-h-[70px]" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Who you are and the content you make." />
        </div>
        <div>
          <label className="label">Breeds you feature</label>
          <input className="input" value={breeds} onChange={(e) => setBreeds(e.target.value)} placeholder="Goldendoodle, Bernedoodle" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Instagram</label>
            <input className="input" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <label className="label">TikTok</label>
            <input className="input" value={tiktok} onChange={(e) => setTiktok(e.target.value)} placeholder="@handle" />
          </div>
          <div>
            <label className="label">YouTube</label>
            <input className="input" value={youtube} onChange={(e) => setYoutube(e.target.value)} placeholder="channel" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Total followers</label>
            <input className="input" inputMode="numeric" value={followers} onChange={(e) => setFollowers(e.target.value)} placeholder="12000" />
          </div>
          <div>
            <label className="label">Rate per post ($)</label>
            <input className="input" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="250" />
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : existing ? 'Save profile' : 'Launch my studio'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
