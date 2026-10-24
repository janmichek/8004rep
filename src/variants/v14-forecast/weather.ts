import type { RiskLevel } from '../../data/feedbackStats'
import type { StrengthTier } from '../../data/trustReport'

export type Condition = { glyph: string; label: string; tone: 'good' | 'warn' | 'bad' | '' }

/** Weather language for a reputation score; risk overrides the band. */
export function conditionOf(score: number | null | undefined, level?: RiskLevel | 'clean'): Condition {
  if (level === 'high') return { glyph: '⛈', label: 'severe storms', tone: 'bad' }
  if (score === null || score === undefined) return { glyph: '🌫', label: 'no reading', tone: '' }
  if (score >= 90) return { glyph: '☀', label: 'clear', tone: 'good' }
  if (score >= 75) return { glyph: '🌤', label: 'mostly clear', tone: 'good' }
  if (score >= 60) return { glyph: '⛅', label: 'partly cloudy', tone: '' }
  if (score >= 45) return { glyph: '☁', label: 'overcast', tone: 'warn' }
  if (score >= 30) return { glyph: '🌧', label: 'showers', tone: 'warn' }
  return { glyph: '⛈', label: 'storms', tone: 'bad' }
}

/** A word for how much evidence backs the reading. */
export function confidenceOf(count: number | undefined, tier?: StrengthTier): { word: string; detail: string } {
  if (!count) return { word: 'calm', detail: 'no observations' }
  if (tier === 'strong') return { word: 'settled', detail: 'strong evidence' }
  if (tier === 'moderate') return { word: 'breezy', detail: 'moderate evidence' }
  if (tier === 'thin') return { word: 'gusty', detail: 'thin evidence' }
  if (count < 3) return { word: 'gusty', detail: `${count} observation${count === 1 ? '' : 's'}` }
  return { word: 'breezy', detail: `${count} observations` }
}

/** Wind reading from reviews per day. */
export function windOf(perDay: number | null | undefined): string {
  if (perDay === null || perDay === undefined) return 'still'
  if (perDay >= 5) return 'gale'
  if (perDay >= 1) return 'brisk'
  if (perDay >= 0.2) return 'light'
  return 'still'
}
