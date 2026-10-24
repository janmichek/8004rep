import { seededPoint } from '../shared/metrics'

/** Deterministic position of a place (agent) on a `w`×`h` plate. */
export function pointOf(id: bigint | string, w: number, h: number, pad = 0): { x: number; y: number } {
  return seededPoint(`place:${id}`, w, h, pad)
}

/** A stable false coordinate for a place, independent of the plate size. */
export function coordsOf(id: bigint | string): { lat: number; lon: number; text: string } {
  const p = seededPoint(`coords:${id}`, 3600, 1800)
  const lon = p.x / 10 - 180
  const lat = 90 - p.y / 10
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return {
    lat,
    lon,
    text: `${Math.abs(lat).toFixed(1)}° ${ns}, ${Math.abs(lon).toFixed(1)}° ${ew}`,
  }
}

/** Terrain named after how well surveyed a place is. */
export function terrainOf(score: number | null | undefined): { name: string; tone: 'high' | 'mid' | 'low' | 'none' } {
  if (score === null || score === undefined) return { name: 'uncharted', tone: 'none' }
  if (score >= 85) return { name: 'highland', tone: 'high' }
  if (score >= 65) return { name: 'plateau', tone: 'high' }
  if (score >= 40) return { name: 'lowland', tone: 'mid' }
  if (score >= 15) return { name: 'marsh', tone: 'low' }
  return { name: 'badlands', tone: 'low' }
}

/** Radius of a place mark for a number of soundings. */
export function markRadius(count: number | undefined): number {
  const n = Math.max(0, count ?? 0)
  return 3 + Math.min(9, Math.sqrt(n) * 1.6)
}

/** Contour ring radii for a plate's decorative relief. */
export const RELIEF = [42, 68, 98, 132, 170]
