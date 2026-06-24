// Typed calls to Supabase Edge Functions. Each helper attaches the current
// user's access token so the function can authenticate the caller.
import { supabase } from './supabase'

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(fn, { body })
  if (error) throw error
  if (data == null) throw new Error(`Empty response from ${fn}`)
  return data
}

export interface AiChatResponse {
  reply: string
}

/** AI Companion: send a message about a pet, get a grounded reply. */
export function aiChat(petId: string, message: string) {
  return invoke<AiChatResponse>('ai-chat', { pet_id: petId, message })
}

export interface CreateCheckoutResponse {
  url: string
}

/** Membership checkout: returns a Stripe Checkout URL to redirect to. */
export function createCheckout(params: {
  pet_id: string
  tier: 'basic' | 'premium'
}) {
  return invoke<CreateCheckoutResponse>('create-checkout', params)
}

export interface ParseRecordsResponse {
  summary: string
  added: { vaccinations: number; records: number }
  items: { kind: string; label: string }[]
}

/**
 * Smart upload: hand an already-uploaded document (storage path) to the AI
 * parser, which extracts vaccinations + health records into the pet's vault.
 */
export function parseRecords(petId: string, path: string) {
  return invoke<ParseRecordsResponse>('parse-records', { pet_id: petId, path })
}

export interface ShowcasePost {
  pet_name: string | null
  location: string | null
  created_at: string
  image_url: string
}

/**
 * Public showcase of recent Pack photos for the landing page. Tolerant of
 * failure — returns [] so the homepage never breaks if the feed is empty or
 * the function is unreachable.
 */
export async function fetchShowcase(): Promise<ShowcasePost[]> {
  try {
    const { data } = await supabase.functions.invoke<{ posts: ShowcasePost[] }>(
      'showcase',
      {},
    )
    return data?.posts ?? []
  } catch {
    return []
  }
}

export interface AddFriendResponse {
  status:
    | 'sent'
    | 'accepted'
    | 'pending'
    | 'already_friends'
    | 'not_member'
  message: string
}

/** Send a friend request by email (resolved to a member server-side). */
export function addFriend(email: string) {
  return invoke<AddFriendResponse>('add-friend', { email })
}

export interface AdminVendor {
  id: string
  name: string
  category: string
  status: string
  member_discount_pct: number
  location: string | null
  created_at: string
}
export interface AdminBooking {
  id: string
  status: string
  amount: number
  commission: number
  vendor_id: string | null
  created_at: string
}
export interface AdminSitter {
  id: string
  display_name: string
  background_check_status: string
  verified: boolean
  location: string | null
  created_at: string
}
export interface AdminOverview {
  metrics: {
    members: number
    pets: number
    vendors: number
    active_vendors: number
    bookings: number
    gmv: number
    commission: number
  }
  vendors: AdminVendor[]
  bookings: AdminBooking[]
  sitters: AdminSitter[]
  audience: {
    total: number
    by_stage: Record<string, number>
    by_sex: Record<string, number>
    by_neuter: Record<string, number>
    top_breeds: [string, number][]
  }
}

export function adminOverview() {
  return invoke<AdminOverview>('admin', { action: 'overview' })
}
export function adminAction(
  action: 'set_vendor_status' | 'set_booking_status' | 'set_sitter_status',
  id: string,
  value: string,
  verified?: boolean,
) {
  return invoke<{ ok: boolean }>('admin', { action, id, value, verified })
}
