import { CITIES, KINDS } from './catalog'
import { buildPlace, buildReviews, parsePlaceId, PLACES_PER_CITY, today, truth, type PlaceTruth } from './generate'
import type { Place, PlaceSearch, PlaceSearchResult, PlacesSource } from './types'

const byCity = new Map<number, PlaceTruth[]>()

function cityPlaces(cityIndex: number): PlaceTruth[] {
  let list = byCity.get(cityIndex)
  if (!list) {
    list = Array.from({ length: PLACES_PER_CITY }, (_, i) => truth(cityIndex, i))
    byCity.set(cityIndex, list)
  }
  return list
}

export const TOTAL_PLACES = CITIES.length * PLACES_PER_CITY

export function cityIndexOf(slug: string | undefined): number | undefined {
  if (!slug || slug === 'all') return undefined
  const i = CITIES.findIndex((c) => c.slug === slug)
  return i < 0 ? undefined : i
}

const nameCache = new Map<string, string>()
function nameOf(t: PlaceTruth): string {
  const key = `${t.cityIndex}:${t.index}`
  let name = nameCache.get(key)
  if (!name) {
    name = buildPlace(t).displayName.text.toLowerCase()
    nameCache.set(key, name)
  }
  return name
}

function withReviews(t: PlaceTruth): Place {
  return { ...buildPlace(t), reviews: buildReviews(t, today()) }
}

/** Generated dataset behind the same interface a Places API client would implement. */
export const mockSource: PlacesSource = {
  kind: 'generated',

  async search(opts: PlaceSearch): Promise<PlaceSearchResult> {
    const cityIndex = cityIndexOf(opts.city)
    let rows = cityIndex === undefined ? CITIES.flatMap((_, i) => cityPlaces(i)) : cityPlaces(cityIndex)
    if (opts.type) rows = rows.filter((t) => t.kind.type === opts.type)
    const q = opts.q?.trim().toLowerCase()
    if (q) rows = rows.filter((t) => nameOf(t).includes(q))

    const sort = opts.sort ?? 'reviews'
    rows = [...rows].sort((a, b) =>
      sort === 'rating'
        ? b.rating - a.rating || b.count - a.count
        : sort === 'name'
          ? nameOf(a).localeCompare(nameOf(b))
          : b.count - a.count || b.rating - a.rating,
    )
    const start = opts.page * opts.pageSize
    const places = rows.slice(start, start + opts.pageSize).map((t) => (opts.withReviews ? withReviews(t) : buildPlace(t)))
    return { places, total: rows.length }
  },

  async getPlace(id: string): Promise<Place | null> {
    const parsed = parsePlaceId(id)
    return parsed ? withReviews(truth(parsed.cityIndex, parsed.index)) : null
  },
}

export const PLACE_TYPES = KINDS.map((k) => ({ type: k.type, label: k.label }))

/** The one source the views use; swap for a Places API client to go live. */
export const placesSource: PlacesSource = mockSource
