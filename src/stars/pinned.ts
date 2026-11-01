import { computed, ref, watch, type Ref } from 'vue'
import { fetchScanAgentDetail, type ScanAgent, type ScanChain } from '../data/scan'
import { networkEnv } from '../env'
import { starKey, starred } from './index'

function stub(chainId: number, tokenId: string, testnet: boolean): ScanAgent {
  return {
    chainId,
    tokenId: BigInt(tokenId),
    owner: null,
    protocols: [],
    x402: false,
    totalScore: 0,
    averageScore: 0,
    feedbackCount: 0,
    testnet,
  }
}

function fromDetail(detail: NonNullable<Awaited<ReturnType<typeof fetchScanAgentDetail>>>, testnet: boolean): ScanAgent {
  return {
    chainId: detail.chainId,
    tokenId: detail.tokenId,
    ...(detail.name ? { name: detail.name } : {}),
    ...(detail.description ? { description: detail.description } : {}),
    ...(detail.imageUrl ? { imageUrl: detail.imageUrl } : {}),
    owner: detail.owner,
    protocols: detail.protocols,
    x402: detail.x402,
    totalScore: detail.totalScore,
    averageScore: detail.averageScore,
    feedbackCount: detail.feedbackCount,
    ...(detail.createdAt !== undefined ? { createdAt: detail.createdAt } : {}),
    testnet,
  }
}

/** Starred agents above the agent feed, limited to the current network environment. */
export function usePinnedAgents(options: {
  items: Ref<ScanAgent[]>
  chains: Ref<ScanChain[] | undefined>
  chainId: Ref<number | undefined>
  search: Ref<string>
}) {
  const pinnedRaw = ref<ScanAgent[]>([])
  let run = 0

  const starredAgents = computed(() => starred.value.filter((row) => row.kind === 'agent'))

  // A star on a chain the scan list does not know is shown in either environment.
  function inEnv(chainId: number): boolean {
    const chain = options.chains.value?.find((item) => item.chainId === chainId)
    return chain === undefined || chain.testnet === (networkEnv.value === 'testnet')
  }

  watch(
    [starredAgents, networkEnv, options.chains],
    async () => {
      const id = ++run
      const testnet = networkEnv.value === 'testnet'
      const rows = await Promise.all(
        starredAgents.value.filter((row) => inEnv(row.chainId)).map(async (row) => {
          const detail = await fetchScanAgentDetail(row.chainId, BigInt(row.id)).catch(() => null)
          return detail ? fromDetail(detail, testnet) : stub(row.chainId, row.id, testnet)
        }),
      )
      if (id === run) pinnedRaw.value = rows
    },
    { immediate: true },
  )

  const pinned = computed(() => {
    const testnet = networkEnv.value === 'testnet'
    const byId = new Map<string, ScanAgent>()
    for (const agent of pinnedRaw.value) byId.set(starKey('agent', agent.chainId, agent.tokenId), agent)
    for (const agent of options.items.value) {
      const key = starKey('agent', agent.chainId, agent.tokenId)
      if (!byId.has(key)) byId.set(key, agent)
    }
    const chainId = options.chainId.value
    const q = options.search.value.toLowerCase()
    return starredAgents.value.flatMap((row) => {
      if (!inEnv(row.chainId)) return []
      const agent = byId.get(starKey('agent', row.chainId, row.id)) ?? stub(row.chainId, row.id, testnet)
      if (chainId !== undefined && agent.chainId !== chainId) return []
      if (q) {
        const name = agent.name?.toLowerCase() ?? ''
        if (!name.includes(q) && !agent.tokenId.toString().includes(q)) return []
      }
      return [agent]
    })
  })

  const feed = computed(() => {
    const pinnedKeys = new Set(pinned.value.map((agent) => starKey('agent', agent.chainId, agent.tokenId)))
    return options.items.value.filter((agent) => !pinnedKeys.has(starKey('agent', agent.chainId, agent.tokenId)))
  })

  const hasRows = computed(() => pinned.value.length > 0 || feed.value.length > 0)

  return { pinned, feed, hasRows }
}
