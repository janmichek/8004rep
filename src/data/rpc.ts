import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  http,
  zeroAddress,
  type Address,
  type PublicClient,
} from 'viem'
import { identityAbi, reputationAbi } from '../abi'
import type { ChainInfo } from '../chains'
import { attachResponses, mergeFeedback, scanFeedback, scanResponses } from './feedbackLogs'
import type {
  AgentDetail,
  AgentSummary,
  DataSource,
  Feedback,
  FeedbackQuery,
  ReputationSummary,
} from './types'

/** True for a contract revert; false for transport/RPC failures. */
export function isRevert(err: unknown): boolean {
  return err instanceof BaseError && Boolean(err.walk((e) => e instanceof ContractFunctionRevertedError))
}

/** Resolves null when the call reverts; other failures still reject. */
async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read
  } catch (err) {
    if (isRevert(err)) return null
    throw err
  }
}

/**
 * Number of tokens, given that IDs are minted sequentially from 0: probes
 * `exists` at doubling distances, then binary-searches the first missing ID.
 * `hint` is a previously known count, to skip most of the search.
 */
export async function findCount(exists: (id: bigint) => Promise<boolean>, hint = 0n): Promise<bigint> {
  // Invariant: every id < lo exists, id hi does not.
  let lo = hint > 0n && (await exists(hint - 1n)) ? hint : 0n
  let hi = lo
  for (let step = 1n; await exists(hi); step *= 2n) {
    lo = hi + 1n
    hi += step
  }
  while (lo < hi) {
    const mid = (lo + hi) / 2n
    if (await exists(mid)) lo = mid + 1n
    else hi = mid
  }
  return lo
}

function scaled(value: bigint, decimals: number): number {
  return Number(value) / 10 ** decimals
}

type AllFeedback = readonly [
  clients: readonly Address[],
  feedbackIndexes: readonly bigint[],
  values: readonly bigint[],
  valueDecimals: readonly number[],
  tag1s: readonly string[],
  tag2s: readonly string[],
  revokedStatuses: readonly boolean[],
]

/** Turns `readAllFeedback`'s parallel arrays into rows. */
export function zipFeedback([clients, indexes, values, decimals, tag1s, tag2s, revoked]: AllFeedback): Feedback[] {
  return clients.map((client, i) => ({
    client,
    index: Number(indexes[i]),
    value: scaled(values[i], decimals[i]),
    ...(tag1s[i] ? { tag1: tag1s[i] } : {}),
    ...(tag2s[i] ? { tag2: tag2s[i] } : {}),
    revoked: revoked[i],
  }))
}

function storedCount(key: string): bigint {
  try {
    const value = localStorage.getItem(key)
    return value && /^\d+$/.test(value) ? BigInt(value) : 0n
  } catch {
    return 0n
  }
}

export function createRpcClient(chain: ChainInfo): PublicClient {
  return createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
    // Concurrent reads are aggregated into one Multicall3 request.
    batch: { multicall: true },
  })
}

/** Log scans go to the higher-limit endpoint when the chain has one. */
export function createLogsClient(chain: ChainInfo): PublicClient {
  if (!chain.logsRpcUrl || chain.logsRpcUrl === chain.rpcUrl) return createRpcClient(chain)
  return createPublicClient({ chain: chain.viemChain, transport: http(chain.logsRpcUrl) })
}

/** `getSummary` calldata grows with the client list; beyond this the average is approximate. */
export const MAX_SUMMARY_CLIENTS = 200

/**
 * Count and average per agent, read from the contracts (the source of
 * truth — the subgraph stores no average). Agents with no clients map to
 * zero; reverted reads (unknown tokens) are left out.
 */
export async function getScores(
  client: PublicClient,
  chain: ChainInfo,
  tokenIds: bigint[],
): Promise<Map<bigint, ReputationSummary>> {
  const reputation = { address: chain.reputation, abi: reputationAbi } as const
  const perAgent = await Promise.all(
    tokenIds.map((tokenId) =>
      orNull(client.readContract({ ...reputation, functionName: 'getClients', args: [tokenId] })),
    ),
  )
  const summaries = await Promise.all(
    tokenIds.map((tokenId, i) => {
      const clients = perAgent[i]
      if (clients === null) return null
      if (clients.length === 0) return { count: 0, average: 0 } as ReputationSummary
      const capped = clients.length > MAX_SUMMARY_CLIENTS
      const subset = capped ? clients.slice(0, MAX_SUMMARY_CLIENTS) : clients
      return orNull(
        client.readContract({ ...reputation, functionName: 'getSummary', args: [tokenId, [...subset], '', ''] }),
      ).then((sum) =>
        sum
          ? {
              count: Number(sum[0]),
              average: scaled(sum[1], sum[2]),
              ...(capped ? { capped: true } : {}),
            }
          : null,
      )
    }),
  )
  const scores = new Map<bigint, ReputationSummary>()
  summaries.forEach((summary, i) => {
    if (summary) scores.set(tokenIds[i], summary)
  })
  return scores
}

export function createRpcSource(chain: ChainInfo, client: PublicClient = createRpcClient(chain)): DataSource {
  const identity = { address: chain.identity, abi: identityAbi } as const
  const reputation = { address: chain.reputation, abi: reputationAbi } as const
  const logs = chain.logsRpcUrl && chain.logsRpcUrl !== chain.rpcUrl ? createLogsClient(chain) : client
  // The last count is kept across visits so the search restarts next to the answer.
  const countKey = `8004-check:count:${chain.chainId}`
  let knownCount = storedCount(countKey)
  // Owner pages re-read the same set while paging; one scan serves every page.
  const ownedBy = new Map<string, Promise<bigint[]>>()

  async function exists(tokenId: bigint): Promise<boolean> {
    return (await orNull(client.readContract({ ...identity, functionName: 'ownerOf', args: [tokenId] }))) !== null
  }

  async function agentCount(): Promise<bigint> {
    knownCount = await findCount(exists, knownCount)
    try {
      localStorage.setItem(countKey, knownCount.toString())
    } catch {
      // storage unavailable (private mode, non-browser)
    }
    return knownCount
  }

  /**
   * Token ids this address currently owns, newest first.
   * The registry is not enumerable. Ids are dense, so `ownerOf` is read in
   * batches from the newest id until `balanceOf` tokens have been found.
   */
  function ownedTokenIds(owner: Address): Promise<bigint[]> {
    const key = owner.toLowerCase()
    let pending = ownedBy.get(key)
    if (!pending) {
      pending = (async () => {
        const balance = await client.readContract({ ...identity, functionName: 'balanceOf', args: [owner] })
        if (balance === 0n) return []
        const count = await agentCount()
        const found: bigint[] = []
        const want = Number(balance)
        const chunk = 1024n
        for (let end = count; end > 0n && found.length < want; ) {
          const start = end > chunk ? end - chunk : 0n
          const slice: bigint[] = []
          for (let id = end - 1n; id >= start; id--) slice.push(id)
          const owners = await Promise.all(
            slice.map((id) => orNull(client.readContract({ ...identity, functionName: 'ownerOf', args: [id] }))),
          )
          slice.forEach((id, i) => {
            if (owners[i]?.toLowerCase() === key) found.push(id)
          })
          end = start
        }
        return found
      })()
      pending.catch(() => ownedBy.delete(key))
      ownedBy.set(key, pending)
    }
    return pending
  }

  async function summary(tokenId: bigint): Promise<AgentSummary> {
    const [owner, uri] = await Promise.all([
      orNull(client.readContract({ ...identity, functionName: 'ownerOf', args: [tokenId] })),
      orNull(client.readContract({ ...identity, functionName: 'tokenURI', args: [tokenId] })),
    ])
    const agentURI = uri?.trim() || null
    return { chainId: chain.chainId, tokenId, owner, agentURI, ...(agentURI ? {} : { file: null }) }
  }

  async function reputationOf(tokenId: bigint): Promise<{ reputation: ReputationSummary | null; feedback: Feedback[] }> {
    const clients = await orNull(client.readContract({ ...reputation, functionName: 'getClients', args: [tokenId] }))
    if (!clients) return { reputation: null, feedback: [] }
    if (clients.length === 0) return { reputation: { count: 0, average: 0 }, feedback: [] }
    const [sum, all] = await Promise.all([
      orNull(client.readContract({ ...reputation, functionName: 'getSummary', args: [tokenId, clients, '', ''] })),
      orNull(
        client.readContract({ ...reputation, functionName: 'readAllFeedback', args: [tokenId, clients, '', '', true] }),
      ),
    ])
    return {
      reputation: sum ? { count: Number(sum[0]), average: scaled(sum[1], sum[2]) } : null,
      feedback: all ? zipFeedback(all).reverse() : [],
    }
  }

  return {
    kind: 'rpc',
    supportsTextSearch: false,

    async listAgents({ page, pageSize, search, owner }) {
      if (owner) {
        const ids = await ownedTokenIds(owner)
        const start = page * pageSize
        const slice = ids.slice(start, start + pageSize)
        return {
          items: await Promise.all(slice.map((id) => summary(id))),
          total: ids.length,
          hasMore: start + pageSize < ids.length,
        }
      }
      const query = search?.trim()
      if (query && /^\d+$/.test(query)) {
        const agent = await summary(BigInt(query))
        return { items: agent.owner ? [agent] : [], hasMore: false }
      }
      const count = await agentCount()
      const newest = count - 1n - BigInt(page) * BigInt(pageSize)
      const ids: bigint[] = []
      for (let id = newest; id >= 0n && ids.length < pageSize; id--) ids.push(id)
      return {
        items: await Promise.all(ids.map(summary)),
        total: Number(count),
        hasMore: newest - BigInt(pageSize) >= 0n,
      }
    },

    async getAgent(tokenId): Promise<AgentDetail | null> {
      const [agent, wallet, rep] = await Promise.all([
        summary(tokenId),
        orNull(client.readContract({ ...identity, functionName: 'getAgentWallet', args: [tokenId] })),
        reputationOf(tokenId),
      ])
      if (!agent.owner) return null
      // One scan step fills dates/endpoints/comment URIs for recent feedback.
      // Rows older than the window stay bare; a failed scan must not fail the page.
      let feedback = rep.feedback
      let feedbackSince: number | undefined
      const [scanned, responses] = await Promise.allSettled([
        scanFeedback(logs, chain, { agent: tokenId }),
        scanResponses(logs, chain, tokenId),
      ])
      if (scanned.status === 'fulfilled') {
        feedback = mergeFeedback(feedback, scanned.value.items)
        feedbackSince = scanned.value.since
      }
      if (responses.status === 'fulfilled') feedback = attachResponses(feedback, responses.value)
      return {
        ...agent,
        agentWallet: wallet && wallet !== zeroAddress ? wallet : null,
        ...rep,
        feedback,
        ...(feedbackSince !== undefined ? { feedbackSince } : {}),
      }
    },

    async listFeedback(query: FeedbackQuery) {
      return scanFeedback(logs, chain, query)
    },
  }
}
