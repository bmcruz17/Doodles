// delete-account — Supabase Edge Function (Deno).
//
// In-app account deletion (required by App Store Guideline 5.1.1(v)). Verifies
// the caller, best-effort removes their private storage, then deletes the auth
// user — DB rows cascade via foreign keys (on delete cascade to auth.users).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function purgeBucket(admin: ReturnType<typeof createClient>, bucket: string, uid: string) {
  try {
    const { data } = await admin.storage.from(bucket).list(uid, { limit: 1000 })
    const paths: string[] = []
    for (const entry of data ?? []) {
      // one level of nesting (uid/petId/file or uid/file)
      if (entry.id === null) {
        const { data: sub } = await admin.storage.from(bucket).list(`${uid}/${entry.name}`, { limit: 1000 })
        for (const f of sub ?? []) paths.push(`${uid}/${entry.name}/${f.name}`)
      } else {
        paths.push(`${uid}/${entry.name}`)
      }
    }
    if (paths.length) await admin.storage.from(bucket).remove(paths)
  } catch (e) {
    console.error('purge', bucket, e)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    await purgeBucket(admin, 'pet-documents', user.id)
    await purgeBucket(admin, 'post-photos', user.id)

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('deleteUser', error)
      return json({ error: 'Could not delete account' }, 500)
    }
    return json({ ok: true })
  } catch (err) {
    console.error(err)
    return json({ error: 'Internal error' }, 500)
  }
})
