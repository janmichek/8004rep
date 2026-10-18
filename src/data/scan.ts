/**
 * 8004scan's public API: one host for every network, CORS open, no key.
 * Not `www.`: that host answers with a redirect that carries no CORS header.
 */
export const SCAN_API = 'https://8004scan.io/api/v1/public'

const FETCH_TIMEOUT_MS = 10_000

export type ScanDimension = {
  id: string
  label: string
  /** 0–100. */
  score: number
  /** Share of the total, 0–1. */
  weight: number
}

/** 8004scan's score of one agent, reduced to what it says about feedback. */
export type ScanScore = {
  total: number
  /** Heaviest first. */
  dimensions: ScanDimension[]
  /** The feedback inputs of its engagement dimension; absent when not reported. */
  feedback?: { average: number; count: number; weight?: number }
  /** Range the leaderboard policy squeezes scores into. */
  band?: { floor: number; ceiling: number }
  algorithm?: string
  scoredAt?: string
}

/** Ecosystem-wide numbers, for a baseline. */
export type ScanStats = { averageFeedback: number; totalFeedback: number; totalAgents: number }

const LABELS: Record<string, string> = {
  engagement: 'Engagement',
  service: 'Service',
  publisher: 'Publisher',
  compliance: 'Compliance',
  momentum: 'Momentum',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** Parses `data` of `GET /agents/{chainId}/{tokenId}`; null when it holds no score. Never throws. */
export function parseScanScore(data: unknown): ScanScore | null {
  if (!isRecord(data)) return null
  const total = num(data.total_score)
  if (total === undefined) return null

  const breakdown = isRecord(data.scores) && isRecord(data.scores.breakdown) ? data.scores.breakdown : {}
  const dims = isRecord(breakdown.dimensions) ? breakdown.dimensions : {}
  const dimensions: ScanDimension[] = Object.entries(dims)
    .flatMap(([id, d]) => {
      const score = isRecord(d) ? num(d.score) : undefined
      const weight = isRecord(d) ? num(d.weight) : undefined
      return score === undefined || weight === undefined ? [] : [{ id, label: LABELS[id] ?? id, score, weight }]
    })
    .sort((a, b) => b.weight - a.weight)
  // Indexed but never scored: a bare 0 with nothing behind it.
  if (total === 0 && dimensions.length === 0) return null

  const engagement = isRecord(dims.engagement) && isRecord(dims.engagement.details) ? dims.engagement.details : {}
  const average = num(engagement.average_score)
  const count = num(engagement.feedback_count)
  const feedbackWeight = num(engagement.feedback_weight)

  const policy = isRecord(breakdown.leaderboard_policy) ? breakdown.leaderboard_policy : {}
  const bandRaw = isRecord(policy.score_band) ? policy.score_band : {}
  const floor = num(bandRaw.floor)
  const ceiling = num(bandRaw.ceiling)
  const algorithm = typeof breakdown.algorithm === 'string' ? breakdown.algorithm : undefined
  const version = typeof breakdown.version === 'string' ? breakdown.version : undefined
  const scoredAt = isRecord(data.scores) && typeof data.scores.last_scored_at === 'string' ? data.scores.last_scored_at : undefined

  return {
    total,
    dimensions,
    ...(average !== undefined && count !== undefined
      ? { feedback: { average, count, ...(feedbackWeight !== undefined ? { weight: feedbackWeight } : {}) } }
      : {}),
    ...(floor !== undefined && ceiling !== undefined ? { band: { floor, ceiling } } : {}),
    ...(algorithm ? { algorithm: version ? `${algorithm} v${version}` : algorithm } : {}),
    ...(scoredAt ? { scoredAt } : {}),
  }
}

export function parseScanStats(data: unknown): ScanStats | null {
  if (!isRecord(data)) return null
  const averageFeedback = num(data.average_feedback_score)
  const totalFeedback = num(data.total_feedbacks)
  const totalAgents = num(data.total_agents)
  if (averageFeedback === undefined || totalFeedback === undefined || totalAgents === undefined) return null
  return { averageFeedback, totalFeedback, totalAgents }
}

async function getData(path: string): Promise<unknown> {
  const res = await fetch(`${SCAN_API}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`8004scan answered ${res.status}`)
  const body: unknown = await res.json()
  return isRecord(body) && body.success === true ? body.data : null
}

const scoreCache = new Map<string, Promise<ScanScore | null>>()
let statsCache: Promise<ScanStats | null> | undefined

/** Null when 8004scan has not indexed or scored the agent. Failed lookups are not cached. */
export function fetchScanScore(chainId: number, tokenId: bigint): Promise<ScanScore | null> {
  const key = `${chainId}:${tokenId}`
  let hit = scoreCache.get(key)
  if (!hit) {
    hit = getData(`/agents/${chainId}/${tokenId}`).then(parseScanScore)
    hit.catch(() => scoreCache.delete(key))
    scoreCache.set(key, hit)
  }
  return hit
}

export function fetchScanStats(): Promise<ScanStats | null> {
  if (!statsCache) {
    statsCache = getData('/stats').then(parseScanStats)
    statsCache.catch(() => (statsCache = undefined))
  }
  return statsCache
}
