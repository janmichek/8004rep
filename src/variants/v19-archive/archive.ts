/** Call number in the form used by the reading room. */
export function callNumberOf(tokenId: bigint | string): string {
  return `8004/${String(tokenId).padStart(4, '0')}`
}

export type Series = { code: string; name: string; rule: string; stamp: string; tone: 'good' | 'fair' | 'poor' | 'none' }

/** The series a record is filed under, by its trusted score. */
export function seriesOf(score: number | null | undefined): Series {
  if (score === null || score === undefined)
    return { code: 'U', name: 'Unfiled', rule: 'No usable rating.', stamp: 'UNFILED', tone: 'none' }
  if (score >= 90) return { code: 'A', name: 'Endorsed', rule: 'Trusted mean 90 or above.', stamp: 'ENDORSED', tone: 'good' }
  if (score >= 75) return { code: 'B', name: 'Favourable', rule: 'Trusted mean 75 to 89.', stamp: 'FAVOURABLE', tone: 'good' }
  if (score >= 60) return { code: 'C', name: 'Routine', rule: 'Trusted mean 60 to 74.', stamp: 'ROUTINE', tone: 'fair' }
  if (score >= 40) return { code: 'D', name: 'Qualified', rule: 'Trusted mean 40 to 59.', stamp: 'QUALIFIED', tone: 'poor' }
  return { code: 'E', name: 'Contested', rule: 'Trusted mean below 40.', stamp: 'CONTESTED', tone: 'poor' }
}

/** File references for the reviewer cards and deposit slips. */
export function fileNumberOf(tokenId: bigint | string): string {
  return `R/${String(tokenId).padStart(4, '0')}`
}

/** A short condition note for an item list. */
export function conditionOf(revoked: number, flags: number): string {
  if (revoked + flags === 0) return 'clean'
  const parts = []
  if (revoked) parts.push(`${revoked} withdrawn`)
  if (flags) parts.push(`${flags} flagged`)
  return parts.join(', ')
}

/** The year an accession entered the archive. */
export function accessionYear(createdAt: number | undefined): string {
  return createdAt ? String(new Date(createdAt * 1000).getUTCFullYear()) : 'undated'
}
