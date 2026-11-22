import { createPublicClient, fallback, http, parseAbiItem, zeroAddress, type Address, type Hex, type PublicClient } from 'viem'
import { feedbackRevokedEvent, identityAbi, newFeedbackEvent, reputationAbi, responseAppendedEvent } from '../../src/abi'
import type { ChainInfo } from '../../src/chains'
import { normalizeRegistrationFile } from '../../src/data/metadata'
import { zipFeedback, createRpcSource } from '../../src/data/rpc'
import type { RegistrationFile, Service } from '../../src/data/types'
import { enabledChains, type ServerChain } from './chains'
import { get, run, touchSync, transaction } from './db'

const QUERY_TIMEOUT_MS = 20_000
const GRAPH_PAGE = 1_000
/** Log windows read per tail pass; the next pass continues where this one stops. */
const TAIL_CHUNKS = 4

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
  clientAddress: string
  feedbackIndex?: string | null
  value: string
  tag1?: string | null
  tag2?: string | null
  endpoint?: string | null
  feedbackURI?: string | null
  isRevoked: boolean
  createdAt?: string | null
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
  agentWallet?: string | null
  agentURI?: string | null
  createdAt?: number | null
  createdBlock?: string | null
  file?: RegistrationFile | null
  needsRecompute?: boolean
}): void {
  const now = Math.floor(Date.now() / 1000)
  const file = agent.file ?? null
  run(
    `INSERT INTO agents (chain_id, token_id, owner, agent_wallet, agent_uri, created_at, created_block,
       name, description, image, active, x402, services_json, supported_trust_json, raw_file_json,
       needs_recompute, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(chain_id, token_id) DO UPDATE SET
       owner = COALESCE(excluded.owner, agents.owner),
       agent_wallet = COALESCE(excluded.agent_wallet, agents.agent_wallet),
       agent_uri = COALESCE(excluded.agent_uri, agents.agent_uri),
       created_at = COALESCE(agents.created_at, excluded.created_at),
       created_block = COALESCE(agents.created_block, excluded.created_block),
       name = COALESCE(agents.name, excluded.name),
       description = COALESCE(agents.description, excluded.description),
       image = COALESCE(agents.image, excluded.image),
       active = COALESCE(agents.active, excluded.active),
       x402 = COALESCE(agents.x402, excluded.x402),
       services_json = COALESCE(agents.services_json, excluded.services_json),
       supported_trust_json = COALESCE(agents.supported_trust_json, excluded.supported_trust_json),
       raw_file_json = COALESCE(agents.raw_file_json, excluded.raw_file_json),
       needs_recompute = MAX(agents.needs_recompute, excluded.needs_recompute),
       updated_at = excluded.updated_at`,
    chainId,
    agent.tokenId,
    agent.owner ?? null,
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
    row.client.toLowerCase(),
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
  run('UPDATE agents SET needs_recompute = 1 WHERE chain_id = ? AND token_id = ?', chainId, row.tokenId)
}

function ensureAgent(chainId: number, tokenId: string, owner?: string | null, createdAt?: number | null): void {
  upsertAgent(chainId, { tokenId, owner: owner ?? null, createdAt: createdAt ?? null })
}

export async function syncSubgraphAgents(chain: ServerChain): Promise<void> {
  if (!chain.subgraphUrl) return
  const url = chain.subgraphUrl
  let last = false
  for (let skip = 0; skip < chain.agentLimit && !last; skip += GRAPH_PAGE) {
    const data = await gql<{ agents: SubgraphAgent[]; _meta?: { block: { number: number } } }>(
      url,
      `query Agents($first: Int!, $skip: Int!) {
        _meta { block { number } }
        agents(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
          agentId owner agentURI agentWallet createdAt totalFeedback
          registrationFile {
            name description image active x402Support supportedTrusts
            mcpEndpoint mcpVersion a2aEndpoint a2aVersion webEndpoint
          }
        }
      }`,
      { first: GRAPH_PAGE, skip },
    )
    const rows = data.agents ?? []
    transaction(() => {
      for (const row of rows) {
        upsertAgent(chain.chainId, {
          tokenId: row.agentId,
          owner: row.owner ?? null,
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
    if (rows.length < GRAPH_PAGE) last = true
    console.log(`[sync] ${chain.name} agents ${Math.min(skip + rows.length, chain.agentLimit)}/${chain.agentLimit}`)
  }
}

export async function syncSubgraphFeedback(chain: ServerChain): Promise<void> {
  if (!chain.subgraphUrl) return
  const url = chain.subgraphUrl
  let last = false
  for (let skip = 0; skip < chain.feedbackLimit && !last; skip += GRAPH_PAGE) {
    const data = await gql<{ feedbacks: SubgraphFeedback[] }>(
      url,
      `query Feedback($first: Int!, $skip: Int!) {
        feedbacks(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
          clientAddress feedbackIndex value tag1 tag2 endpoint feedbackURI isRevoked createdAt
          agent { agentId owner }
        }
      }`,
      { first: GRAPH_PAGE, skip },
    )
    const rows = data.feedbacks ?? []
    transaction(() => {
      for (const row of rows) {
        const tokenId = row.agent?.agentId
        if (!tokenId) continue
        ensureAgent(chain.chainId, tokenId, row.agent?.owner ?? null, row.createdAt ? Number(row.createdAt) : null)
        upsertFeedback(chain.chainId, {
          tokenId,
          client: row.clientAddress,
          index: Number(row.feedbackIndex ?? 0),
          value: Number(row.value),
          tag1: row.tag1 ?? null,
          tag2: row.tag2 ?? null,
          endpoint: row.endpoint ?? null,
          feedbackURI: row.feedbackURI ?? null,
          revoked: row.isRevoked,
          createdAt: row.createdAt ? Number(row.createdAt) : null,
        })
      }
    })
    if (rows.length < GRAPH_PAGE) last = true
    console.log(`[sync] ${chain.name} feedback ${Math.min(skip + rows.length, chain.feedbackLimit)}/${chain.feedbackLimit}`)
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

  const identity = { address: chain.identity, abi: identityAbi } as const
  const reputation = { address: chain.reputation, abi: reputationAbi } as const
  await pool(
    items.map((agent) => async () => {
      const tokenId = agent.tokenId
      const [wallet, clients] = await Promise.all([
        client.readContract({ ...identity, functionName: 'getAgentWallet', args: [tokenId] }).catch(() => null),
        client.readContract({ ...reputation, functionName: 'getClients', args: [tokenId] }).catch(() => [] as Address[]),
      ])
      if (wallet && wallet !== zeroAddress) {
        run('UPDATE agents SET agent_wallet = ? WHERE chain_id = ? AND token_id = ?', wallet, chain.chainId, tokenId.toString())
      }
      if (!clients.length) return
      const [summary, allFeedback] = await Promise.all([
        client
          .readContract({ ...reputation, functionName: 'getSummary', args: [tokenId, clients.slice(0, 200), '', ''] })
          .catch(() => null),
        client
          .readContract({ ...reputation, functionName: 'readAllFeedback', args: [tokenId, clients, '', '', true] })
          .catch(() => null),
      ])
      void summary
      if (!allFeedback) return
      const rows = zipFeedback(allFeedback)
      transaction(() => {
        for (const row of rows) {
          upsertFeedback(chain.chainId, {
            tokenId: tokenId.toString(),
            client: row.client,
            index: row.index ?? 0,
            value: row.value,
            tag1: row.tag1 ?? null,
            tag2: row.tag2 ?? null,
            revoked: row.revoked,
          })
        }
      })
    }),
    4,
  )
  touchSync(chain.chainId, 'agents', await client.getBlockNumber(), await client.getBlockNumber(), null)
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
    gql<{ agents: SubgraphAgent[] }>(
      url,
      `query RecentAgents {
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
          clientAddress feedbackIndex value tag1 tag2 endpoint feedbackURI isRevoked createdAt
          agent { agentId owner }
        }
      }`,
    ),
  ])
  transaction(() => {
    for (const row of agents.agents ?? []) {
      upsertAgent(chain.chainId, {
        tokenId: row.agentId,
        owner: row.owner ?? null,
        agentWallet: row.agentWallet ?? null,
        agentURI: row.agentURI ?? null,
        createdAt: row.createdAt ? Number(row.createdAt) : null,
        file: mapFile(row.registrationFile),
        needsRecompute: false,
      })
    }
    for (const row of feedback.feedbacks ?? []) {
      const tokenId = row.agent?.agentId
      if (!tokenId) continue
      ensureAgent(chain.chainId, tokenId, row.agent?.owner ?? null, row.createdAt ? Number(row.createdAt) : null)
      upsertFeedback(chain.chainId, {
        tokenId,
        client: row.clientAddress,
        index: Number(row.feedbackIndex ?? 0),
        value: Number(row.value),
        tag1: row.tag1 ?? null,
        tag2: row.tag2 ?? null,
        endpoint: row.endpoint ?? null,
        feedbackURI: row.feedbackURI ?? null,
        revoked: row.isRevoked,
        createdAt: row.createdAt ? Number(row.createdAt) : null,
      })
    }
  })
}

export async function refreshAll(): Promise<void> {
  await Promise.all(
    enabledChains().map(async (chain) => {
      try {
        if (chain.subgraphUrl) await refreshRecent(chain)
        else await syncRpcChain(chain)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        touchSync(chain.chainId, 'refresh', undefined, undefined, message)
        console.error(`[refresh] ${chain.name}: ${message}`)
      }
    }),
  )
}

/** One bounded step of the reputation/identity log tail. */
export async function tailChain(chain: ServerChain): Promise<void> {
  const client = rpcClient(chain)
  const head = await client.getBlockNumber()
  const state = get<{ last_block: string }>('SELECT last_block FROM sync_state WHERE chain_id = ? AND stream = ?', chain.chainId, 'logs')
  const saved = state ? BigInt(state.last_block) : 0n
  // Public nodes keep only the last few dozen blocks free; subgraph refresh fills
  // anything older, so the tail never asks for an archive range.
  const newest = head > 64n ? head - 64n : 0n
  const from = saved > 0n ? (saved + 1n > newest ? saved + 1n : newest) : newest
  if (from > head) {
    touchSync(chain.chainId, 'logs', head, head, null)
    return
  }
  let cursor = from
  for (let chunk = 0; chunk < TAIL_CHUNKS && cursor <= head; chunk++) {
    const to = cursor + chain.logRange - 1n > head ? head : cursor + chain.logRange - 1n
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
        ensureAgent(chain.chainId, tokenId, null, timeOf(log))
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
        run(
          `INSERT INTO feedback_responses (chain_id, tx_hash, log_index, token_id, client, feedback_index, responder, response_uri, block_number, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(chain_id, tx_hash, log_index) DO NOTHING`,
          chain.chainId,
          log.transactionHash,
          log.logIndex,
          args.agentId.toString(),
          args.clientAddress.toLowerCase(),
          Number(args.feedbackIndex),
          args.responder,
          args.responseURI || null,
          log.blockNumber.toString(),
          timeOf(log),
        )
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
            createdAt: args.from.toLowerCase() === zeroAddress ? timeOf(log) : null,
            createdBlock: args.from.toLowerCase() === zeroAddress ? log.blockNumber.toString() : null,
            needsRecompute: false,
          })
        }
      }
    })
    touchSync(chain.chainId, 'logs', to, head, null)
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
    touchSync(chain.chainId, 'bootstrap', BigInt(Math.floor(Date.now() / 1000)), undefined, null)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
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
        tailChain(chain).catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          touchSync(chain.chainId, 'logs', undefined, undefined, message)
          console.error(`[tail] ${chain.name}: ${message}`)
        }),
      ),
    )
  } finally {
    tailing = false
  }
}

/** Everything the UI needs to know about indexing coverage. */
export function coverage(): Array<Record<string, unknown>> {
  return enabledChains().map((chain) => {
    const agents = get<{ n: number }>('SELECT COUNT(*) AS n FROM agents WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const feedback = get<{ n: number }>('SELECT COUNT(*) AS n FROM feedback WHERE chain_id = ?', chain.chainId)?.n ?? 0
    const sync = get<{ last_block: string; head_block: string | null; last_error: string | null }>(
      'SELECT last_block, head_block, last_error FROM sync_state WHERE chain_id = ? AND stream = ?',
      chain.chainId,
      'logs',
    )
    return {
      chainId: chain.chainId,
      name: chain.name,
      agents,
      feedback,
      agentLimit: chain.agentLimit,
      feedbackLimit: chain.feedbackLimit,
      lastBlock: sync?.last_block ?? null,
      headBlock: sync?.head_block ?? null,
      lastError: sync?.last_error ?? null,
    }
  })
}
