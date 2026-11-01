import {
  CITIES,
  FAKE_NEGATIVE,
  FAKE_POSITIVE,
  FIRST_NAMES,
  KINDS,
  LAST_NAMES,
  MIXED_BODY,
  NEGATIVE_BODY,
  NEGATIVE_OPEN,
  POSITIVE_BODY,
  POSITIVE_OPEN,
  PREFIXES,
  STREETS,
  STREET_TYPES,
  type City,
  type PlaceKind,
} from './catalog'
import type { AuthorStats, Place, Review } from './types'

// Deterministic: a place is a pure function of (city, index, today). Nothing is
// stored, so the dataset can be this large for free.

export const PLACES_PER_CITY = 500
/** What a scraper-style source returns per place: the most recent reviews. */
export const MAX_SAMPLE = 200

const DAY_MS = 86_400_000

export type Archetype = 'honest' | 'inflated' | 'bombed' | 'polarized' | 'new' | 'celebrated'

export type PlaceTruth = {
  city: City
  cityIndex: number
  index: number
  kind: PlaceKind
  archetype: Archetype
  /** Reviews in the returned sample. */
  sample: number
  /** Reviews Google claims; at least `sample`. */
  count: number
  rating: number
  seed: number
}

function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function normal(rng: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())
}

const pick = <T>(rng: () => number, list: readonly T[]): T => list[Math.floor(rng() * list.length)]
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/** Start of the UTC day: keeps the dataset stable within a day. */
export function today(now = Date.now()): number {
  return Math.floor(now / DAY_MS) * DAY_MS
}

export function placeId(cityIndex: number, index: number): string {
  const tail = hash(`id:${cityIndex}:${index}`).toString(36).padStart(7, '0')
  return `ChIJ${cityIndex.toString(36).padStart(2, '0')}${index.toString(36).padStart(3, '0')}${tail}`
}

export function parsePlaceId(id: string): { cityIndex: number; index: number } | null {
  if (!/^ChIJ[0-9a-z]{12}$/.test(id)) return null
  const cityIndex = parseInt(id.slice(4, 6), 36)
  const index = parseInt(id.slice(6, 9), 36)
  if (cityIndex >= CITIES.length || index >= PLACES_PER_CITY) return null
  return placeId(cityIndex, index) === id ? { cityIndex, index } : null
}

/** Cheap summary: no reviews are generated, so a whole city can be listed and sorted. */
export function truth(cityIndex: number, index: number): PlaceTruth {
  const seed = hash(`place:${cityIndex}:${index}`)
  const rng = mulberry32(seed)
  const kind = KINDS[Math.floor(rng() * KINDS.length)]
  const r = rng()
  const inflatedShare = 0.07 + (kind.trade ? 0.13 : 0)
  let archetype: Archetype
  if (r < inflatedShare) archetype = 'inflated'
  else if (r < inflatedShare + 0.04) archetype = 'bombed'
  else if (r < inflatedShare + 0.12) archetype = 'polarized'
  else if (r < inflatedShare + 0.22) archetype = 'new'
  else if (r < inflatedShare + 0.32) archetype = 'celebrated'
  else archetype = 'honest'

  const quality = clamp(3.95 + normal(rng) * 0.45, 2.5, 4.8)
  let sample: number
  let scale: number
  switch (archetype) {
    case 'new':
      sample = 3 + Math.floor(rng() * 7)
      scale = 1
      break
    case 'celebrated':
      sample = MAX_SAMPLE
      scale = 6 + Math.floor(rng() * 60)
      break
    default:
      sample = 18 + Math.floor(rng() ** 1.4 * (MAX_SAMPLE - 18))
      scale = 1 + Math.floor(rng() * 4)
  }
  const fakeShare = archetype === 'inflated' ? 0.5 : archetype === 'bombed' ? 0.25 : 0
  const mean =
    archetype === 'inflated'
      ? (1 - fakeShare) * quality + fakeShare * 5
      : archetype === 'bombed'
        ? (1 - fakeShare) * Math.max(quality, 4.2) + fakeShare * 1
        : archetype === 'polarized'
          ? 3.0 + (quality - 3.9)
          : quality
  const rating = Math.round(clamp(mean + normal(rng) * 0.05, 1, 5) * 10) / 10
  return { city: CITIES[cityIndex], cityIndex, index, kind, archetype, sample, count: sample * scale, rating, seed }
}

function placeName(t: PlaceTruth): string {
  const rng = mulberry32(t.seed ^ 0x51ed270b)
  return `${pick(rng, PREFIXES)} ${pick(rng, t.kind.nouns)}`
}

/** The place without reviews; what a search returns. */
export function buildPlace(t: PlaceTruth): Place {
  const rng = mulberry32(t.seed ^ 0x2545f491)
  const name = placeName(t)
  const id = placeId(t.cityIndex, t.index)
  const number = 1 + Math.floor(rng() * 240)
  const street = `${pick(rng, STREETS)} ${pick(rng, STREET_TYPES)}`
  return {
    id,
    name: `places/${id}`,
    displayName: { text: name, languageCode: 'en' },
    formattedAddress: `${number} ${street}, ${t.city.name}, ${t.city.country}`,
    location: { latitude: t.city.lat + (rng() - 0.5) * 0.18, longitude: t.city.lng + (rng() - 0.5) * 0.24 },
    types: [t.kind.type, 'point_of_interest', 'establishment'],
    primaryType: t.kind.type,
    primaryTypeDisplayName: { text: t.kind.label, languageCode: 'en' },
    rating: t.rating,
    userRatingCount: t.count,
    googleMapsUri: `https://www.google.com/maps/place/?q=place_id:${id}`,
  }
}

function relative(ageMs: number): string {
  const days = ageMs / DAY_MS
  if (days < 1) return 'today'
  if (days < 7) return `${Math.floor(days)} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? 'a year ago' : `${years} years ago`
}

function honestText(rng: () => number, stars: number, name: string): string | undefined {
  if (rng() > 0.78) return undefined
  if (stars >= 4) return `${pick(rng, POSITIVE_OPEN)} ${name}: ${pick(rng, POSITIVE_BODY)}`
  if (stars === 3) return `${name}: ${pick(rng, MIXED_BODY)}`
  return `${pick(rng, NEGATIVE_OPEN)} ${name}: ${pick(rng, NEGATIVE_BODY)}`
}

type Draft = { stars: number; at: number; text?: string; fake: boolean }

/** A believable account: history, photos, a Local Guide level that follows from both. */
function realStats(rng: () => number, now: number): AuthorStats {
  const reviewCount = Math.max(1, Math.round(Math.exp(1.4 + normal(rng) * 1.3)))
  const level = reviewCount >= 15 ? Math.min(10, Math.floor(Math.log2(reviewCount / 7)) + 1) : 0
  return {
    reviewCount,
    photoCount: Math.floor(reviewCount * rng() * 0.8),
    localGuideLevel: level,
    memberSince: new Date(now - (200 + rng() * 3200) * DAY_MS).toISOString().slice(0, 10),
  }
}

/** A throwaway account: a couple of reviews, no photos, weeks old. */
function throwawayStats(rng: () => number, now: number): AuthorStats {
  return {
    reviewCount: 1 + Math.floor(rng() * 4),
    photoCount: rng() < 0.1 ? 1 : 0,
    localGuideLevel: 0,
    memberSince: new Date(now - (4 + rng() * 80) * DAY_MS).toISOString().slice(0, 10),
  }
}

/** Reviews of one place, newest first. Pure in (truth, now). */
export function buildReviews(t: PlaceTruth, now = today()): Review[] {
  const rng = mulberry32(t.seed ^ 0x9e3779b9)
  const name = placeName(t)
  const id = placeId(t.cityIndex, t.index)
  const ageDays = 200 + rng() * 2800
  const quality = clamp(t.rating, 2.4, 4.8)
  const drafts: Draft[] = []

  const honestStars = (center: number) => clamp(Math.round(center + normal(rng) * 0.95), 1, 5)
  const honestAt = () => now - rng() ** 1.7 * ageDays * DAY_MS

  const fakeShare = t.archetype === 'inflated' ? 0.5 : t.archetype === 'bombed' ? 0.25 : 0
  const fakeCount = Math.round(t.sample * fakeShare)
  const burstCentre = now - (3 + rng() * 100) * DAY_MS
  const fakeStars = t.archetype === 'inflated' ? 5 : 1

  for (let i = 0; i < t.sample - fakeCount; i++) {
    const stars =
      t.archetype === 'polarized' ? (rng() < 0.55 ? 5 : rng() < 0.7 ? 1 : 3) : honestStars(t.archetype === 'inflated' ? 3.4 : quality + (t.archetype === 'bombed' ? 0.3 : 0))
    drafts.push({ stars, at: honestAt(), text: honestText(rng, stars, name), fake: false })
  }
  const pool = fakeStars === 5 ? FAKE_POSITIVE : FAKE_NEGATIVE
  for (let i = 0; i < fakeCount; i++) {
    drafts.push({ stars: fakeStars, at: burstCentre + (rng() - 0.5) * 6 * DAY_MS, text: rng() < 0.3 ? undefined : pick(rng, pool), fake: true })
  }
  drafts.sort((a, b) => b.at - a.at)

  return drafts.slice(0, MAX_SAMPLE).map((d, i) => {
    const authorId = String(Math.floor(rng() * 9e20) + 1e20).slice(0, 21)
    const authorName = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`
    const stats = d.fake ? throwawayStats(rng, now) : realStats(rng, now)
    const hasPhoto = d.fake ? rng() < 0.15 : rng() < 0.7
    const at = Math.min(d.at, now - 3_600_000)
    return {
      name: `places/${id}/reviews/${hash(`${t.seed}:${i}`).toString(16)}`,
      relativePublishTimeDescription: relative(now - at),
      rating: d.stars,
      ...(d.text ? { text: { text: d.text, languageCode: 'en' } } : {}),
      authorAttribution: {
        displayName: authorName,
        uri: `https://www.google.com/maps/contrib/${authorId}`,
        ...(hasPhoto ? { photoUri: `https://lh3.googleusercontent.com/a/${authorId}` } : {}),
      },
      publishTime: new Date(at).toISOString(),
      authorStats: stats,
    }
  })
}
