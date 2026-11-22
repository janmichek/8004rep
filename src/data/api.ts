import type { Address } from 'viem'
import type { Feedback, RegistrationFile, ReputationSummary, Service } from './types'
import type { ScanAgent, ScanAgentPage } from './scan'
import type { FeedbackStats } from './feedbackStats'
import type { ReputationReport } from './reputation/report'
import type { TrustReport } from './trustReport'

const DEFAULT_API = 'https://8004scan.fly.dev'
const configured = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
/** `VITE_API_URL=off` keeps the app on 8004scan / browser RPC. */
export const API_URL = (configured && !/^(off|false|none|0)$/i.test(configured) ? configured : DEFAULT_API).replace(/\/+$/, '')
export const API_ENABLED = !/^(off|false|none|0)$/i.test(configured ?? '')
export const API_TIMEOUT_MS = 7_000
/** Chains the deployed indexer covers; the rest keep the 8004scan fallback. */
export const INDEXED_CHAINS = new Set([8453, 1, 5000])

export type ApiAgent = {
  chainId: number
  tokenId: string
  owner: string | null
  agentWallet: string | null
  agentURI: string | null
  createdAt: number | null
  totalFeedback: number
  name: string | null
  description: string | null
  image: string | null
  active: boolean | null
  x402: boolean | null
  services: Service[]
  supportedTrust: string[]
  file: RegistrationFile | null
  score: number | null
  rawScore: number | null
  rawRatings: number | null
  inflationGap: number | null
  costToFake: number | null
  confidence: 'low' | 'medium' | 'high' | null
  unrated: boolean
  riskLevel: string | null
  wallets: number | null
  neff: number | null
  top1: number | null
  scanScore: number | null
  report?: ReputationReport | null
  stats?: FeedbackStats | null
  trust?: TrustReport | null
}

export type ApiFeedback = Feedback & {
  chainId: number
  tokenId: string
  agentName?: string | null
  agentOwner?: string | null
  comment?: string | null
}

export type ApiAgentDetail = ApiAgent & {
  reputation: ReputationSummary | null
  feedback: ApiFeedback[]
  source: 'index' | 'subgraph' | 'rpc'
}

export type ApiAgentPage = {
  items: ApiAgent[]
  total: number
  hasMore: boolean
  page: number
  limit: number
  source: 'index'
}

async function apiGet<T>(path: string, params: Record<string, string | number | undefined> = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const url = new URL(`${API_URL}${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value))
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`API responded with HTTP ${res.status}`)
  return (await res.json()) as T
}

function protocolsOf(agent: ApiAgent): string[] {
  return [...new Set(agent.services.map((service) => service.name).filter(Boolean))]
}

/** Our indexed row in the shape the existing table already renders. */
export function toScanAgent(agent: ApiAgent): ScanAgent {
  const protocols = protocolsOf(agent)
  const score = agent.score ?? agent.rawScore ?? agent.scanScore ?? 0
  return {
    chainId: agent.chainId,
    tokenId: BigInt(agent.tokenId),
    ...(agent.name ? { name: agent.name } : {}),
    ...(agent.description ? { description: agent.description } : {}),
    ...(agent.image ? { imageUrl: agent.image } : {}),
    owner: agent.owner,
    protocols,
    x402: agent.x402 === true,
    totalScore: Math.max(0, Math.min(100, score)),
    averageScore: agent.rawScore ?? agent.rawRatings ?? 0,
    feedbackCount: agent.totalFeedback,
    ...(agent.createdAt ? { createdAt: agent.createdAt } : {}),
    testnet: false,
  }
}

export async function fetchApiAgents(options: {
  page: number
  pageSize: number
  chainId?: number
  search?: string
  sort?: 'createdAt' | 'score' | 'feedback' | 'tokenId'
  order?: 'asc' | 'desc'
  rated?: boolean
}): Promise<ScanAgentPage> {
  const data = await apiGet<ApiAgentPage>('/api/agents', {
    page: options.page,
    limit: options.pageSize,
    chainId: options.chainId,
    q: options.search,
    sort: options.sort,
    order: options.order,
    rated: options.rated ? '1' : undefined,
  })
  return { items: data.items.map(toScanAgent), total: data.total, hasMore: data.hasMore }
}

export async function fetchApiAgent(chainId: number, tokenId: bigint): Promise<ApiAgentDetail | null> {
  const data = await apiGet<ApiAgentDetail>(`/api/agents/${chainId}/${tokenId.toString()}`, {}, 15_000)
  const feedback = (data.feedback ?? []).map((row) => ({
    ...row,
    chainId: data.chainId,
    tokenId: data.tokenId,
    client: row.client as Address,
  }))
  return {
    ...data,
    tokenId: data.tokenId,
    feedback,
    file: data.file ?? null,
    reputation: data.reputation ?? null,
  }
}

export async function fetchApiAgentAsDetail(chainId: number, tokenId: bigint) {
  const data = await fetchApiAgent(chainId, tokenId)
  if (!data) return null
  return {
    agent: {
      chainId: data.chainId,
      tokenId: BigInt(data.tokenId),
      owner: (data.owner as Address | null) ?? null,
      agentWallet: (data.agentWallet as Address | null) ?? null,
      agentURI: data.agentURI,
      ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      totalFeedback: data.totalFeedback,
      file: data.file,
      reputation: data.reputation,
      feedback: data.feedback,
    },
    precomputed:
      data.report && data.stats && data.trust
        ? { report: data.report, stats: data.stats, trust: data.trust }
        : undefined,
  }
}

export type ApiFeedbackPage = {
  items: ApiFeedback[]
  total: number
  hasMore: boolean
}

export async function fetchApiFeedbacks(options: {
  page?: number
  limit?: number
  chainId?: number
  client?: string
  agent?: string
}): Promise<ApiFeedbackPage> {
  const data = await apiGet<{ items: ApiFeedback[]; total: number; hasMore: boolean }>('/api/feedbacks', {
    page: options.page ?? 0,
    limit: options.limit ?? 25,
    chainId: options.chainId,
    client: options.client,
    agent: options.agent,
  })
  return {
    ...data,
    items: data.items.map((row) => ({ ...row, client: row.client as Address })),
  }
}

export type ApiHealth = {
  ok: boolean
  uptime: number
  db: { agents: number; feedback: number; scores: number }
  chains: Array<{ chainId: number; name: string; agents: number; feedback: number; lastBlock: string | null; headBlock: string | null; lastError: string | null }>
}

export function fetchApiHealth(): Promise<ApiHealth> {
  return apiGet<ApiHealth>('/api/health')
}
