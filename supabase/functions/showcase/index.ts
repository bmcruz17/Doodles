// Public showcase — Supabase Edge Function (Deno), verify_jwt = false.
//
// Returns a minimal, curated set of recent Pack photos for the PUBLIC landing
// page. The posts table is members-only by RLS, so we use the service role and
// expose ONLY non-identifying fields (dog name, location, time, image) — never
// the author, caption, or ids. This keeps the members feed private while still
// letting the marketing homepage feel alive.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data } = await admin
      .from('posts')
      .select('pet_name, location, created_at, image_url')
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(15)

    // Strip to exactly the public fields (defensive — no author, no ids).
    const posts = (data ?? []).map((p) => ({
      pet_name: p.pet_name ?? null,
      location: p.location ?? null,
      created_at: p.created_at,
      image_url: p.image_url,
    }))

    return new Response(JSON.stringify({ posts }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Cache at the edge for a minute to keep the landing snappy.
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ posts: [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
