import type { RegistrationFile } from '../../data/types'

/** A display taxon derived from what the registration file declared. */
export type Taxon = { family: string; genus: string; epithet: string; line: string }

function title(text: string): string {
  return text.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
}

/** Family from the first declared service, genus from the first trust model, epithet from the name. */
export function taxonOf(file: RegistrationFile | null | undefined, fallback: string): Taxon {
  const family = file?.services[0]?.name ? title(file.services[0].name) : 'Incognita'
  const genus = file?.supportedTrust[0] ? title(file.supportedTrust[0]) : 'Reputatio'
  const source = file?.name?.trim() || fallback
  const epithet = source.split(/\s+/).at(-1)!.toLowerCase().replace(/[^a-z0-9]/g, '') || 'anon'
  return { family, genus, epithet, line: `${genus} ${epithet} · ${family}` }
}

/** Rarity band from how many observations a specimen carries. */
export function abundance(count: number | undefined): { word: string; tone: string } {
  if (count === undefined || count === 0) return { word: 'not observed', tone: '' }
  if (count < 3) return { word: 'rare', tone: 'warn' }
  if (count < 12) return { word: 'occasional', tone: '' }
  if (count < 40) return { word: 'common', tone: '' }
  return { word: 'abundant', tone: '' }
}
