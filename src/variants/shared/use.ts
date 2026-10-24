import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isAddress, type Address } from 'viem'
import { identityAbi } from '../../abi'
import { findChainBySlug, type ChainInfo } from '../../chains'
import { sourceFor } from '../../data'
import { computeFeedbackStats, type FeedbackStats } from '../../data/feedbackStats'
import { loadFeedWindow, type FeedWindow } from '../../data/feed'
import { fetchFunding } from '../../data/funding'
import { resolveAgentURI, toDisplayUrl } from '../../data/metadata'
import { computeNetworkStats } from '../../data/networkStats'
import { buildReviewerProfile } from '../../data/reviewerProfile'
import { getScores } from '../../data/rpc'
import { fetchScanScore, fetchScanStats } from '../../data/scan'
import { computeScores } from '../../data/scores'
import { buildTrustReport } from '../../data/trustReport'
import { evaluateTxDetail } from '../../data/txChecks'
import { loadTxFacts } from '../../data/txDetail'
import type { AgentDetail, AgentSummary, Feedback, RegistrationFile, ReputationSummary } from '../../data/types'
import { errorMessage, formatDuration } from '../../format'
import { useAsync } from '../../useAsync'

// The pages of every design share these loaders; only the views differ.

export const PAGE_SIZE = 25

/** Route slug → chain; undefined for an unknown slug (shells show the error). */
export function useRouteChain() {
  const route = useRoute()
  const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : undefined))
  const chain = computed(() => (slug.value ? findChainBySlug(slug.value) : undefined))
  const resolved = useAsync(async () => (chain.value ? sourceFor(chain.value) : undefined), chain)
  return { route, slug, chain, resolved: resolved.data }
}

/** Pages only render for a known slug. */
export function useChain(slug: () => string) {
  return computed(() => findChainBySlug(slug())!)
}

export function usePageQuery() {
  const route = useRoute()
  const router = useRouter()
  const page = computed(() => Math.max(0, Math.trunc(Number(route.query.page) || 1) - 1))
  const search = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
  function pageLink(target: number) {
    return { query: { ...route.query, page: target > 0 ? String(target + 1) : undefined } }
  }
  function setSearch(q: string) {
    const trimmed = q.trim()
    void router.push({ query: trimmed ? { q: trimmed } : {} })
  }
  return { page, search, pageLink, setSearch }
}

/** On-chain averages for a list of agents, fetched after the list shows. */
function useScores(chain: Ref<ChainInfo>, ids: () => bigint[] | undefined) {
  const scores = shallowRef<Map<bigint, ReputationSummary>>()
  let run = 0
  watch(ids, async (list) => {
    const current = ++run
    scores.value = undefined
    if (!list?.length) return
    try {
      const { rpcClient } = await sourceFor(chain.value)
      const result = await getScores(rpcClient, chain.value, list)
      if (current === run) scores.value = result
    } catch {
      if (current === run) scores.value = new Map()
    }
  })
  return scores
}

/** A page of agents (newest first), optionally of one owner, with their on-chain scores. */
export function useAgentList(chain: Ref<ChainInfo>, page: Ref<number>, search: Ref<string>, owner?: Ref<Address | undefined>) {
  const list = useAsync(
    async () => {
      if (owner && !owner.value) return null
      const { source, rpcClient } = await sourceFor(chain.value)
      const result = await source.listAgents({
        page: page.value,
        pageSize: PAGE_SIZE,
        ...(owner?.value ? { owner: owner.value } : { search: search.value }),
      })
      let total = result.total
      if (owner?.value && total === undefined) {
        try {
          total = Number(
            await rpcClient.readContract({ address: chain.value.identity, abi: identityAbi, functionName: 'balanceOf', args: [owner.value] }),
          )
        } catch {
          total = undefined
        }
      }
      return { ...result, total, textSearch: source.supportsTextSearch }
    },
    () => [chain.value, page.value, search.value, owner?.value],
  )
  const scores = useScores(chain, () => list.data.value?.items.map((a) => a.tokenId))
  const searchIgnored = computed(
    () => Boolean(search.value) && !/^\d+$/.test(search.value) && list.data.value?.textSearch === false,
  )
  return { ...list, scores, searchIgnored }
}

export function useAddress(raw: () => string) {
  return computed(() => (isAddress(raw(), { strict: false }) ? (raw() as Address) : undefined))
}

/** One agent: on-chain record, then its registration file, then every derived score. */
export function useAgentDetail(chain: Ref<ChainInfo>, id: () => string) {
  const tokenId = computed(() => (/^\d+$/.test(id()) ? BigInt(id()) : undefined))
  const detail = useAsync(
    async () => {
      if (tokenId.value === undefined) return null
      const { source } = await sourceFor(chain.value)
      return source.getAgent(tokenId.value)
    },
    () => [chain.value, tokenId.value],
  )
  const agent = detail.data

  /** undefined while it is being fetched. */
  const file = ref<RegistrationFile | null>()
  watch(agent, async (current) => {
    file.value = undefined
    if (!current) return
    const resolved = (await resolveAgentURI(current.agentURI)) ?? current.file ?? null
    if (agent.value === current) file.value = resolved
  })

  const self = computed(() => (agent.value ? [agent.value.owner, agent.value.agentWallet].filter((a): a is Address => a != null) : []))
  const stats = computed(() =>
    agent.value
      ? computeFeedbackStats(agent.value.feedback, {
          owner: agent.value.owner,
          agentWallet: agent.value.agentWallet,
          ...(file.value ? { services: file.value.services.map((s) => s.endpoint) } : {}),
        })
      : undefined,
  )
  const report = computed(() => (agent.value && stats.value ? buildTrustReport(agent.value.feedback, stats.value, self.value) : undefined))
  const scores = computed(() => (agent.value ? computeScores(agent.value.feedback, { self: self.value }) : undefined))

  const scan = useAsync(
    async () => (tokenId.value === undefined ? null : fetchScanScore(chain.value.chainId, tokenId.value)),
    () => [chain.value.chainId, tokenId.value],
  )
  const ecosystem = useEcosystem()

  const name = computed(() => file.value?.name ?? `Agent #${id()}`)
  const uriLink = computed(() => {
    const uri = agent.value?.agentURI
    return uri && !/^data:/i.test(uri) ? toDisplayUrl(uri) : undefined
  })
  const rawJson = computed(() => (file.value ? JSON.stringify(file.value.raw, null, 2) : undefined))
  const walletIsOwner = computed(
    () => Boolean(agent.value?.agentWallet && agent.value.owner && agent.value.agentWallet.toLowerCase() === agent.value.owner.toLowerCase()),
  )

  return { ...detail, agent, tokenId, file, self, stats, report, scores, scan, ecosystem, name, uriLink, rawJson, walletIsOwner }
}

let ecosystemCache: ReturnType<typeof useAsync<Awaited<ReturnType<typeof fetchScanStats>>>> | undefined
/** 8004scan-wide averages; one request per session. */
export function useEcosystem() {
  ecosystemCache ??= useAsync(() => fetchScanStats(), () => true)
  return ecosystemCache
}

/** A growing window of feedback rows ("load older" extends it). */
function useFeed(target: () => { chain: ChainInfo; client?: Address } | undefined, minRows: number, maxSteps?: number) {
  const feed = shallowRef<FeedWindow>()
  const error = shallowRef<string>()
  const loading = shallowRef(false)
  async function load(extend = false): Promise<void> {
    const t = target()
    if (!t) return
    loading.value = true
    error.value = undefined
    try {
      const { source } = await sourceFor(t.chain)
      const next = await loadFeedWindow(source, t.client ? { client: t.client } : {}, {
        minRows,
        ...(maxSteps ? { maxSteps } : {}),
        ...(extend && feed.value ? { from: feed.value } : {}),
      })
      const now = target()
      if (now?.chain === t.chain && now.client === t.client) feed.value = next
    } catch (err) {
      error.value = errorMessage(err)
    } finally {
      loading.value = false
    }
  }
  watch(
    () => [target()?.chain, target()?.client],
    () => {
      feed.value = undefined
      void load()
    },
    { immediate: true },
  )
  return { feed, error, loading, load }
}

export function useNetwork(chain: Ref<ChainInfo>) {
  const feed = useFeed(() => ({ chain: chain.value }), 250, 12)
  const stats = computed(() => (feed.feed.value ? computeNetworkStats(feed.feed.value.items) : undefined))
  return { ...feed, stats, ecosystem: useEcosystem() }
}

export function useReviewer(chain: Ref<ChainInfo>, address: Ref<Address | undefined>) {
  const feed = useFeed(() => (address.value ? { chain: chain.value, client: address.value } : undefined), 100)
  const profile = computed(() => (address.value && feed.feed.value ? buildReviewerProfile(address.value, feed.feed.value.items) : undefined))
  const wallet = useAsync(
    async () => {
      if (!address.value) return null
      const { rpcClient } = await sourceFor(chain.value)
      const { explorerApiUrl } = chain.value
      const [nonce, code, funding] = await Promise.allSettled([
        rpcClient.getTransactionCount({ address: address.value }),
        rpcClient.getCode({ address: address.value }),
        explorerApiUrl ? fetchFunding({ ...chain.value, explorerApiUrl }, address.value) : Promise.resolve(undefined),
      ])
      const bytecode = code.status === 'fulfilled' ? (code.value ?? '0x') : undefined
      return {
        nonce: nonce.status === 'fulfilled' ? nonce.value : undefined,
        kind:
          bytecode === undefined
            ? undefined
            : bytecode === '0x'
              ? 'wallet'
              : bytecode.toLowerCase().startsWith('0xef0100')
                ? 'wallet + 7702'
                : 'contract',
        funding: funding.status === 'fulfilled' ? funding.value : undefined,
        fundingError: funding.status === 'rejected' ? errorMessage(funding.reason) : undefined,
      }
    },
    () => [chain.value, address.value],
  )
  return { ...feed, profile, wallet }
}

/** The tx detail checks of one feedback row. `index` points into `agent.feedback`. */
export function useTxView(chain: () => ChainInfo, agent: () => AgentDetail, row: () => Feedback, index: () => number, stats: () => FeedbackStats) {
  const facts = useAsync(
    async () => {
      const { source, rpcClient } = await sourceFor(chain())
      return loadTxFacts({ chain: chain(), client: rpcClient, source, tokenId: agent().tokenId, row: row(), feedback: agent().feedback })
    },
    () => [chain(), agent(), row()],
  )
  const view = computed(() => {
    const f = facts.data.value
    if (!f) return undefined
    const a = agent()
    return evaluateTxDetail(f, {
      chainId: chain().chainId,
      nativeSymbol: chain().viemChain.nativeCurrency.symbol,
      identity: chain().identity,
      reputation: chain().reputation,
      tokenId: a.tokenId,
      owner: a.owner,
      agentWallet: a.agentWallet,
      ...(a.createdAt !== undefined ? { agentCreatedAt: a.createdAt } : {}),
      feedback: a.feedback,
      stats: stats(),
      index: index(),
    })
  })
  return { facts: facts.data, error: facts.error, loading: facts.loading, reload: facts.reload, view }
}

/** Route helpers every design links with. */
export function routes(chain: () => ChainInfo) {
  return {
    agents: () => ({ name: 'agents', params: { slug: chain().slug } }),
    network: () => ({ name: 'network', params: { slug: chain().slug } }),
    agent: (id: bigint | string) => ({ name: 'agent', params: { slug: chain().slug, id: id.toString() } }),
    owner: (address: string) => ({ name: 'owner', params: { slug: chain().slug, address } }),
    reviewer: (address: string) => ({ name: 'reviewer', params: { slug: chain().slug, address } }),
  }
}

/** Registration files of a list of agents, filled in as each host answers. */
export function useFiles(items: () => AgentSummary[] | undefined) {
  const files = shallowRef(new Map<bigint, RegistrationFile | null>())
  let run = 0
  watch(
    items,
    (list) => {
      const current = ++run
      const seed = new Map<bigint, RegistrationFile | null>()
      for (const a of list ?? []) if (a.file !== undefined) seed.set(a.tokenId, a.file)
      files.value = seed
      for (const a of list ?? []) {
        if (a.file !== undefined) continue
        void resolveAgentURI(a.agentURI).then((file) => {
          if (current !== run) return
          files.value = new Map(files.value).set(a.tokenId, file)
        })
      }
    },
    { immediate: true },
  )
  return files
}

/** Network switch that keeps the network view, else lands on the agents list. */
export function useChainSwitch() {
  const route = useRoute()
  const router = useRouter()
  return (slug: string) => void router.push({ name: route.name === 'network' ? 'network' : 'agents', params: { slug } })
}

/** "subgraph", "subgraph · 2h behind", "rpc · <why>". */
export function sourceText(resolved: Awaited<ReturnType<typeof sourceFor>> | undefined): { label: string; detail: string; ok: boolean } | undefined {
  if (!resolved) return undefined
  if (resolved.source.kind === 'subgraph') {
    const lag = resolved.lagSeconds !== undefined && resolved.lagSeconds > 600 ? formatDuration(resolved.lagSeconds) : undefined
    return { label: lag ? `subgraph · ${lag} behind` : 'subgraph', detail: "Agents are read from the chain's subgraph", ok: true }
  }
  return { label: resolved.note ? 'rpc · no subgraph' : 'rpc', detail: resolved.note ?? 'Agents are read directly from the registry contracts', ok: false }
}
