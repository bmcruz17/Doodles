import { supabase } from './supabase'
import { uploadPostPhoto } from './posts'
import type { PackProfile } from './types'

export async function getMyPack(userId: string): Promise<PackProfile | null> {
  const { data } = await supabase
    .from('pack_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as PackProfile | null) ?? null
}

export async function getPackByHandle(handle: string): Promise<PackProfile | null> {
  const { data } = await supabase
    .from('pack_profiles')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .maybeSingle()
  return (data as PackProfile | null) ?? null
}

// Pack avatars live in the public post-photos bucket (same as posts).
export function uploadPackAvatar(userId: string, file: File) {
  return uploadPostPhoto(userId, file)
}

export function normalizeHandle(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)
}
