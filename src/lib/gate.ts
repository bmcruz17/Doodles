// Closed-beta passcode. Change this per cohort. NOTE: this is a client-side
// gate — it keeps the general public out and sets expectations, but it is NOT
// strong security (the value ships in the bundle). For hard access control use
// Cloudflare Access in front of the site.
export const BETA_PASSCODE = 'goodboy2026'

const KEY = 'ph_beta_unlocked'

export function isUnlocked(): boolean {
  try {
    return localStorage.getItem(KEY) === BETA_PASSCODE
  } catch {
    return false
  }
}

export function unlock(code: string): boolean {
  if (code.trim().toLowerCase() === BETA_PASSCODE.toLowerCase()) {
    localStorage.setItem(KEY, BETA_PASSCODE)
    return true
  }
  return false
}
