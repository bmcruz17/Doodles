import { supabase } from './supabase'

// Community dog photos live in the PUBLIC `post-photos` bucket (they're meant to
// be seen by other members). Path is `${uid}/${timestamp}.${ext}` so the
// owner-scoped insert policy passes. Returns the public URL.
export async function uploadPostPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('post-photos').getPublicUrl(path)
  return data.publicUrl
}

// Pull #hashtags out of free text into a normalized, deduped list.
export function extractHashtags(text: string): string[] {
  const tags = (text.match(/#[\p{L}0-9_]+/gu) ?? []).map((t) =>
    t.slice(1).toLowerCase(),
  )
  return Array.from(new Set(tags))
}
