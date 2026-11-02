/**
 * 8004scan's public API: one host for every network, CORS open, no key.
 * Not `www.`: that host answers with a redirect that carries no CORS header.
 */
export const SCAN_API = 'https://8004scan.io/api/v1/public'
const SCAN_SITE = 'https://8004scan.io'

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
  /** How the headline is actually built, as the API reports it. */
  policy?: {
    proofWeight: number
    supportWeight: number
    proofScore: number
    supportScore: number
    merit: number
    evidenceTier?: string
    integrityTier?: string
  }
  algorithm?: string
  scoredAt?: string
}

/** Ecosystem-wide numbers, for a baseline. */
export type ScanStats = { averageFeedback: number; totalFeedback: number; totalAgents: number }

/**
 * Network-wide feedback totals. The registries do not aggregate these, so they
 * come from 8004scan's index rather than the window this app loads from chain.
 */
export type ScanChainFeedback = {
  /** Every feedback row 8004scan has indexed on the chain. */
  totalFeedback: number | null
  /** Agents carrying at least one feedback row. */
  ratedAgents: number | null
  /** Feedbacks added over the last 30 days; null when the growth series is unavailable. */
  feedback30d: number | null
}

/** One network as 8004scan lists it. */
export type ScanChain = { chainId: number; name: string; key: string; testnet: boolean }

/** A row of 8004scan's all-network agent table. */
export type ScanAgent = {
  chainId: number
  tokenId: bigint
  name?: string
  description?: string
  imageUrl?: string
  owner: string | null
  protocols: string[]
  x402: boolean
  /** 8004scan's 0–100 leaderboard score. */
  totalScore: number
  averageScore: number
  feedbackCount: number
  /** Unix seconds. */
  createdAt?: number
  testnet: boolean
}

export type ScanAgentPage = { items: ScanAgent[]; total: number; hasMore: boolean }

/** One service advertised in 8004scan's copy of the registration file. */
export type ScanService = { name: string; endpoint: string; version?: string }

/** An agent as 8004scan's public API reports it, for networks this app has no chain config for. */
export type ScanAgentDetail = {
  chainId: number
  tokenId: bigint
  name?: string
  description?: string
  imageUrl?: string
  owner: string | null
  agentWallet: string | null
  protocols: string[]
  x402: boolean
  services: ScanService[]
  supportedTrust: string[]
  /** 8004scan's 0–100 leaderboard score. */
  totalScore: number
  averageScore: number
  feedbackCount: number
  active?: boolean
  /** Unix seconds. */
  createdAt?: number
}

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
  // Zero headline with no breakdown: scored only if feedback sits behind it.
  // 8004scan can report total_score 0 with scores null yet average_score > 0 and feedback rows.
  if (total === 0 && dimensions.length === 0) {
    const average = num(data.average_score)
    const feedbacks = num(data.total_feedbacks)
    if (!average || !feedbacks || average <= 0 || feedbacks <= 0) return null
    return { total: average, dimensions: [], feedback: { average, count: feedbacks } }
  }

  const engagement = isRecord(dims.engagement) && isRecord(dims.engagement.details) ? dims.engagement.details : {}
  const average = num(engagement.average_score)
  const count = num(engagement.feedback_count)
  const feedbackWeight = num(engagement.feedback_weight)

  const policy = isRecord(breakdown.leaderboard_policy) ? breakdown.leaderboard_policy : {}
  const bandRaw = isRecord(policy.score_band) ? policy.score_band : {}
  const floor = num(bandRaw.floor)
  const ceiling = num(bandRaw.ceiling)
  const weights = isRecord(policy.weights) ? policy.weights : {}
  const proofWeight = num(weights.proof)
  const supportWeight = num(weights.support)
  const proofScore = num(policy.proof_score)
  const supportScore = num(policy.support_score)
  const merit = num(policy.merit_score)
  const evidenceTier = typeof policy.evidence_tier === 'string' ? policy.evidence_tier : undefined
  const integrityTier = typeof policy.integrity_tier === 'string' ? policy.integrity_tier : undefined
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
    ...(proofWeight !== undefined &&
    supportWeight !== undefined &&
    proofScore !== undefined &&
    supportScore !== undefined &&
    merit !== undefined
      ? {
          policy: {
            proofWeight,
            supportWeight,
            proofScore,
            supportScore,
            merit,
            ...(evidenceTier ? { evidenceTier } : {}),
            ...(integrityTier ? { integrityTier } : {}),
          },
        }
      : {}),
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

/** Reads `meta.pagination.total` from any 8004scan list envelope. */
export function parseScanPageTotal(body: unknown): number | null {
  if (!isRecord(body) || !isRecord(body.meta) || !isRecord(body.meta.pagination)) return null
  return num(body.meta.pagination.total) ?? null
}

/**
 * Feedbacks added over the 30-day growth series: the last cumulative point
 * minus the first. Null when the chain has no series or fewer than two points.
 */
export function parseFeedbackGrowth(body: unknown, chainId: number): number | null {
  if (!isRecord(body) || !Array.isArray(body.chains)) return null
  const chain = body.chains.find(
    (row): row is Record<string, unknown> => isRecord(row) && num(row.chain_id) === chainId,
  )
  if (!chain || !Array.isArray(chain.data)) return null
  const totals = chain.data.flatMap((row) => {
    const feedbacks = isRecord(row) ? num(row.feedbacks) : undefined
    return feedbacks === undefined ? [] : [feedbacks]
  })
  if (totals.length < 2) return null
  const change = totals[totals.length - 1] - totals[0]
  return change >= 0 ? change : null
}

export function parseScanChains(data: unknown): ScanChain[] {
  if (!isRecord(data) || !Array.isArray(data.supported_chains)) return []
  return data.supported_chains.flatMap((value) => {
    if (!isRecord(value)) return []
    const chainId = num(value.chain_id)
    const name = typeof value.name === 'string' ? value.name : undefined
    const key = typeof value.key === 'string' ? value.key : undefined
    if (chainId === undefined || !name || !key) return []
    return [{ chainId, name, key, testnet: value.is_testnet === true }]
  })
}

export function parseScanAgent(value: unknown): ScanAgent | null {
  if (!isRecord(value)) return null
  const chainId = num(value.chain_id)
  const tokenRaw = value.token_id
  const tokenId =
    typeof tokenRaw === 'string' && /^\d+$/.test(tokenRaw)
      ? BigInt(tokenRaw)
      : typeof tokenRaw === 'number' && Number.isInteger(tokenRaw)
        ? BigInt(tokenRaw)
        : undefined
  if (chainId === undefined || tokenId === undefined) return null

  const created = typeof value.created_at === 'string' ? Date.parse(value.created_at) : Number.NaN
  const protocols = Array.isArray(value.supported_protocols)
    ? value.supported_protocols.filter((item): item is string => typeof item === 'string')
    : []
  return {
    chainId,
    tokenId,
    ...(typeof value.name === 'string' && value.name ? { name: value.name } : {}),
    ...(typeof value.description === 'string' && value.description ? { description: value.description } : {}),
    ...(typeof value.image_url === 'string' && value.image_url ? { imageUrl: value.image_url } : {}),
    owner: typeof value.owner_address === 'string' ? value.owner_address : null,
    protocols,
    x402: value.x402_supported === true,
    totalScore: num(value.total_score) ?? 0,
    averageScore: num(value.average_score) ?? 0,
    feedbackCount: num(value.total_feedbacks) ?? 0,
    ...(Number.isFinite(created) ? { createdAt: Math.floor(created / 1000) } : {}),
    testnet: value.is_testnet === true,
  }
}

/** Parses `data` of `GET /agents/{chainId}/{tokenId}`; null when it holds no agent. Never throws. */
export function parseScanAgentDetail(data: unknown): ScanAgentDetail | null {
  if (!isRecord(data)) return null
  const chainId = num(data.chain_id)
  const tokenRaw = data.token_id
  const tokenId =
    typeof tokenRaw === 'string' && /^\d+$/.test(tokenRaw)
      ? BigInt(tokenRaw)
      : typeof tokenRaw === 'number' && Number.isInteger(tokenRaw)
        ? BigInt(tokenRaw)
        : undefined
  if (chainId === undefined || tokenId === undefined) return null

  const created = typeof data.created_at === 'string' ? Date.parse(data.created_at) : Number.NaN
  const protocols = Array.isArray(data.supported_protocols)
    ? data.supported_protocols.filter((item): item is string => typeof item === 'string')
    : []
  const servicesRaw = isRecord(data.services) ? data.services : {}
  const services: ScanService[] = Object.entries(servicesRaw).flatMap(([name, value]) => {
    if (!isRecord(value) || typeof value.endpoint !== 'string' || !value.endpoint) return []
    const version = typeof value.version === 'string' && value.version ? { version: value.version } : {}
    return [{ name, endpoint: value.endpoint, ...version }]
  })
  const trust = Array.isArray(data.supported_trust_models)
    ? data.supported_trust_models.filter((item): item is string => typeof item === 'string')
    : []

  return {
    chainId,
    tokenId,
    ...(typeof data.name === 'string' && data.name ? { name: data.name } : {}),
    ...(typeof data.description === 'string' && data.description ? { description: data.description } : {}),
    ...(typeof data.image_url === 'string' && data.image_url ? { imageUrl: data.image_url } : {}),
    owner: typeof data.owner_address === 'string' ? data.owner_address : null,
    agentWallet: typeof data.agent_wallet === 'string' ? data.agent_wallet : null,
    protocols,
    x402: data.x402_supported === true,
    services,
    supportedTrust: trust,
    totalScore: num(data.total_score) ?? 0,
    averageScore: num(data.average_score) ?? 0,
    feedbackCount: num(data.total_feedbacks) ?? 0,
    ...(typeof data.is_active === 'boolean' ? { active: data.is_active } : {}),
    ...(Number.isFinite(created) ? { createdAt: Math.floor(created / 1000) } : {}),
  }
}

/** Parses the envelope of `GET /agents`; null when it carries no page. */
export function parseScanAgentPage(body: unknown): ScanAgentPage | null {
  if (!isRecord(body) || body.success !== true) return null
  const rows = body.data
  if (!Array.isArray(rows)) return null
  const meta = isRecord(body.meta) && isRecord(body.meta.pagination) ? body.meta.pagination : {}
  const items = rows.flatMap((row) => {
    const agent = parseScanAgent(row)
    return agent ? [agent] : []
  })
  return {
    items,
    total: num(meta.total) ?? items.length,
    hasMore: meta.hasMore === true,
  }
}

async function getData(path: string): Promise<unknown> {
  const res = await fetch(`${SCAN_API}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`8004scan answered ${res.status}`)
  const body: unknown = await res.json()
  return isRecord(body) && body.success === true ? body.data : null
}

/**
 * JSON from any 8004scan URL. Some internal endpoints (the growth series) do
 * not send CORS headers; a browser TypeError is retried through the same
 * `/api/fetch-json` relay the registration files use.
 */
async function getJson(url: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (err) {
    if (!(err instanceof TypeError)) throw err
    res = await fetch(`${import.meta.env.BASE_URL}api/fetch-json?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`8004scan answered ${res.status}`)
  return res.json().catch(() => null)
}

async function getPage(path: string): Promise<ScanAgentPage> {
  const res = await fetch(`${SCAN_API}${path}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`8004scan answered ${res.status}`)
  const page = parseScanAgentPage(await res.json().catch(() => null))
  if (!page) throw new Error('8004scan returned an unexpected agent list')
  return page
}

const scoreCache = new Map<string, Promise<ScanScore | null>>()
const detailCache = new Map<string, Promise<ScanAgentDetail | null>>()
let statsCache: Promise<ScanStats | null> | undefined
let chainsCache: Promise<ScanChain[]> | undefined

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

/** Null when 8004scan has not indexed the agent. Failed lookups are not cached. */
export function fetchScanAgentDetail(chainId: number, tokenId: bigint): Promise<ScanAgentDetail | null> {
  const key = `${chainId}:${tokenId}`
  let hit = detailCache.get(key)
  if (!hit) {
    hit = getData(`/agents/${chainId}/${tokenId}`).then(parseScanAgentDetail)
    hit.catch(() => detailCache.delete(key))
    detailCache.set(key, hit)
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

const chainFeedbackCache = new Map<number, Promise<ScanChainFeedback>>()

/** Each total is independent: a failed request leaves that one null, not the card. */
async function loadChainFeedback(chainId: number): Promise<ScanChainFeedback> {
  const [total, rated, growth] = await Promise.allSettled([
    getJson(`${SCAN_API}/feedbacks?chainId=${chainId}&limit=1`).then(parseScanPageTotal),
    // `minFeedbacks=1` counts agents that have been rated, not every registered one.
    getJson(`${SCAN_API}/agents?chainId=${chainId}&limit=1&minFeedbacks=1`).then(parseScanPageTotal),
    getJson(`${SCAN_SITE}/api/v1/stats/growth/chains?period=30d`).then((body) => parseFeedbackGrowth(body, chainId)),
  ])
  const result: ScanChainFeedback = {
    totalFeedback: total.status === 'fulfilled' ? total.value : null,
    ratedAgents: rated.status === 'fulfilled' ? rated.value : null,
    feedback30d: growth.status === 'fulfilled' ? growth.value : null,
  }
  if (result.totalFeedback === null && result.ratedAgents === null && result.feedback30d === null) {
    throw new Error('8004scan returned no network feedback totals')
  }
  return result
}

/** Network-wide totals for a chain; one lookup per chain per session. */
export function fetchScanChainFeedback(chainId: number): Promise<ScanChainFeedback> {
  let hit = chainFeedbackCache.get(chainId)
  if (!hit) {
    hit = loadChainFeedback(chainId)
    hit.catch(() => chainFeedbackCache.delete(chainId))
    chainFeedbackCache.set(chainId, hit)
  }
  return hit
}

/** Every network 8004scan indexes, for naming rows and linking those this app cannot open. */
export function fetchScanChains(): Promise<ScanChain[]> {
  if (!chainsCache) {
    chainsCache = getData('/stats').then(parseScanChains)
    chainsCache.catch(() => (chainsCache = undefined))
  }
  return chainsCache
}

/** Newest agents; `isTestnet` omitted means both environments, `chainId` omitted means every network. */
export function fetchScanAgents(options: {
  page: number
  pageSize: number
  search?: string
  isTestnet?: boolean
  chainId?: number
  /** Only fields the API sorts quickly are offered: `created_at`, `total_score` and `total_feedbacks`. */
  sortBy?: 'created_at' | 'total_score' | 'total_feedbacks'
  sortOrder?: 'asc' | 'desc'
}): Promise<ScanAgentPage> {
  const params = new URLSearchParams({ page: String(options.page + 1), limit: String(options.pageSize) })
  if (options.search) params.set('search', options.search)
  if (options.isTestnet !== undefined) params.set('isTestnet', String(options.isTestnet))
  if (options.chainId !== undefined) params.set('chainId', String(options.chainId))
  if (options.sortBy) params.set('sortBy', options.sortBy)
  if (options.sortOrder) params.set('sortOrder', options.sortOrder)
  return getPage(`/agents?${params.toString()}`)
}
