import { describe, expect, it } from 'vitest'
import { CITIES } from './catalog'
import { buildPlace, buildReviews, MAX_SAMPLE, parsePlaceId, PLACES_PER_CITY, placeId, truth } from './generate'
import { burstMembers, credibility, scorePlace } from './score'
import { cityIndexOf, mockSource, TOTAL_PLACES } from './source'
import type { Review } from './types'

const NOW = Date.UTC(2026, 9, 28)

function find(archetype: string, min = 40) {
  for (let i = 0; i < PLACES_PER_CITY; i++) if (truth(0, i).archetype === archetype && truth(0, i).sample >= min) return truth(0, i)
  throw new Error(`no ${archetype}`)
}

describe('dataset', () => {
  it('is large and deterministic', () => {
    expect(TOTAL_PLACES).toBeGreaterThanOrEqual(20000)
    expect(buildReviews(truth(3, 7), NOW)).toEqual(buildReviews(truth(3, 7), NOW))
  })

  it('round-trips place ids and rejects forged ones', () => {
    const id = placeId(5, 123)
    expect(parsePlaceId(id)).toEqual({ cityIndex: 5, index: 123 })
    expect(parsePlaceId(id.slice(0, -1) + (id.endsWith('0') ? '1' : '0'))).toBeNull()
    expect(parsePlaceId('nope')).toBeNull()
  })

  it('shapes places like the Places API (New)', () => {
    const p = buildPlace(truth(0, 0))
    expect(p.name).toBe(`places/${p.id}`)
    expect(p.displayName.languageCode).toBe('en')
    const r = buildReviews(truth(0, 1), NOW)[0]
    expect(r.name).toMatch(/^places\/ChIJ\w+\/reviews\/\w+$/)
    expect(r.rating).toBeGreaterThanOrEqual(1)
    expect(Date.parse(r.publishTime)).not.toBeNaN()
    expect(buildReviews(find('celebrated'), NOW)).toHaveLength(MAX_SAMPLE)
  })

  it('searches, filters and pages across every city', async () => {
    const all = await mockSource.search({ page: 0, pageSize: 10 })
    expect(all.total).toBe(TOTAL_PLACES)
    expect(all.places).toHaveLength(10)
    const one = await mockSource.search({ city: CITIES[2].slug, type: 'cafe', page: 0, pageSize: 50, sort: 'rating' })
    expect(one.places.every((p) => p.primaryType === 'cafe')).toBe(true)
    expect(one.places.map((p) => p.rating)).toEqual([...one.places.map((p) => p.rating)].sort((a, b) => b! - a!))
    expect(cityIndexOf('all')).toBeUndefined()
    expect(await mockSource.getPlace('bad')).toBeNull()
  })
})

describe('place score', () => {
  it('strips a review farm: inflated places score well below Google', () => {
    const t = find('inflated')
    const rep = scorePlace(buildPlace(t), buildReviews(t, NOW), NOW)
    expect(rep.inflation).toBeGreaterThan(0.4)
    expect(rep.findings.map((f) => f.code)).toContain('burst')
  })

  it('leaves honest places close to Google', () => {
    const t = find('honest', 100)
    const rep = scorePlace(buildPlace(t), buildReviews(t, NOW), NOW)
    expect(Math.abs(rep.inflation ?? 9)).toBeLessThan(0.5)
    expect(rep.findings.map((f) => f.code)).not.toContain('burst')
  })

  it('handles zero reviews', () => {
    const rep = scorePlace({ rating: undefined }, [], NOW)
    expect(rep.unrated).toBe(true)
    expect(rep.score).toBeNull()
  })

  it('rates throwaways below veterans and neutral without history', () => {
    const base: Review = {
      name: 'x', relativePublishTimeDescription: '', rating: 5, publishTime: new Date(NOW).toISOString(),
      authorAttribution: { displayName: 'a', uri: 'u' },
    }
    const vet = credibility({ ...base, authorStats: { reviewCount: 80, photoCount: 40, localGuideLevel: 5, memberSince: '2015-01-01' } })
    const burner = credibility({ ...base, authorStats: { reviewCount: 1, photoCount: 0, localGuideLevel: 0, memberSince: '2026-10-01' } })
    expect(vet).toBeGreaterThan(0.8)
    expect(burner).toBeLessThan(0.4)
    expect(credibility(base)).toBeCloseTo(0.6)
  })

  it('finds a burst only when dense', () => {
    const day = 86_400_000
    const spread = Array.from({ length: 20 }, (_, i) => i * 30 * day)
    expect(burstMembers(spread).size).toBe(0)
    const bursty = [...spread, ...Array.from({ length: 12 }, (_, i) => 1000 * day + (i * day) / 3)]
    expect(burstMembers(bursty).size).toBeGreaterThanOrEqual(12)
  })
})
