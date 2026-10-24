/** Accession number, shaped like a real catalogue's. */
export function accessionOf(tokenId: bigint | string): string {
  const n = String(tokenId).padStart(4, '0')
  return `2004.${n}`
}

export type Room = { id: string; name: string; note: string }

/** A room for a score band; empty walls still get a room name. */
export function roomOf(score: number | null | undefined): Room {
  if (score === null || score === undefined) return { id: 'VI', name: 'Room VI — Not yet hung', note: 'No ratings on record.' }
  if (score >= 90) return { id: 'I', name: 'Room I — High Renown', note: 'Mean of 90 or above.' }
  if (score >= 75) return { id: 'II', name: 'Room II — Esteemed', note: 'Mean of 75 to 89.' }
  if (score >= 60) return { id: 'III', name: 'Room III — Regarded', note: 'Mean of 60 to 74.' }
  if (score >= 40) return { id: 'IV', name: 'Room IV — Disputed', note: 'Mean of 40 to 59.' }
  return { id: 'V', name: 'Room V — Contested', note: 'Mean below 40.' }
}

/** Gallery wall text for the medium: what the work is made of. */
export function mediumOf(services: { name: string }[] | undefined): string {
  return services?.length ? services.map((s) => s.name).join(', ') : 'on-chain record'
}

/** Dimensions line, in the manner of a wall label. */
export function dimensionsOf(count: number | undefined, score: number | null | undefined): string {
  return `${count ?? 0} rating${count === 1 ? '' : 's'} × ${score === null || score === undefined ? 'unrated' : score.toFixed(1)} mean`
}

/** A condition word for the report header. */
export function conditionOf(score: number | null | undefined, warnings: number): { word: string; detail: string } {
  if (score === null || score === undefined) return { word: 'Not examined', detail: 'Nothing to examine.' }
  if (warnings > 0) return { word: 'Needs attention', detail: `${warnings} conservation signal${warnings === 1 ? '' : 's'}.` }
  if (score >= 75) return { word: 'Sound', detail: 'No conservation signals.' }
  if (score >= 50) return { word: 'Stable', detail: 'No conservation signals; the mean is moderate.' }
  return { word: 'Fragile', detail: 'No signals, but the mean sits low.' }
}
