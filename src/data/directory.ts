import type { Address } from 'viem'
import { buildReviewerProfile, type ReviewerProfile } from './reviewerProfile'
import type { AgentSummary, DataSource, FeedbackEvent } from './types'

/** Agents per request when walking the registry for owners. */
const AGENT_PAGE_SIZE = 100

export type OwnerEntry = {
  owner: Address
  /** Agents seen for this owner in the window, across every chain loaded. */
  agents: number
  /** Chains the owner's agents sit on, most agents first. */
  chainIds: number[]
  /**
   * Newest agent on the owner's main chain (its highest token ID there). Token IDs
   * are per chain, so there is no single "newest" across chains.
   */
  latest: { chainId: number; tokenId: bigint }
}

/**
 * Owners of the agents in a window, most agents first. Agents may come from
 * several chains; the same owner address on two chains is one owner.
 */
export function ownerDirectory(agents: AgentSummary[]): OwnerEntry[] {
  const byOwner = new Map<string, { owner: Address; perChain: Map<number, { count: number; top: bigint }> }>()
  for (const agent of agents) {
    if (!agent.owner) continue
    const key = agent.owner.toLowerCase()
    let entry = byOwner.get(key)
    if (!entry) {
      entry = { owner: agent.owner, perChain: new Map() }
      byOwner.set(key, entry)
    }
    const chain = entry.perChain.get(agent.chainId)
    if (chain) {
      chain.count++
      if (agent.tokenId > chain.top) chain.top = agent.tokenId
    } else {
      entry.perChain.set(agent.chainId, { count: 1, top: agent.tokenId })
    }
  }
  return [...byOwner.values()]
    .map(({ owner, perChain }) => {
      const chains = [...perChain.entries()].sort((a, b) => b[1].count - a[1].count || a[0] - b[0])
      const [mainChainId, main] = chains[0]
      return {
        owner,
        agents: chains.reduce((sum, [, c]) => sum + c.count, 0),
        chainIds: chains.map(([id]) => id),
        latest: { chainId: mainChainId, tokenId: main.top },
      }
    })
    .sort((a, b) => b.agents - a.agents)
}

/** Reviewers in a feed window, with their profile, most reviews first. */
export function reviewerDirectory(rows: FeedbackEvent[]): ReviewerProfile[] {
  const byClient = new Map<string, FeedbackEvent[]>()
  for (const row of rows) {
    const key = row.client.toLowerCase()
    const group = byClient.get(key)
    if (group) group.push(row)
    else byClient.set(key, [row])
  }
  return [...byClient.values()]
    .map((group) => buildReviewerProfile(group[0].client, group))
    .sort((a, b) => b.rows - a.rows)
}

/** Newest agents, read page by page until `minRows` are in or the source runs out. */
export async function loadAgentWindow(
  source: DataSource,
  { minRows = 300, maxSteps = 6 }: { minRows?: number; maxSteps?: number } = {},
): Promise<AgentSummary[]> {
  const items: AgentSummary[] = []
  for (let page = 0; page < maxSteps; page++) {
    const result = await source.listAgents({ page, pageSize: AGENT_PAGE_SIZE })
    items.push(...result.items)
    if (!result.hasMore || items.length >= minRows) break
  }
  return items
}
