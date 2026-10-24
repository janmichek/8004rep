import type { Address, Hex } from 'viem'

export type Service = { name: string; endpoint: string; version?: string }

/** Normalized ERC-8004 registration file (the JSON behind an agent's URI). */
export type RegistrationFile = {
  name?: string
  description?: string
  image?: string
  active?: boolean
  x402Support?: boolean
  services: Service[]
  supportedTrust: string[]
  /** The source JSON, for the raw view. */
  raw: unknown
}

export type AgentSummary = {
  chainId: number
  tokenId: bigint
  owner: Address | null
  agentURI: string | null
  /** Unix seconds; only indexed sources know it. */
  createdAt?: number
  /** Only indexed sources know it. */
  totalFeedback?: number
  /** undefined = not resolved yet (resolve `agentURI`), null = nothing to resolve. */
  file?: RegistrationFile | null
}

export type Feedback = {
  client: Address
  /** Feedback index; (client, index) identifies a row per agent. */
  index?: number
  value: number
  tag1?: string
  tag2?: string
  endpoint?: string
  revoked: boolean
  /** Unix seconds; only indexed sources know it. */
  createdAt?: number
  /** Where the comment lives; resolved lazily by the UI. */
  feedbackURI?: string
  /** Transaction that left the feedback; log scan only. */
  txHash?: Hex
  /** `appendResponse` entries on this row (agent replies, refunds, spam flags), oldest first. */
  responses?: FeedbackResponse[]
}

/** One `ResponseAppended` on a feedback row. Anyone may respond. */
export type FeedbackResponse = {
  responder: Address
  uri?: string
  /** Unix seconds, when known. */
  createdAt?: number
  txHash?: Hex
}

/** One row of a cross-agent feedback feed. */
export type FeedbackEvent = Feedback & { tokenId: bigint; agentName?: string }

export type FeedbackQuery = { client?: Address; agent?: bigint; cursor?: string }

export type FeedbackPage = {
  /** Newest first. */
  items: FeedbackEvent[]
  /** Opaque; absent = nothing older. */
  cursor?: string
  /** Unix seconds the scan reached; log scan only. */
  since?: number
}

export type ReputationSummary = {
  count: number
  average: number
  /** True when the client list was capped before averaging. */
  capped?: boolean
}

export type AgentDetail = AgentSummary & {
  agentWallet: Address | null
  reputation: ReputationSummary | null
  feedback: Feedback[]
  /** Unix seconds the log scan reached; dates exist only for newer feedback. */
  feedbackSince?: number
}

export type Page<T> = { items: T[]; total?: number; hasMore: boolean }

export type ListOptions = {
  page: number
  pageSize: number
  search?: string
  /** Only agents this address currently owns. */
  owner?: Address
  /** Sort field; omitted keeps the source default (newest first). */
  sort?: 'createdAt' | 'tokenId'
  order?: 'asc' | 'desc'
}

export interface DataSource {
  kind: 'subgraph' | 'rpc'
  /** False when `search` only matches token IDs. */
  supportsTextSearch: boolean
  /** Newest agents first unless `sort` is given; `page` is zero-based. */
  listAgents(options: ListOptions): Promise<Page<AgentSummary>>
  /** Null when the token does not exist. */
  getAgent(tokenId: bigint): Promise<AgentDetail | null>
  /** Cross-agent feed, newest first; `cursor` pages append-style. */
  listFeedback(query: FeedbackQuery): Promise<FeedbackPage>
}
