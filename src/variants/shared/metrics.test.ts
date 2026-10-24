import { describe, expect, it } from 'vitest'
import type { FeedbackEvent } from '../../data/types'
import {
  activeDays,
  asciiBar,
  byDay,
  candles,
  coRated,
  edgesOf,
  effectiveCount,
  evenness,
  gini,
  histogram,
  letterGrade,
  mean,
  quantile,
  rankScore,
  runningAverage,
  seededPoint,
  sparkPath,
  stdDev,
  toCsv,
  topShare,
  velocity,
  weekHourGrid,
} from './metrics'

const A = '0x00000000000000000000000000000000000000a1'
const B = '0x00000000000000000000000000000000000000b2'
const ev = (client: string, tokenId: bigint, createdAt?: number): FeedbackEvent => ({ client: client as `0x${string}`, tokenId, value: 90, revoked: false, createdAt })

describe('concentration', () => {
  it('gini is 0 when even and grows when one holds most', () => {
    expect(gini([5, 5, 5])).toBeCloseTo(0)
    expect(gini([0, 0, 10])!).toBeCloseTo(2 / 3)
    expect(gini([])).toBeNull()
  })
  it('evenness is 1 for an even spread and 0 for a single holder', () => {
    expect(evenness([3, 3, 3])).toBeCloseTo(1)
    expect(evenness([4])).toBe(0)
  })
  it('top share and effective count', () => {
    expect(topShare([6, 2, 2], 1)).toBeCloseTo(0.6)
    expect(effectiveCount([1, 1, 1, 1])).toBeCloseTo(4)
    expect(effectiveCount([])).toBeNull()
  })
})

describe('time', () => {
  const mon = Date.UTC(2026, 9, 19, 10) / 1000 // Monday 10:00 UTC
  it('buckets by UTC weekday and hour, Monday first', () => {
    const grid = weekHourGrid([mon, mon + 60, undefined])
    expect(grid[0][10]).toBe(2)
  })
  it('velocity is rows per day over the dated span', () => {
    expect(velocity([mon, mon + 86400 * 2, mon + 86400 * 4])).toBeCloseTo(0.75)
    expect(velocity([mon])).toBeNull()
  })
  it('counts active days and the longest streak', () => {
    expect(activeDays([mon, mon + 86400, mon + 86400 * 3, mon + 10])).toEqual({ days: 3, streak: 2 })
  })
  it('running average skips revoked and undated rows', () => {
    const rows = [
      { client: A as `0x${string}`, value: 100, revoked: false, createdAt: 2 },
      { client: A as `0x${string}`, value: 0, revoked: true, createdAt: 3 },
      { client: A as `0x${string}`, value: 50, revoked: false, createdAt: 1 },
    ]
    expect(runningAverage(rows).map((p) => p.average)).toEqual([50, 75])
  })
  it('groups consecutive rows by day', () => {
    const groups = byDay([ev(A, 1n, 86400 * 3 + 5), ev(A, 1n, 86400 * 3), ev(A, 1n, 86400)])
    expect(groups.map((g) => g.rows.length)).toEqual([2, 1])
  })
})

describe('scores', () => {
  it('rank score shrinks small samples toward the prior', () => {
    expect(rankScore({ count: 2, average: 100 }, 80)).toBeCloseTo((200 + 400) / 7)
    expect(rankScore({ count: 0, average: 0 }, 80)).toBeNull()
  })
  it('letter grade bands and caps', () => {
    expect(letterGrade(97, 'strong', 'clean')).toBe('A+')
    expect(letterGrade(97, 'thin', 'clean')).toBe('B')
    expect(letterGrade(97, 'strong', 'high')).toBe('D')
    expect(letterGrade(30, 'strong', 'warn')).toBe('F')
    expect(letterGrade(null, 'none', 'clean')).toBe('NR')
  })
})

describe('graph', () => {
  it('merges reviewer → agent edges', () => {
    expect(edgesOf([ev(A, 1n), ev(A, 1n), ev(B, 1n)])).toEqual([
      { client: A, tokenId: 1n, rows: 2 },
      { client: B, tokenId: 1n, rows: 1 },
    ])
  })
  it('finds agents co-rated by the same reviewers', () => {
    const out = coRated([ev(A, 1n), ev(A, 2n), ev(B, 2n), ev(B, 3n)], [A, B], 1n)
    expect(out[0]).toMatchObject({ tokenId: 2n, shared: 2 })
  })
})

describe('distribution', () => {
  it('mean and standard deviation', () => {
    expect(mean([2, 4, 6])).toBe(4)
    expect(mean([])).toBeNull()
    expect(stdDev([2, 4, 6])).toBeCloseTo(Math.sqrt(8 / 3))
    expect(stdDev([7])).toBeNull()
  })
  it('bins values into equal buckets, ignoring out-of-range ones', () => {
    expect(histogram([0, 9, 10, 99, 100, -5, 120], 2).map((b) => b.count)).toEqual([3, 2])
  })
  it('interpolates quantiles', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25)
    expect(quantile([], 0.5)).toBeNull()
  })
  it('builds daily candles oldest first, skipping revoked and undated rows', () => {
    const day = 86400
    const rows = [
      { value: 70, revoked: false, createdAt: day * 2 + 10 },
      { value: 90, revoked: false, createdAt: day * 2 + 20 },
      { value: 60, revoked: false, createdAt: day * 2 + 30 },
      { value: 10, revoked: true, createdAt: day * 2 + 40 },
      { value: 50, revoked: false },
      { value: 80, revoked: false, createdAt: day + 5 },
    ]
    expect(candles(rows)).toEqual([
      { day: day, open: 80, high: 80, low: 80, close: 80, count: 1 },
      { day: day * 2, open: 70, high: 90, low: 60, close: 60, count: 3 },
    ])
  })
  it('places a seed deterministically inside the padded box', () => {
    const a = seededPoint('agent-1', 100, 50, 5)
    expect(a).toEqual(seededPoint('agent-1', 100, 50, 5))
    expect(a.x).toBeGreaterThanOrEqual(5)
    expect(a.x).toBeLessThanOrEqual(95)
    expect(a.y).toBeGreaterThanOrEqual(5)
    expect(a.y).toBeLessThanOrEqual(45)
  })
})

describe('output', () => {
  it('quotes CSV cells that need it', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"']])).toBe('a,b\n"x,y","say ""hi"""')
  })
  it('draws sparklines and bars', () => {
    expect(sparkPath([0, 10], 10, 10)).toBe('M0.0,10.0 L10.0,0.0')
    expect(asciiBar(0.5, 4)).toBe('██░░')
  })
})
