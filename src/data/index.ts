import type { PublicClient } from 'viem'
import type { ChainInfo } from '../chains'
import { errorMessage, formatDuration } from '../format'
import { mergeFeedback } from './feedbackLogs'
import { createRpcClient, createRpcSource } from './rpc'
import { createSubgraphSource, type SubgraphSource } from './subgraph'
import type { DataSource } from './types'

export type ResolvedSource = {
  source: DataSource
  /** Contract reads (scores) go through this, whichever source lists the agents. */
  rpcClient: PublicClient
  /** How far the subgraph trails the chain, when it reports a block time. */
  lagSeconds?: number
  /** Why the chain's subgraph is not being used. */
  note?: string
}

/** A subgraph further behind than this has stopped indexing; its data is not worth showing. */
const MAX_LAG_SECONDS = 86400

/**
 * RPC source backed by a subgraph that stopped indexing: feedback is
 * immutable, so what the subgraph did index still dates the rows older
 * than the log scan reaches. An archive failure leaves the RPC rows as is.
 */
export function withArchive(rpc: DataSource, archive: DataSource): DataSource {
  return {
    ...rpc,
    async getAgent(tokenId) {
      const [agent, archived] = await Promise.all([
        rpc.getAgent(tokenId),
        archive.getAgent(tokenId).catch(() => null),
      ])
      if (!agent || !archived) return agent
      return { ...agent, feedback: mergeFeedback(agent.feedback, archived.feedback) }
    },
  }
}

/** Uses the subgraph when it answers and is current, the RPC source otherwise. */
export async function resolveSource(
  rpc: DataSource,
  rpcClient: PublicClient,
  subgraph?: SubgraphSource,
  nowSeconds = Date.now() / 1000,
): Promise<ResolvedSource> {
  if (!subgraph) return { source: rpc, rpcClient }
  try {
    const { timestamp } = await subgraph.meta()
    if (!timestamp) return { source: subgraph, rpcClient }
    const lagSeconds = Math.max(0, nowSeconds - timestamp)
    return lagSeconds > MAX_LAG_SECONDS
      ? { source: withArchive(rpc, subgraph), rpcClient, note: `subgraph is ${formatDuration(lagSeconds)} behind` }
      : { source: subgraph, rpcClient, lagSeconds }
  } catch (err) {
    return { source: rpc, rpcClient, note: errorMessage(err) }
  }
}

const resolved = new Map<number, Promise<ResolvedSource>>()

/** Data source of a chain; the subgraph health check runs once per chain per session. */
export function sourceFor(chain: ChainInfo): Promise<ResolvedSource> {
  let pending = resolved.get(chain.chainId)
  if (!pending) {
    const { subgraphUrl } = chain
    const rpcClient = createRpcClient(chain)
    pending = resolveSource(
      createRpcSource(chain, rpcClient),
      rpcClient,
      subgraphUrl ? createSubgraphSource({ ...chain, subgraphUrl }) : undefined,
    )
    resolved.set(chain.chainId, pending)
  }
  return pending
}
