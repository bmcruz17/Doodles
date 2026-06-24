import { supabase } from './supabase'

// Pet photos live in the private `pet-documents` bucket under the owner's
// folder (pet-documents/<uid>/<petId>/...), same as health documents. We store
// the path in pets.photo_url and resolve a signed URL for display.
export async function uploadPetPhoto(
  userId: string,
  petId: string,
  file: File,
): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/${petId}/photo_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('pet-documents')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

// Upload any document (e.g. microchip paperwork) into the pet's private folder.
export async function uploadPetFile(
  userId: string,
  petId: string,
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/${petId}/${Date.now()}_${safe}`
  const { error } = await supabase.storage
    .from('pet-documents')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error
  return path
}

// Accepts either a full http(s) URL (used as-is) or a storage path (signed).
export async function resolvePhotoUrl(
  photoUrl: string | null,
): Promise<string | null> {
  if (!photoUrl) return null
  if (/^https?:\/\//.test(photoUrl)) return photoUrl
  const { data } = await supabase.storage
    .from('pet-documents')
    .createSignedUrl(photoUrl, 60 * 60)
  return data?.signedUrl ?? null
}
