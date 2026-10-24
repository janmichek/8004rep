export type Star = 'full' | 'half' | 'off'

/** Five stars for a 0–100 score, in half-star steps. */
export function starsOf(score: number | null | undefined): Star[] {
  const value = score === null || score === undefined ? 0 : Math.max(0, Math.min(100, score)) / 20
  return Array.from({ length: 5 }, (_, i) => (value >= i + 1 ? 'full' : value >= i + 0.5 ? 'half' : 'off'))
}

export function starGlyph(star: Star): string {
  return star === 'full' ? '★' : star === 'half' ? '⯨' : '☆'
}

/** How much evidence is in the pot, in kitchen words. */
export function confidenceOf(count: number | undefined): { word: string; detail: string } {
  if (!count) return { word: 'untasted', detail: 'no tastings' }
  if (count < 3) return { word: 'a first tasting', detail: `${count} tasting${count === 1 ? '' : 's'}` }
  if (count < 12) return { word: 'well tasted', detail: `${count} tastings` }
  return { word: 'a house staple', detail: `${count} tastings` }
}
