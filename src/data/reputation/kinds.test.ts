import { describe, expect, it } from 'vitest'
import { classify, inferScale, kindOf, normalize, tagKey } from './kinds'

describe('kindOf', () => {
  it('folds case, separators and camel case', () => {
    expect(kindOf('Starred')).toBe('rating')
    expect(kindOf(' response_time ')).toBe('telemetry')
    expect(kindOf('SuccessRate')).toBe('telemetry')
    expect(kindOf('certificate_issued')).toBe('outcome')
    expect(kindOf('glicko2-mu')).toBe('metric')
  })

  it('reads a namespaced tag by its segments', () => {
    expect(kindOf('review:submission')).toBe('outcome')
    expect(kindOf('gfh:quality')).toBe('rating')
  })

  it('calls an unknown tag unknown', () => {
    expect(kindOf('mystery')).toBe('unknown')
    expect(kindOf(undefined)).toBe('unknown')
  })
})

describe('inferScale', () => {
  it('reads 0/1 values as a pass flag', () => {
    expect(inferScale([0, 1, 1])).toMatchObject({ scale: 'binary', span: 1 })
  })

  it('picks the narrowest scale that holds the values', () => {
    expect(inferScale([1, 2, 3])).toMatchObject({ scale: 'five', span: 5 })
    expect(inferScale([7, 8])).toMatchObject({ scale: 'ten', span: 10 })
    expect(inferScale([40, 90])).toMatchObject({ scale: 'hundred', span: 100 })
  })

  it('treats negatives as a signed scale', () => {
    expect(inferScale([-1, 1])).toMatchObject({ scale: 'signed', span: 1 })
    expect(inferScale([-100, 0])).toMatchObject({ scale: 'signed', span: 100 })
  })

  it('gives no scale to values beyond 100', () => {
    expect(inferScale([12_000])).toMatchObject({ scale: 'unbounded' })
  })
})

describe('normalize', () => {
  it('maps each scale onto 0–1', () => {
    expect(normalize(100, 'hundred', 100)).toBe(1)
    expect(normalize(5, 'ten', 10)).toBe(0.5)
    expect(normalize(0, 'signed', 100)).toBe(0.5)
    expect(normalize(-100, 'signed', 100)).toBe(0)
  })

  it('returns null outside the scale instead of clamping', () => {
    expect(normalize(120, 'hundred', 100)).toBeNull()
    expect(normalize(-1, 'hundred', 100)).toBeNull()
  })
})

describe('classify', () => {
  it('scores ratings and leaves every other kind alone', () => {
    const rows = [
      { client: '0xa', tag1: 'starred', value: 90, revoked: false },
      { client: '0xb', tag1: 'starred', value: 70, revoked: false },
      { client: '0xa', tag1: 'uptime', value: 99, revoked: false },
      { client: '0xc', tag1: 'revenue', value: 12_000, revoked: false },
      { client: '0xd', tag1: 'paid', value: 1, revoked: false },
    ]
    const { rows: out, tags } = classify(rows)
    expect(out.map((r) => r.kind)).toEqual(['rating', 'rating', 'telemetry', 'metric', 'outcome'])
    expect(out.filter((r) => r.r !== null)).toHaveLength(2)
    expect(out[0].r).toBeCloseTo(0.9)
    expect(tags.find((t) => t.tag === 'starred')).toMatchObject({ kind: 'rating', scale: 'hundred', rows: 2 })
  })

  it('lets a reviewer with enough values override the tag scale', () => {
    const rows = [
      ...Array.from({ length: 5 }, (_, i) => ({ client: '0xa', tag1: 'quality', value: i, revoked: false })),
      ...Array.from({ length: 5 }, (_, i) => ({ client: '0xb', tag1: 'quality', value: i * 20, revoked: false })),
    ]
    const { rows: out, tags } = classify(rows)
    expect(tags[0].mixedScale).toBe(true)
    // The 0–4 reviewer is read on 0–5, the 0–80 one on 0–100.
    expect(out[0]).toMatchObject({ scale: 'five', span: 5 })
    expect(out[5]).toMatchObject({ scale: 'hundred', span: 100 })
  })

  it('keeps an out-of-scale rating in the list but out of the score', () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => ({ client: `0x${i}`, tag1: 'starred', value: 100, revoked: false })),
      { client: '0xf', tag1: 'starred', value: 400, revoked: false },
    ]
    const { rows: out } = classify(rows)
    expect(out[8].scale).toBe('hundred')
    expect(out[8].r).toBeNull()
  })

  it('ignores revoked rows when inferring a scale', () => {
    const rows = [
      { client: '0xa', tag1: 'trust', value: 5, revoked: false },
      { client: '0xb', tag1: 'trust', value: 500, revoked: true },
    ]
    expect(classify(rows).tags[0]).toMatchObject({ scale: 'five', rows: 1 })
  })
})

describe('tagKey', () => {
  it('drops separators and case', () => {
    expect(tagKey(' Response_Time ')).toBe('responsetime')
    expect(tagKey('review:submission')).toBe('review:submission')
  })
})
