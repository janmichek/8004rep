import type { Address } from 'viem'
import type { ChainInfo } from '../chains'
import type {
  AgentDetail,
  AgentSummary,
  DataSource,
  Feedback,
  FeedbackEvent,
  FeedbackQuery,
  RegistrationFile,
  Service,
} from './types'

const QUERY_TIMEOUT_MS = 15000
/** Feedback rows loaded per agent (newest first). */
const FEEDBACK_LIMIT = 100
/** Feed rows per page (newest first). */
const FEEDBACK_FEED_LIMIT = 25

/** POSTs a GraphQL query; rejects on HTTP errors and on a body carrying `errors`. */
export async function gql<T>(url: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message?: string }[] } | null
  // Graph endpoints report failures in the body, sometimes with a non-200 status.
  if (body?.errors?.length) throw new Error(body.errors[0].message ?? 'Subgraph query failed')
  if (!res.ok || !body?.data) throw new Error(`Subgraph responded with HTTP ${res.status}`)
  return body.data
}

type FileRow = {
  name?: string | null
  description?: string | null
  image?: string | null
  active?: boolean | null
  x402Support?: boolean | null
  supportedTrusts?: string[] | null
  mcpEndpoint?: string | null
  mcpVersion?: string | null
  a2aEndpoint?: string | null
  a2aVersion?: string | null
  webEndpoint?: string | null
}

export type AgentRow = {
  agentId: string
  owner?: string | null
  agentURI?: string | null
  agentWallet?: string | null
  createdAt?: string | null
  totalFeedback?: string | null
  registrationFile?: FileRow | null
}

type FeedbackRow = {
  clientAddress: string
  feedbackIndex?: string | null
  value: string
  tag1?: string | null
  tag2?: string | null
  endpoint?: string | null
  feedbackURI?: string | null
  isRevoked: boolean
  createdAt?: string | null
  responses?: { responder: string; responseUri?: string | null; createdAt?: string | null }[] | null
}

export type FeedRow = FeedbackRow & {
  agent?: { agentId: string; registrationFile?: { name?: string | null } | null } | null
}

const AGENT_FIELDS = `
  agentId
  owner
  agentURI
  agentWallet
  createdAt
  totalFeedback
  registrationFile {
    name
    description
    image
    active
    x402Support
    supportedTrusts
    mcpEndpoint
    mcpVersion
    a2aEndpoint
    a2aVersion
    webEndpoint
  }
`

function mapFile(row: FileRow): RegistrationFile {
  const service = (name: string, endpoint?: string | null, version?: string | null): Service[] =>
    endpoint ? [{ name, endpoint, ...(version ? { version } : {}) }] : []
  return {
    name: row.name ?? undefined,
    description: row.description ?? undefined,
    image: row.image ?? undefined,
    active: row.active ?? undefined,
    x402Support: row.x402Support ?? undefined,
    services: [
      ...service('MCP', row.mcpEndpoint, row.mcpVersion),
      ...service('A2A', row.a2aEndpoint, row.a2aVersion),
      ...service('web', row.webEndpoint),
    ],
    supportedTrust: row.supportedTrusts ?? [],
    raw: row,
  }
}

export function mapAgent(chainId: number, row: AgentRow): AgentSummary {
  const agentURI = row.agentURI?.trim() || null
  return {
    chainId,
    tokenId: BigInt(row.agentId),
    owner: (row.owner as Address | null | undefined) ?? null,
    agentURI,
    ...(row.createdAt ? { createdAt: Number(row.createdAt) } : {}),
    ...(row.totalFeedback != null ? { totalFeedback: Number(row.totalFeedback) } : {}),
    // The indexer often has no parsed file; leave it for the caller to resolve from the URI.
    ...(row.registrationFile ? { file: mapFile(row.registrationFile) } : agentURI ? {} : { file: null }),
  }
}

export function mapFeedback(row: FeedbackRow): Feedback {
  return {
    client: row.clientAddress as Address,
    ...(row.feedbackIndex != null ? { index: Number(row.feedbackIndex) } : {}),
    value: Number(row.value),
    ...(row.tag1 ? { tag1: row.tag1 } : {}),
    ...(row.tag2 ? { tag2: row.tag2 } : {}),
    ...(row.endpoint ? { endpoint: row.endpoint } : {}),
    ...(row.feedbackURI ? { feedbackURI: row.feedbackURI } : {}),
    revoked: row.isRevoked,
    ...(row.createdAt ? { createdAt: Number(row.createdAt) } : {}),
    ...(row.responses?.length
      ? {
          responses: row.responses.map((r) => ({
            responder: r.responder as Address,
            ...(r.responseUri ? { uri: r.responseUri } : {}),
            ...(r.createdAt ? { createdAt: Number(r.createdAt) } : {}),
          })),
        }
      : {}),
  }
}

/** Feed row: feedback plus the agent it belongs to. */
export function mapFeedbackEvent(row: FeedRow): FeedbackEvent {
  return {
    ...mapFeedback(row),
    tokenId: BigInt(row.agent?.agentId ?? 0),
    ...(row.agent?.registrationFile?.name ? { agentName: row.agent.registrationFile.name } : {}),
  }
}

const FEEDBACK_FIELDS = `
  clientAddress
  feedbackIndex
  value
  tag1
  tag2
  endpoint
  feedbackURI
  isRevoked
  createdAt
  responses(orderBy: createdAt, orderDirection: asc) {
    responder
    responseUri
    createdAt
  }
`

export type SubgraphSource = DataSource & {
  /** Last indexed block; rejects when the subgraph cannot be queried. */
  meta(): Promise<{ block: number; timestamp?: number }>
}

export function createSubgraphSource(chain: ChainInfo & { subgraphUrl: string }): SubgraphSource {
  const url = chain.subgraphUrl

  return {
    kind: 'subgraph',
    supportsTextSearch: true,

    async meta() {
      const data = await gql<{ _meta: { block: { number: number; timestamp?: number | null } } }>(
        url,
        '{ _meta { block { number timestamp } } }',
      )
      const { number, timestamp } = data._meta.block
      return { block: number, ...(timestamp ? { timestamp } : {}) }
    },

    async listAgents({ page, pageSize, search, owner, sort, order }) {
      const query = search?.trim()
      const where = {
        ...(owner ? { owner: owner.toLowerCase() } : {}),
        ...(!query
          ? {}
          : /^\d+$/.test(query)
            ? { agentId: query }
            : { registrationFile_: { name_contains_nocase: query } }),
      }
      const orderBy = sort === 'tokenId' ? 'agentId' : 'createdAt'
      const orderDirection = order ?? 'desc'
      const data = await gql<{ agents: AgentRow[] }>(
        url,
        `query Agents($where: Agent_filter, $first: Int!, $skip: Int!, $orderBy: Agent_orderBy!, $orderDirection: OrderDirection!) {
          agents(where: $where, first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {${AGENT_FIELDS}}
        }`,
        // One extra row tells whether another page exists.
        { where, first: pageSize + 1, skip: page * pageSize, orderBy, orderDirection },
      )
      return {
        items: data.agents.slice(0, pageSize).map((row) => mapAgent(chain.chainId, row)),
        hasMore: data.agents.length > pageSize,
      }
    },

    async getAgent(tokenId): Promise<AgentDetail | null> {
      const id = `${chain.chainId}:${tokenId}`
      const data = await gql<{ agent: AgentRow | null; feedbacks: FeedbackRow[] }>(
        url,
        `query Agent($id: ID!, $where: Feedback_filter, $first: Int!) {
          agent(id: $id) {${AGENT_FIELDS}}
          feedbacks(where: $where, first: $first, orderBy: createdAt, orderDirection: desc) {${FEEDBACK_FIELDS}}
        }`,
        { id, where: { agent: id }, first: FEEDBACK_LIMIT },
      )
      if (!data.agent) return null
      const feedback = data.feedbacks.map(mapFeedback)
      const counted = feedback.filter((f) => !f.revoked)
      return {
        ...mapAgent(chain.chainId, data.agent),
        agentWallet: (data.agent.agentWallet as Address | null | undefined) ?? null,
        reputation: {
          count: counted.length,
          average: counted.length ? counted.reduce((sum, f) => sum + f.value, 0) / counted.length : 0,
        },
        feedback,
      }
    },

    async listFeedback({ client, agent, cursor }: FeedbackQuery) {
      const skip = cursor && /^\d+$/.test(cursor) ? Number(cursor) : 0
      const where: Record<string, unknown> = {
        ...(client ? { clientAddress: client.toLowerCase() } : {}),
        ...(agent !== undefined ? { agent: `${chain.chainId}:${agent}` } : {}),
      }
      const data = await gql<{ feedbacks: FeedRow[] }>(
        url,
        `query FeedbackFeed($where: Feedback_filter, $first: Int!, $skip: Int!) {
          feedbacks(where: $where, first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {${FEEDBACK_FIELDS}
            agent {
              agentId
              registrationFile {
                name
              }
            }
          }
        }`,
        { where, first: FEEDBACK_FEED_LIMIT + 1, skip },
      )
      return {
        items: data.feedbacks.slice(0, FEEDBACK_FEED_LIMIT).map(mapFeedbackEvent),
        ...(data.feedbacks.length > FEEDBACK_FEED_LIMIT ? { cursor: String(skip + FEEDBACK_FEED_LIMIT) } : {}),
      }
    },
  }
}
