import { CITIES } from './catalog'
import { cityIndexOf, placesSource, TOTAL_PLACES } from './source'
import { scorePlace, type PlaceReputation } from './score'
import type { Place } from './types'
import { PLACES_PER_CITY } from './generate'

export type Scored = { place: Place; rep: PlaceReputation }

export type Overview = {
  places: number
  sampled: number
  googleMean: number
  filteredMean: number
  /** Share of sampled places Google rates ≥ 0.5★ above the filtered score. */
  inflatedShare: number
  worst: Scored[]
  /** Sampled places per Google rating bucket (rounded star), and the filtered one. */
  histogram: { stars: number; google: number; filtered: number }[]
}

const SAMPLE = 150

/** A spread-out sample of the city (or of everything), scored in full. */
export async function loadOverview(city: string | undefined): Promise<Overview> {
  const cityIndex = cityIndexOf(city)
  const total = cityIndex === undefined ? TOTAL_PLACES : PLACES_PER_CITY
  const stride = Math.max(1, Math.floor(total / SAMPLE))
  const page = await placesSource.search({ city, sort: 'name', page: 0, pageSize: total, withReviews: false })
  const picks = page.places.filter((_, i) => i % stride === 0).slice(0, SAMPLE)
  const full = (await Promise.all(picks.map((p) => placesSource.getPlace(p.id)))).filter((p): p is Place => p !== null)
  const scored = full.map((place) => ({ place, rep: scorePlace(place, place.reviews ?? []) })).filter((s) => s.rep.score !== null)

  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    google: scored.filter((s) => Math.round(s.place.rating ?? 0) === stars).length,
    filtered: scored.filter((s) => Math.round(s.rep.score ?? 0) === stars).length,
  }))
  return {
    places: page.total,
    sampled: scored.length,
    googleMean: mean(scored.map((s) => s.place.rating ?? 0)),
    filteredMean: mean(scored.map((s) => s.rep.score ?? 0)),
    inflatedShare: scored.length ? scored.filter((s) => (s.rep.inflation ?? 0) >= 0.5).length / scored.length : 0,
    worst: [...scored].sort((a, b) => (b.rep.inflation ?? 0) - (a.rep.inflation ?? 0)).slice(0, 8),
    histogram,
  }
}

export const cityName = (slug: string | undefined) => CITIES.find((c) => c.slug === slug)?.name ?? 'All cities'
