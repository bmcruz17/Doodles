// Per-user sliding-window limit for the Claude-backed functions, backed by
// public.consume_ai_quota() (migration 0021). Call with the service-role
// client, after the caller is authenticated and before hitting Anthropic.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

export type QuotaResult = 'ok' | 'limited' | 'unavailable'

export async function consumeAiQuota(
  admin: SupabaseClient,
  userId: string,
  bucket: string,
  max: number,
  windowSeconds: number,
): Promise<QuotaResult> {
  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_user_id: userId,
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('consume_ai_quota failed', error)
    return 'unavailable'
  }
  return data === true ? 'ok' : 'limited'
}

export const QUOTA_ERROR: Record<Exclude<QuotaResult, 'ok'>, { status: number; error: string }> = {
  limited: {
    status: 429,
    error: "You're going a little fast — please wait a few minutes and try again.",
  },
  unavailable: { status: 503, error: 'AI service is temporarily unavailable.' },
}
