/** A short ticker for an agent name; falls back to the token number. */
export function symbolOf(name: string | undefined, tokenId: bigint | string): string {
  const words = (name ?? '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  const raw = words.length >= 2 ? words.map((w) => w[0]).join('') : (words[0] ?? '')
  return (raw || `A${tokenId}`).slice(0, 5).toUpperCase()
}

export type Credit = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NR'

/** A credit-style rating band for a 0–100 score. */
export function ratingOf(score: number | null | undefined): Credit {
  if (score === null || score === undefined) return 'NR'
  if (score >= 90) return 'AAA'
  if (score >= 82) return 'AA'
  if (score >= 74) return 'A'
  if (score >= 66) return 'BBB'
  if (score >= 58) return 'BB'
  if (score >= 50) return 'B'
  if (score >= 40) return 'CCC'
  if (score >= 30) return 'CC'
  if (score >= 20) return 'C'
  return 'D'
}

/** Direction class for a numeric change. */
export function dirOf(n: number | null | undefined): 'up' | 'down' | 'flat' {
  if (n === null || n === undefined || Math.abs(n) < 0.05) return 'flat'
  return n > 0 ? 'up' : 'down'
}

/** Percentage change from `from` to `to`; null when `from` is 0 or missing. */
export function pctOf(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from === null || from === undefined || to === null || to === undefined || from === 0) return null
  return ((to - from) / Math.abs(from)) * 100
}
