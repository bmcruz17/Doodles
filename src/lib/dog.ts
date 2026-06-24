// Shared dog helpers used for audience segmentation + targeting.
import type { LifeStage } from './types'

export type { LifeStage }

export const LIFE_STAGES: { key: LifeStage; label: string }[] = [
  { key: 'puppy', label: 'Puppy (<1 yr)' },
  { key: 'adolescent', label: 'Adolescent (1–3)' },
  { key: 'adult', label: 'Adult (3–8)' },
  { key: 'senior', label: 'Senior (8+)' },
]

// Derive a life stage from a birthdate. (Coarse, breed-agnostic buckets — large
// breeds age faster, refine later.)
export function lifeStage(birthdate: string | null): LifeStage | null {
  if (!birthdate) return null
  const birth = new Date(birthdate)
  if (isNaN(birth.getTime())) return null
  const years = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (years < 1) return 'puppy'
  if (years < 3) return 'adolescent'
  if (years < 8) return 'adult'
  return 'senior'
}

export function lifeStageLabel(s: LifeStage | null): string {
  return LIFE_STAGES.find((x) => x.key === s)?.label ?? '—'
}
