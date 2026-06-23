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
