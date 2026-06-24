import { supabase } from './supabase'

export const SITTER_SERVICES = [
  'Boarding (at sitter\'s home)',
  'House sitting (at owner\'s home)',
  'Daytime daycare',
  'Dog walking',
  'Drop-in visits',
  'Overnight stays',
]

// Public profile photo → public post-photos bucket (owner-scoped write).
export async function uploadSitterPhoto(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/sitter_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return supabase.storage.from('post-photos').getPublicUrl(path).data.publicUrl
}

// Sensitive ID document → PRIVATE pet-documents bucket, under a per-user
// _verification folder. Returns the storage path (never a public URL).
export async function uploadSitterIdDoc(userId: string, file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, '_')
  const path = `${userId}/_verification/${Date.now()}_${safe}`
  const { error } = await supabase.storage
    .from('pet-documents')
    .upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw error
  return path
}
