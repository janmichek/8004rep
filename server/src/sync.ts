import { createHash } from 'node:crypto'
import { createPublicClient, fallback, http, parseAbiItem, zeroAddress, type Address, type Hex, type PublicClient } from 'viem'
import { feedbackRevokedEvent, identityAbi, newFeedbackEvent, reputationAbi, responseAppendedEvent } from '../../src/abi'
import type { ChainInfo } from '../../src/chains'
import { zipFeedback, createRpcSource, isRevert } from '../../src/data/rpc'
import type { RegistrationFile, Service } from '../../src/data/types'
import { enabledChains, type ServerChain } from './chains'
import { all, get, getSync, run, touchSync, transaction } from './db'
import { redactError } from './redact'

const QUERY_TIMEOUT_MS = 20_000
const GRAPH_PAGE = 1_000
/** Log windows read per tail pass; the next pass continues where this one stops. */
const TAIL_CHUNKS = 4
/** Blocks left unindexed so a shallow reorg never enters the log tail. */
const CONFIRMATIONS = 64n
/** Blocks replayed when the saved block hash no longer matches the chain. */
const REORG_REWIND = 64n
/** Recent agents re-read by the periodic RPC refresh. */
const RPC_REFRESH_AGENTS = 100

async function gql<T>(url: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  const body = (await res.json().catch(() => null)) as { data?: T; errors?: { message?: string }[] } | null
  if (body?.errors?.length) throw new Error(body.errors[0]?.message ?? 'Subgraph query failed')
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

type SubgraphAgent = {
  agentId: string
  owner?: string | null
  agentURI?: string | null
  agentWallet?: string | null
  createdAt?: string | null
  totalFeedback?: string | null
  registrationFile?: FileRow | null
}

type SubgraphFeedback = {
  id?: string | null
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
  agent?: { agentId: string; owner?: string | null } | null
}

function mapFile(row: FileRow | null | undefined): RegistrationFile | null {
  if (!row) return null
  const service = (name: string, endpoint?: string | null, version?: string | null): Service[] =>
    endpoint ? [{ name, endpoint, ...(version ? { version } : {}) }] : []
  return {
    ...(row.name ? { name: row.name } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.image ? { image: row.image } : {}),
    ...(row.active !== null && row.active !== undefined ? { active: row.active } : {}),
    ...(row.x402Support !== null && row.x402Support !== undefined ? { x402Support: row.x402Support } : {}),
    services: [
      ...service('MCP', row.mcpEndpoint, row.mcpVersion),
      ...service('A2A', row.a2aEndpoint, row.a2aVersion),
      ...service('web', row.webEndpoint),
    ],
    supportedTrust: row.supportedTrusts ?? [],
    raw: row,
  }
}

export function upsertAgent(chainId: number, agent: {
  tokenId: string
  owner?: string | null
  /** Block that produced this owner snapshot; null for sources without one (subgraph). */
  ownerBlock?: string | null
  agentWallet?: string | null
  agentURI?: string | null
  createdAt?: number | null
  createdBlock?: string | null
  file?: RegistrationFile | null
  needsRecompute?: boolean
}): void {
  const now = Math.floor(Date.now() / 1000)
  const file = agent.file ?? null
  const owner = agent.owner?.toLowerCase() ?? null
  run(
    `INSERT INTO agents (chain_id, token_id, owner, owner_block, agent_wallet, agent_uri, created_at, created_block,
       name, description, image, active, x402, services_json, supported_trust_json, raw_file_json,
       needs_recompute, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, token_id) DO UPDATE SET
       owner = CASE
         WHEN excluded.owner IS NULL THEN agents.owner
         WHEN agents.owner IS NULL THEN excluded.owner
         WHEN excluded.owner_block IS NOT NULL
           AND (agents.owner_block IS NULL OR CAST(excluded.owner_block AS INTEGER) >= CAST(agents.owner_block AS INTEGER))
           THEN excluded.owner
         ELSE agents.owner END,
       owner_block = CASE
         WHEN excluded.owner IS NULL THEN agents.owner_block
         WHEN agents.owner IS NULL THEN excluded.owner_block
         WHEN excluded.owner_block IS NOT NULL
           AND (agents.owner_block IS NULL OR CAST(excluded.owner_block AS INTEGER) >= CAST(agents.owner_block AS INTEGER))
           THEN excluded.owner_block
         ELSE agents.owner_block END,
       agent_wallet = COALESCE(excluded.agent_wallet, agents.agent_wallet),
       agent_uri = COALESCE(excluded.agent_uri, agents.agent_uri),
       created_at = COALESCE(excluded.created_at, agents.created_at),
       created_block = COALESCE(excluded.created_block, agents.created_block),
       name = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.name ELSE COALESCE(agents.name, excluded.name) END,
       description = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.description ELSE COALESCE(agents.description, excluded.description) END,
       image = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.image ELSE COALESCE(agents.image, excluded.image) END,
       active = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.active ELSE COALESCE(agents.active, excluded.active) END,
       x402 = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.x402 ELSE COALESCE(agents.x402, excluded.x402) END,
       services_json = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.services_json ELSE COALESCE(agents.services_json, excluded.services_json) END,
       supported_trust_json = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.supported_trust_json ELSE COALESCE(agents.supported_trust_json, excluded.supported_trust_json) END,
       raw_file_json = CASE WHEN (excluded.raw_file_json IS NOT NULL OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri))
         THEN excluded.raw_file_json ELSE COALESCE(agents.raw_file_json, excluded.raw_file_json) END,
       file_fetched_at = CASE WHEN excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri
         THEN NULL ELSE agents.file_fetched_at END,
       file_error = CASE WHEN excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri
         THEN NULL ELSE agents.file_error END,
       file_next_try_at = CASE WHEN excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri
         THEN NULL ELSE agents.file_next_try_at END,
       file_attempts = CASE WHEN excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri
         THEN 0 ELSE agents.file_attempts END,
       needs_recompute = MAX(agents.needs_recompute, excluded.needs_recompute,
         CASE WHEN (
           excluded.owner IS NOT NULL AND excluded.owner IS NOT agents.owner AND (
             agents.owner IS NULL
             OR (excluded.owner_block IS NOT NULL
               AND (agents.owner_block IS NULL OR CAST(excluded.owner_block AS INTEGER) >= CAST(agents.owner_block AS INTEGER)))
           )
         )
           OR (excluded.agent_wallet IS NOT NULL AND excluded.agent_wallet IS NOT agents.agent_wallet)
           OR (excluded.agent_uri IS NOT NULL AND excluded.agent_uri IS NOT agents.agent_uri)
           OR (excluded.raw_file_json IS NOT NULL AND excluded.raw_file_json IS NOT agents.raw_file_json)
           OR (excluded.services_json IS NOT NULL AND excluded.services_json IS NOT agents.services_json)
           OR (excluded.name IS NOT NULL AND excluded.name IS NOT agents.name)
           THEN 1 ELSE 0 END),
       updated_at = excluded.updated_at`,
    chainId,
    agent.tokenId,
    owner,
    agent.ownerBlock ?? null,
    agent.agentWallet ?? null,
    agent.agentURI ?? null,
    agent.createdAt ?? null,
    agent.createdBlock ?? null,
    file?.name ?? null,
    file?.description ?? null,
    file?.image ?? null,
    file?.active === undefined ? null : file.active ? 1 : 0,
    file?.x402Support === undefined ? null : file.x402Support ? 1 : 0,
    file ? JSON.stringify(file.services) : null,
    file ? JSON.stringify(file.supportedTrust) : null,
    file ? JSON.stringify(file.raw) : null,
    agent.needsRecompute ? 1 : 0,
    now,
  )
}

export function upsertFeedback(chainId: number, row: {
  tokenId: string
  client: string
  index: number
  value: number
  valueRaw?: string | null
  valueDecimals?: number | null
  tag1?: string | null
  tag2?: string | null
  endpoint?: string | null
  feedbackURI?: string | null
  feedbackHash?: string | null
  revoked: boolean
  blockNumber?: string | null
  logIndex?: number | null
  txHash?: string | null
  createdAt?: number | null
}): void {
  const client = row.client.toLowerCase()
  const existing = get<{
    value: number
    tag1: string | null
    tag2: string | null
    endpoint: string | null
    feedback_uri: string | null
    revoked: number
    created_at: number | null
  }>(
    `SELECT value, tag1, tag2, endpoint, feedback_uri, revoked, created_at FROM feedback
     WHERE chain_id = ? AND token_id = ? AND client = ? AND feedback_index = ?`,
    chainId,
    row.tokenId,
    client,
    row.index,
  )
  const changed =
    !existing ||
    existing.value !== row.value ||
    (row.tag1 != null && existing.tag1 !== row.tag1) ||
    (row.tag2 != null && existing.tag2 !== row.tag2) ||
    (row.endpoint != null && existing.endpoint !== row.endpoint) ||
    (row.feedbackURI != null && existing.feedback_uri !== row.feedbackURI) ||
    (row.createdAt != null && existing.created_at !== row.createdAt) ||
    (row.revoked && existing.revoked !== 1)
  run(
    `INSERT INTO feedback (chain_id, token_id, client, feedback_index, value_raw, value_decimals, value,
       tag1, tag2, endpoint, feedback_uri, feedback_hash, revoked, block_number, log_index, tx_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, token_id, client, feedback_index) DO UPDATE SET
       value = excluded.value,
       value_raw = COALESCE(excluded.value_raw, feedback.value_raw),
       value_decimals = COALESCE(excluded.value_decimals, feedback.value_decimals),
       tag1 = COALESCE(excluded.tag1, feedback.tag1),
       tag2 = COALESCE(excluded.tag2, feedback.tag2),
       endpoint = COALESCE(excluded.endpoint, feedback.endpoint),
       feedback_uri = COALESCE(excluded.feedback_uri, feedback.feedback_uri),
       feedback_hash = COALESCE(excluded.feedback_hash, feedback.feedback_hash),
       revoked = MAX(feedback.revoked, excluded.revoked),
       block_number = COALESCE(feedback.block_number, excluded.block_number),
       log_index = COALESCE(feedback.log_index, excluded.log_index),
       tx_hash = COALESCE(feedback.tx_hash, excluded.tx_hash),
       created_at = COALESCE(feedback.created_at, excluded.created_at)`,
    chainId,
    row.tokenId,
    client,
    row.index,
    row.valueRaw ?? null,
    row.valueDecimals ?? null,
    row.value,
    row.tag1 ?? null,
    row.tag2 ?? null,
    row.endpoint ?? null,
    row.feedbackURI ?? null,
    row.feedbackHash ?? null,
    row.revoked ? 1 : 0,
    row.blockNumber ?? null,
    row.logIndex ?? null,
    row.txHash ?? null,
    row.createdAt ?? null,
  )
  if (changed) markDirty(chainId, row.tokenId)
}

function ensureAgent(chainId: number, tokenId: string, owner?: string | null): void {
  upsertAgent(chainId, { tokenId, owner: owner ?? null })
}

function markDirty(chainId: number, tokenId: string): void {
  run('UPDATE agents SET needs_recompute = 1 WHERE chain_id = ? AND token_id = ?', chainId, tokenId)
}

/** Idempotent response insert; subgraph rows get a deterministic synthetic log key. */
function upsertResponse(
  chainId: number,
  row: {
    txHash: string
    logIndex: number
    tokenId: string
    client: string
    index: number
    responder: string
    responseUri?: string | null
    blockNumber?: string | null
    createdAt?: number | null
  },
): void {
  const existing = get<{ response_uri: string | null; created_at: number | null }>(
    'SELECT response_uri, created_at FROM feedback_responses WHERE chain_id = ? AND tx_hash = ? AND log_index = ?',
    chainId,
    row.txHash,
    row.logIndex,
  )
  const changed = !existing || (row.responseUri != null && existing.response_uri !== row.responseUri) || (row.createdAt != null && existing.created_at !== row.createdAt)
  run(
    `INSERT INTO feedback_responses (chain_id, tx_hash, log_index, token_id, client, feedback_index, responder, response_uri, block_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, tx_hash, log_index) DO UPDATE SET
       token_id = excluded.token_id,
       client = excluded.client,
       feedback_index = excluded.feedback_index,
       responder = excluded.responder,
       response_uri = COALESCE(excluded.response_uri, feedback_responses.response_uri),
       created_at = COALESCE(feedback_responses.created_at, excluded.created_at)`,
    chainId,
    row.txHash,
    row.logIndex,
    row.tokenId,
    row.client.toLowerCase(),
    row.index,
    row.responder,
    row.responseUri ?? null,
    row.blockNumber ?? null,
    row.createdAt ?? null,
  )
  if (changed) markDirty(chainId, row.tokenId)
}

function subgraphResponseKey(feedback: {
  chainId: number
  tokenId: string
  client: string
  index: number
  responder: string
  uri?: string | null
  createdAt?: number | null
}): string {
  return `subgraph:${createHash('sha256')
    .update(`${feedback.chainId}:${feedback.tokenId}:${feedback.client}:${feedback.index}:${feedback.responder}:${feedback.uri ?? ''}:${feedback.createdAt ?? ''}`)
    .digest('hex')}`
}

export async function syncSubgraphAgents(chain: ServerChain): Promise<void> {
  if (!chain.subgraphUrl) return
  const url = chain.subgraphUrl
  // Agent IDs are unique and sequential, so a keyset cursor is stable even
  // while the registry is growing.
  let cursor = (2n ** 256n - 1n).toString()
  let stored = 0
  while (stored < chain.agentLimit) {
    const first = Math.min(GRAPH_PAGE, chain.agentLimit - stored)
    const data = await gql<{ agents: SubgraphAgent[]; _meta?: { block: { number: number } } }>(
      url,
      `query Agents($first: Int!, $cursor: BigInt!) {
        _meta { block { number } }
        agents(first: $first, where: { agentId_lt: $cursor }, orderBy: agentId, orderDirection: desc) {
          agentId owner agentURI agentWallet createdAt totalFeedback
          registrationFile {
            name description image active x402Support supportedTrusts
            mcpEndpoint mcpVersion a2aEndpoint a2aVersion webEndpoint
          }
        }
      }`,
      { first, cursor },
    )
    const rows = data.agents ?? []
    if (!rows.length) break
    const block = data._meta?.block.number?.toString() ?? null
    transaction(() => {
      for (const row of rows) {
        upsertAgent(chain.chainId, {
          tokenId: row.agentId,
          owner: row.owner ?? null,
          ownerBlock: block,
          agentWallet: row.agentWallet ?? null,
          agentURI: row.agentURI ?? null,
          createdAt: row.createdAt ? Number(row.createdAt) : null,
          file: mapFile(row.registrationFile),
          needsRecompute: false,
        })
      }
    })
    if (data._meta?.block.number) {
      touchSync(chain.chainId, 'agents', BigInt(data._meta.block.number), BigInt(data._meta.block.number), null)
    }
    stored += rows.length
    cursor = rows[rows.length - 1]!.agentId
    if (rows.length < first) break
    console.log(`[sync] ${chain.name} agents ${Math.min(stored, chain.agentLimit)}/${chain.agentLimit}`)
  }
}

function ingestSubgraphFeedback(chain: ServerChain, rows: SubgraphFeedback[]): void {
  transaction(() => {
    for (const row of rows) {
      const tokenId = row.agent?.agentId
      if (!tokenId) continue
      ensureAgent(chain.chainId, tokenId, row.agent?.owner ?? null)
      const index = Number(row.feedbackIndex ?? 0)
      upsertFeedback(chain.chainId, {
        tokenId,
        client: row.clientAddress,
        index,
        value: Number(row.value),
        tag1: row.tag1 ?? null,
        tag2: row.tag2 ?? null,
        endpoint: row.endpoint ?? null,
        feedbackURI: row.feedbackURI ?? null,
        revoked: row.isRevoked,
        createdAt: row.createdAt ? Number(row.createdAt) : null,
      })
      for (const response of row.responses ?? []) {
        const createdAt = response.createdAt ? Number(response.createdAt) : null
        const client = row.clientAddress.toLowerCase()
        upsertResponse(chain.chainId, {
          txHash: subgraphResponseKey({
            chainId: chain.chainId,
            tokenId,
            client,
            index,
            responder: response.responder.toLowerCase(),
            uri: response.responseUri ?? null,
            createdAt,
          }),
          logIndex: 0,
          tokenId,
          client,
          index,
          responder: response.responder,
          responseUri: response.responseUri ?? null,
          createdAt,
        })
      }
    }
  })
}

export async function syncSubgraphFeedback(chain: ServerChain): Promise<void> {
  if (!chain.subgraphUrl) return
  const url = chain.subgraphUrl
  // Freeze the window so rows inserted during pagination cannot shift a page.
  const asOf = Math.floor(Date.now() / 1000)
  let cursor = asOf
  let stored = 0
  while (stored < chain.feedbackLimit) {
    const first = Math.min(GRAPH_PAGE, chain.feedbackLimit - stored)
    const data = await gql<{ feedbacks: SubgraphFeedback[] }>(
      url,
      `query Feedback($first: Int!, $cursor: BigInt!) {
        feedbacks(first: $first, where: { createdAt_lte: $cursor }, orderBy: createdAt, orderDirection: desc) {
          id clientAddress feedbackIndex value tag1 tag2 endpoint feedbackURI isRevoked createdAt
          responses(orderBy: createdAt, orderDirection: asc) { responder responseUri createdAt }
          agent { agentId owner }
        }
      }`,
      { first, cursor: cursor.toString() },
    )
    const rows = data.feedbacks ?? []
    if (!rows.length) break
    ingestSubgraphFeedback(chain, rows)
    stored += rows.length
    if (stored >= chain.feedbackLimit || rows.length < first) break

    // A page can split rows that share a timestamp. Finish that whole bucket
    // before moving the timestamp cursor; otherwise the tie is skipped.
    const boundary = Number(rows[rows.length - 1]!.createdAt ?? 0)
    if (!Number.isFinite(boundary) || boundary <= 0) break
    for (let skip = 0; ; skip += GRAPH_PAGE) {
      const bucket = await gql<{ feedbacks: SubgraphFeedback[] }>(
        url,
        `query FeedbackAt($first: Int!, $skip: Int!, $at: BigInt!) {
          feedbacks(first: $first, skip: $skip, where: { createdAt: $at }, orderBy: id, orderDirection: asc) {
            id clientAddress feedbackIndex value tag1 tag2 endpoint feedbackURI isRevoked createdAt
            responses(orderBy: createdAt, orderDirection: asc) { responder responseUri createdAt }
            agent { agentId owner }
          }
        }`,
        { first: GRAPH_PAGE, skip, at: boundary.toString() },
      )
      const tied = bucket.feedbacks ?? []
      ingestSubgraphFeedback(chain, tied)
      if (tied.length < GRAPH_PAGE) break
    }
    cursor = boundary - 1
    if (cursor <= 0) break
    console.log(`[sync] ${chain.name} feedback ${Math.min(stored, chain.feedbackLimit)}/${chain.feedbackLimit}`)
  }
}

function rpcClient(chain: ServerChain): PublicClient {
  const transports = [http(chain.rpcUrl), ...(chain.fallbackRpcUrl ? [http(chain.fallbackRpcUrl)] : [])]
  return createPublicClient({ chain: chain.viemChain, transport: transports.length > 1 ? fallback(transports) : transports[0]! })
}

async function pool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const current = next++
      results[current] = await tasks[current]!()
    }
  })
  await Promise.all(workers)
  return results
}

/** Mantle has no subgraph: enumerate the registry and read feedback directly. */
export async function syncRpcChain(chain: ServerChain): Promise<void> {
  const client = rpcClient(chain)
  const source = createRpcSource(chain as unknown as ChainInfo, client)
  const items: Array<{ tokenId: bigint; owner: string | null; agentURI: string | null; createdAt?: number }> = []
  // Small pages keep public RPCs from treating one refresh as a burst.
  for (let page = 0; items.length < chain.agentLimit; page++) {
    const result = await source.listAgents({ page, pageSize: 25 })
    items.push(...result.items)
    if (!result.hasMore) break
  }
  transaction(() => {
    for (const agent of items) {
      upsertAgent(chain.chainId, {
        tokenId: agent.tokenId.toString(),
        owner: agent.owner,
        agentURI: agent.agentURI,
        createdAt: agent.createdAt ?? null,
        needsRecompute: false,
      })
    }
  })
  console.log(`[sync] ${chain.name} agents ${items.length}`)
  const errors = await pool(
    items.map((agent) => async () => {
      try {
        await syncRpcAgent(chain, client, agent.tokenId)
        return null
      } catch (error) {
        return redactError(error)
      }
    }),
    4,
  )
  const failed = errors.filter((message): message is string => message !== null)
  const head = await client.getBlockNumber()
  touchSync(
    chain.chainId,
    'rpc',
    head,
    head,
    failed.length ? `${failed.length} of ${items.length} agents failed: ${failed[0]}` : null,
  )
  await backfillRpcTimestamps(chain, client).catch((error) => {
    const message = redactError(error)
    touchSync(chain.chainId, 'rpc', undefined, undefined, `timestamp backfill: ${message}`)
    console.error(`[sync] ${chain.name} timestamp backfill: ${message}`)
  })
}

/** Reads one agent's wallet and feedback, leaving it dirty only when its inputs change. */
async function syncRpcAgent(chain: ServerChain, client: PublicClient, tokenId: bigint): Promise<void> {
  const token = tokenId.toString()
  const identity = { address: chain.identity, abi: identityAbi } as const
  const reputation = { address: chain.reputation, abi: reputationAbi } as const
  try {
    let readFailed = false
    const track = (error: unknown) => {
      if (!isRevert(error)) readFailed = true
    }
    const [wallet, clients] = await Promise.all([
      client.readContract({ ...identity, functionName: 'getAgentWallet', args: [tokenId] }).catch((error) => {
        track(error)
        return null
      }),
      client.readContract({ ...reputation, functionName: 'getClients', args: [tokenId] }).catch((error) => {
        track(error)
        return [] as Address[]
      }),
    ])
    if (wallet && wallet !== zeroAddress) {
      run(
        `UPDATE agents SET agent_wallet = ?, needs_recompute = CASE WHEN agent_wallet IS NOT ? THEN 1 ELSE needs_recompute END
         WHERE chain_id = ? AND token_id = ?`,
        wallet,
        wallet,
        chain.chainId,
        token,
      )
    }
    if (clients.length) {
      const allFeedback = await client
        .readContract({ ...reputation, functionName: 'readAllFeedback', args: [tokenId, clients, '', '', true] })
        .catch((error) => {
          track(error)
          return null
        })
      if (allFeedback) {
        const rows = zipFeedback(allFeedback)
        transaction(() => {
          for (const row of rows) {
            upsertFeedback(chain.chainId, {
              tokenId: token,
              client: row.client,
              index: row.index ?? 0,
              value: row.value,
              tag1: row.tag1 ?? null,
              tag2: row.tag2 ?? null,
              revoked: row.revoked,
            })
          }
        })
      }
    }
    if (readFailed) throw new Error('RPC read failed')
    run(
      'UPDATE agents SET rpc_error = NULL, rpc_checked_at = ? WHERE chain_id = ? AND token_id = ?',
      Math.floor(Date.now() / 1000),
      chain.chainId,
      token,
    )
  } catch (error) {
    const message = redactError(error)
    run(
      'UPDATE agents SET rpc_error = ?, rpc_checked_at = ? WHERE chain_id = ? AND token_id = ?',
      message,
      Math.floor(Date.now() / 1000),
      chain.chainId,
      token,
    )
    throw error
  }
}

/**
 * Periodic RPC refresh: newest agents plus any agent whose last read failed.
 * The full registry walk is reserved for bootstrap.
 */
export async function refreshRpcChain(chain: ServerChain): Promise<void> {
  const client = rpcClient(chain)
  const rows = all<{ token_id: string }>(
    `SELECT token_id FROM agents WHERE chain_id = ?
     ORDER BY (rpc_error IS NOT NULL) DESC, CAST(token_id AS INTEGER) DESC LIMIT ?`,
    chain.chainId,
    RPC_REFRESH_AGENTS,
  )
  const errors = await pool(
    rows.map((row) => async () => {
      try {
        await syncRpcAgent(chain, client, BigInt(row.token_id))
        return null
      } catch (error) {
        return redactError(error)
      }
    }),
    4,
  )
  const failed = errors.filter((message): message is string => message !== null)
  const head = await client.getBlockNumber()
  touchSync(
    chain.chainId,
    'rpc',
    head,
    head,
    failed.length ? `${failed.length} of ${rows.length} recent agents failed: ${failed[0]}` : null,
  )
  // New RPC feedback arrives without dates; recover them from the logs before
  // the next feedback-limit prune or feed ordering.
  await backfillRpcTimestamps(chain, client).catch((error) => {
    const message = redactError(error)
    touchSync(chain.chainId, 'rpc', undefined, undefined, `timestamp backfill: ${message}`)
    console.error(`[refresh] ${chain.name} timestamp backfill: ${message}`)
  })
}

/**
 * RPC rows have no block number, so their timestamps are recovered from the
 * `NewFeedback` logs. Scan a bounded recent range; subgraph chains already
 * carry dates and skip this.
 */
async function backfillRpcTimestamps(chain: ServerChain, client: PublicClient): Promise<void> {
  if (chain.subgraphUrl) return
  const missing = get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM feedback WHERE chain_id = ? AND created_at IS NULL',
    chain.chainId,
  )?.n ?? 0
  if (!missing) return
  const head = await client.getBlockNumber()
  const floor = chain.reputationFromBlock ?? 0n
  const span = BigInt(process.env.RPC_TIMESTAMP_BACKFILL_BLOCKS ?? 250_000)
  const from = head > span + floor ? head - span : floor
  const timestamps = new Map<string, number>()
  for (let cursor = from; cursor <= head; cursor += chain.logRange) {
    const to = cursor + chain.logRange - 1n > head ? head : cursor + chain.logRange - 1n
    const logs = await client.getLogs({ address: chain.reputation, event: newFeedbackEvent, fromBlock: cursor, toBlock: to })
    const times = await blockTimes(client, logs as unknown as Log[])
    for (const log of logs as unknown as Log[]) {
      const args = log.args as { agentId: bigint; clientAddress: Address; feedbackIndex: bigint }
      const at = times.get(log.blockNumber)
      if (at) timestamps.set(`${args.agentId}:${args.clientAddress.toLowerCase()}:${Number(args.feedbackIndex)}`, at)
    }
  }
  if (!timestamps.size) return
  transaction(() => {
    const tokens = new Set<string>()
    for (const [key, at] of timestamps) {
      const [tokenId, client, index] = key.split(':')
      tokens.add(tokenId!)
      run(
        'UPDATE feedback SET created_at = ? WHERE chain_id = ? AND token_id = ? AND client = ? AND feedback_index = ? AND created_at IS NULL',
        at,
        chain.chainId,
        tokenId,
        client,
        Number(index),
      )
    }
    for (const tokenId of tokens) markDirty(chain.chainId, tokenId)
  })
}

type Log = {
  args: Record<string, unknown>
  blockNumber: bigint
  logIndex: number
  transactionHash: Hex
}

async function blockTimes(client: PublicClient, logs: Log[]): Promise<Map<bigint, number>> {
  const unique = [...new Set(logs.map((log) => log.blockNumber))]
  const entries = await pool(
    unique.map((blockNumber) => async () => {
      const block = await client.getBlock({ blockNumber }).catch(() => null)
      return [blockNumber, block ? Number(block.timestamp) : 0] as const
    }),
    8,
  )
  return new Map(entries)
}

/** Latest page only; the periodic refresh keeps the index close to the head. */
export async function refreshRecent(chain: ServerChain): Promise<void> {
  if (!chain.subgraphUrl) return
  const url = chain.subgraphUrl
  const [agents, feedback] = await Promise.all([
    gql<{ agents: SubgraphAgent[]; _meta?: { block: { number: number } } }>(
      url,
      `query RecentAgents {
        _meta { block { number } }
        agents(first: 1000, orderBy: createdAt, orderDirection: desc) {
          agentId owner agentURI agentWallet createdAt
          registrationFile { name description image active x402Support supportedTrusts mcpEndpoint mcpVersion a2aEndpoint a2aVersion webEndpoint }
        }
      }`,
    ),
    gql<{ feedbacks: SubgraphFeedback[] }>(
      url,
      `query RecentFeedback {
        feedbacks(first: 1000, orderBy: createdAt, orderDirection: desc) {
          id clientAddress feedbackIndex value tag1 tag2 endpoint feedbackURI isRevoked createdAt
          responses(orderBy: createdAt, orderDirection: asc) { responder responseUri createdAt }
          agent { agentId owner }
        }
      }`,
    ),
  ])
  const block = agents._meta?.block.number?.toString() ?? null
  transaction(() => {
    for (const row of agents.agents ?? []) {
      upsertAgent(chain.chainId, {
        tokenId: row.agentId,
        owner: row.owner ?? null,
        ownerBlock: block,
        agentWallet: row.agentWallet ?? null,
        agentURI: row.agentURI ?? null,
        createdAt: row.createdAt ? Number(row.createdAt) : null,
        file: mapFile(row.registrationFile),
        needsRecompute: false,
      })
    }
  })
  ingestSubgraphFeedback(chain, feedback.feedbacks ?? [])
}

export async function refreshAll(): Promise<void> {
  await Promise.all(
    enabledChains().map(async (chain) => {
      try {
        if (chain.subgraphUrl) await refreshRecent(chain)
        else await refreshRpcChain(chain)
        pruneChain(chain)
        touchSync(chain.chainId, 'refresh', undefined, undefined, null)
      } catch (error) {
        const message = redactError(error)
        touchSync(chain.chainId, 'refresh', undefined, undefined, message)
        console.error(`[refresh] ${chain.name}: ${message}`)
      }
    }),
  )
}

/** One bounded step of the reputation/identity log tail. */
/** Rolls back every row produced above `toBlock` after a reorg. */
function rewindLogs(chainId: number, toBlock: bigint): void {
  const block = toBlock.toString()
  transaction(() => {
    const affected = all<{ token_id: string }>(
      `SELECT DISTINCT token_id FROM agent_transfers
       WHERE chain_id = ? AND CAST(block_number AS INTEGER) > CAST(? AS INTEGER)`,
      chainId,
      block,
    )
    run(
      'DELETE FROM feedback WHERE chain_id = ? AND block_number IS NOT NULL AND CAST(block_number AS INTEGER) > CAST(? AS INTEGER)',
      chainId,
      block,
    )
    run(
      'UPDATE feedback SET revoked = 0, revoked_block = NULL, revoked_tx_hash = NULL WHERE chain_id = ? AND revoked_block IS NOT NULL AND CAST(revoked_block AS INTEGER) > CAST(? AS INTEGER)',
      chainId,
      block,
    )
    run(
      'DELETE FROM feedback_responses WHERE chain_id = ? AND block_number IS NOT NULL AND CAST(block_number AS INTEGER) > CAST(? AS INTEGER)',
      chainId,
      block,
    )
    run(
      'DELETE FROM agent_transfers WHERE chain_id = ? AND CAST(block_number AS INTEGER) > CAST(? AS INTEGER)',
      chainId,
      block,
    )
    // Restore the owner left by the newest surviving transfer for each agent
    // whose orphaned transfer was just removed.
    for (const token of affected) {
      const last = get<{ to_addr: string | null; block_number: string }>(
        `SELECT to_addr, block_number FROM agent_transfers WHERE chain_id = ? AND token_id = ?
         ORDER BY CAST(block_number AS INTEGER) DESC, log_index DESC LIMIT 1`,
        chainId,
        token.token_id,
      )
      run(
        'UPDATE agents SET owner = ?, owner_block = ?, needs_recompute = 1 WHERE chain_id = ? AND token_id = ?',
        last?.to_addr?.toLowerCase() ?? null,
        last?.block_number ?? null,
        chainId,
        token.token_id,
      )
    }
    run('UPDATE agents SET needs_recompute = 1 WHERE chain_id = ?', chainId)
  })
}

export async function tailChain(chain: ServerChain): Promise<void> {
  const client = rpcClient(chain)
  const head = await client.getBlockNumber()
  const state = getSync(chain.chainId, 'logs')
  let saved = state ? BigInt(state.last_block) : 0n
  let savedHash = state?.last_hash ?? null
  let rewound = false
  // Only index blocks that are already confirmed; a shallow reorg then never
  // enters the tail at all.
  const confirmedHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n
  // With no saved cursor, start a bounded window of confirmed blocks instead
  // of scanning from genesis or indexing a single block.
  const initialSpan = chain.logRange * BigInt(TAIL_CHUNKS)
  const initialFrom = confirmedHead > initialSpan ? confirmedHead - initialSpan : 0n

  // A saved hash that no longer matches means the chain reorged below the
  // cursor. Rewind a bounded window and replay it instead of keeping orphans.
  if (saved > 0n && savedHash) {
    const anchor = await client.getBlock({ blockNumber: saved })
    if (anchor.hash && anchor.hash.toLowerCase() !== savedHash.toLowerCase()) {
      const target = saved > REORG_REWIND ? saved - REORG_REWIND : 0n
      rewindLogs(chain.chainId, target)
      saved = target
      rewound = true
      savedHash = target > 0n ? ((await client.getBlock({ blockNumber: target })).hash ?? null) : null
      touchSync(chain.chainId, 'logs', saved, head, 'reorg detected; rewound the tail', savedHash)
      console.warn(`[tail] ${chain.name}: reorg detected, rewound to ${saved}`)
    }
  }

  // Never jump from a stale cursor: replay every skipped window so no
  // feedback, response or transfer log is lost.
  const from = saved > 0n ? saved + 1n : rewound ? 0n : initialFrom
  if (from > confirmedHead) {
    touchSync(chain.chainId, 'logs', saved > 0n ? saved : initialFrom, head, null, savedHash)
    return
  }
  let cursor = from
  for (let chunk = 0; chunk < TAIL_CHUNKS && cursor <= confirmedHead; chunk++) {
    const to = cursor + chain.logRange - 1n > confirmedHead ? confirmedHead : cursor + chain.logRange - 1n
    const [fresh, revoked, responses, transfers] = await Promise.all([
      client.getLogs({ address: chain.reputation, event: newFeedbackEvent, fromBlock: cursor, toBlock: to }),
      client.getLogs({ address: chain.reputation, event: feedbackRevokedEvent, fromBlock: cursor, toBlock: to }),
      client.getLogs({ address: chain.reputation, event: responseAppendedEvent, fromBlock: cursor, toBlock: to }),
      client.getLogs({
        address: chain.identity,
        event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'),
        fromBlock: cursor,
        toBlock: to,
      }),
    ])
    const allLogs = [...fresh, ...revoked, ...responses, ...transfers] as unknown as Log[]
    const times = await blockTimes(client, allLogs)
    const timeOf = (log: Log) => times.get(log.blockNumber) || null
    transaction(() => {
      for (const log of fresh as unknown as Log[]) {
        const args = log.args as {
          agentId: bigint
          clientAddress: Address
          feedbackIndex: bigint
          value: bigint
          valueDecimals: number
          tag1: string
          tag2: string
          endpoint: string
          feedbackURI: string
          feedbackHash: Hex
        }
        const tokenId = args.agentId.toString()
        ensureAgent(chain.chainId, tokenId, null)
        upsertFeedback(chain.chainId, {
          tokenId,
          client: args.clientAddress,
          index: Number(args.feedbackIndex),
          value: Number(args.value) / 10 ** Number(args.valueDecimals),
          valueRaw: args.value.toString(),
          valueDecimals: Number(args.valueDecimals),
          tag1: args.tag1 || null,
          tag2: args.tag2 || null,
          endpoint: args.endpoint || null,
          feedbackURI: args.feedbackURI || null,
          feedbackHash: args.feedbackHash || null,
          revoked: false,
          blockNumber: log.blockNumber.toString(),
          logIndex: log.logIndex,
          txHash: log.transactionHash,
          createdAt: timeOf(log),
        })
      }
      for (const log of revoked as unknown as Log[]) {
        const args = log.args as { agentId: bigint; clientAddress: Address; feedbackIndex: bigint }
        run(
          `UPDATE feedback SET revoked = 1, revoked_block = ?, revoked_tx_hash = ?
           WHERE chain_id = ? AND token_id = ? AND client = ? AND feedback_index = ?`,
          log.blockNumber.toString(),
          log.transactionHash,
          chain.chainId,
          args.agentId.toString(),
          args.clientAddress.toLowerCase(),
          Number(args.feedbackIndex),
        )
        run('UPDATE agents SET needs_recompute = 1 WHERE chain_id = ? AND token_id = ?', chain.chainId, args.agentId.toString())
      }
      for (const log of responses as unknown as Log[]) {
        const args = log.args as { agentId: bigint; clientAddress: Address; feedbackIndex: bigint; responder: Address; responseURI: string }
        upsertResponse(chain.chainId, {
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          tokenId: args.agentId.toString(),
          client: args.clientAddress,
          index: Number(args.feedbackIndex),
          responder: args.responder,
          responseUri: args.responseURI || null,
          blockNumber: log.blockNumber.toString(),
          createdAt: timeOf(log),
        })
      }
      for (const log of transfers as unknown as Log[]) {
        const args = log.args as { from: Address; to: Address; tokenId: bigint }
        const tokenId = args.tokenId.toString()
        run(
          `INSERT INTO agent_transfers (chain_id, tx_hash, log_index, token_id, from_addr, to_addr, block_number, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(chain_id, tx_hash, log_index) DO NOTHING`,
          chain.chainId,
          log.transactionHash,
          log.logIndex,
          tokenId,
          args.from,
          args.to,
          log.blockNumber.toString(),
          timeOf(log),
        )
        if (args.to.toLowerCase() !== zeroAddress) {
          upsertAgent(chain.chainId, {
            tokenId,
            owner: args.to,
            ownerBlock: log.blockNumber.toString(),
            createdAt: args.from.toLowerCase() === zeroAddress ? timeOf(log) : null,
            createdBlock: args.from.toLowerCase() === zeroAddress ? log.blockNumber.toString() : null,
            needsRecompute: false,
          })
        }
      }
    })
    const block = await client.getBlock({ blockNumber: to })
    touchSync(chain.chainId, 'logs', to, head, null, block.hash ?? null)
    cursor = to + 1n
  }
}

export async function bootstrapChain(chain: ServerChain): Promise<void> {
  try {
    if (chain.subgraphUrl) {
      await syncSubgraphAgents(chain)
      await syncSubgraphFeedback(chain)
    } else {
      await syncRpcChain(chain)
    }
    pruneChain(chain)
    touchSync(chain.chainId, 'bootstrap', BigInt(Math.floor(Date.now() / 1000)), undefined, null)
  } catch (error) {
    const message = redactError(error)
    touchSync(chain.chainId, 'bootstrap', undefined, undefined, message)
    console.error(`[sync] ${chain.name} bootstrap failed: ${message}`)
  }
}

let bootstrapping = false
export async function bootstrapAll(): Promise<void> {
  if (bootstrapping) return
  bootstrapping = true
  try {
    for (const chain of enabledChains()) await bootstrapChain(chain)
  } finally {
    bootstrapping = false
  }
}

let tailing = false
export async function tailAll(): Promise<void> {
  if (tailing) return
  tailing = true
  try {
    await Promise.all(
      enabledChains().map((chain) =>
        tailChain(chain)
          .then(() => pruneChain(chain))
          .catch((error) => {
            const message = redactError(error)
            touchSync(chain.chainId, 'logs', undefined, undefined, message)
            console.error(`[tail] ${chain.name}: ${message}`)
          }),
      ),
    )
  } finally {
    tailing = false
  }
}

/** Keeps the advertised coverage limits true as new rows arrive. */
export function pruneChain(chain: ServerChain): void {
  transaction(() => {
    // Keep the newest feedback, and mark agents whose row set shrinks dirty.
    const removed = all<{ token_id: string }>(
      `SELECT DISTINCT token_id FROM feedback WHERE chain_id = ? AND rowid NOT IN (
         SELECT rowid FROM feedback WHERE chain_id = ?
         ORDER BY COALESCE(created_at, 0) DESC, CAST(token_id AS INTEGER) DESC, feedback_index DESC LIMIT ?
       )`,
      chain.chainId,
      chain.chainId,
      chain.feedbackLimit,
    )
    for (const token of removed) markDirty(chain.chainId, token.token_id)
    run(
      `DELETE FROM feedback WHERE chain_id = ? AND rowid NOT IN (
         SELECT rowid FROM feedback WHERE chain_id = ?
         ORDER BY COALESCE(created_at, 0) DESC, CAST(token_id AS INTEGER) DESC, feedback_index DESC LIMIT ?
       )`,
      chain.chainId,
      chain.chainId,
      chain.feedbackLimit,
    )
    run(
      `DELETE FROM feedback_responses WHERE chain_id = ? AND NOT EXISTS (
         SELECT 1 FROM feedback f WHERE f.chain_id = feedback_responses.chain_id
           AND f.token_id = feedback_responses.token_id AND f.client = feedback_responses.client
           AND f.feedback_index = feedback_responses.feedback_index
       )`,
      chain.chainId,
    )
    // Keep the newest agents plus every agent still referenced by retained
    // feedback. Deleting the second group would empty the feedback table on a
    // chain where the newest agents and the newest feedback do not overlap.
    run(
      `DELETE FROM agents WHERE chain_id = ? AND rowid NOT IN (
         SELECT rowid FROM agents WHERE chain_id = ?
         ORDER BY COALESCE(created_at, 0) DESC, CAST(token_id AS INTEGER) DESC LIMIT ?
       ) AND token_id NOT IN (SELECT token_id FROM feedback WHERE chain_id = ?)`,
      chain.chainId,
      chain.chainId,
      chain.agentLimit,
      chain.chainId,
    )
    run(
      'DELETE FROM agent_transfers WHERE chain_id = ? AND token_id NOT IN (SELECT token_id FROM agents WHERE chain_id = ?)',
      chain.chainId,
      chain.chainId,
    )
    run(
      'DELETE FROM agent_scores WHERE chain_id = ? AND token_id NOT IN (SELECT token_id FROM agents WHERE chain_id = ?)',
      chain.chainId,
      chain.chainId,
    )
  })
}

/** Everything the UI needs to know about indexing coverage. */
export function coverage(): Array<Record<string, unknown>> {
  return enabledChains().map((chain) => {
    const agents = get<{ n: number }>('SELECT COUNT(*) AS n FROM agents WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const feedback = get<{ n: number }>('SELECT COUNT(*) AS n FROM feedback WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const sync = getSync(chain.chainId, 'logs')
    const bootstrap = getSync(chain.chainId, 'bootstrap')
    const refresh = getSync(chain.chainId, 'refresh')
    const rpc = getSync(chain.chainId, 'rpc')
    const bootstrapped = Boolean(bootstrap?.updated_at) && !bootstrap?.last_error
    return {
      chainId: chain.chainId,
      name: chain.name,
      agents,
      feedback,
      agentLimit: chain.agentLimit,
      feedbackLimit: chain.feedbackLimit,
      lastBlock: sync?.last_block ?? null,
      headBlock: sync?.head_block ?? null,
      lastError: sync?.last_error ? redactError(sync.last_error) : null,
      bootstrapped,
      bootstrap: bootstrap
        ? {
            at: bootstrap.updated_at,
            error: bootstrap.last_error ? redactError(bootstrap.last_error) : null,
          }
        : null,
      refresh: refresh
        ? {
            at: refresh.updated_at,
            error: refresh.last_error ? redactError(refresh.last_error) : null,
          }
        : null,
      rpc: rpc
        ? {
            at: rpc.updated_at,
            error: rpc.last_error ? redactError(rpc.last_error) : null,
          }
        : null,
    }
  })
}
