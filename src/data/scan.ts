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
