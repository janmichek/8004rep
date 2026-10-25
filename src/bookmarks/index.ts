/**
 * Agent bookmarks — localStorage, split only by mainnet / testnet.
 *
 * To remove this feature later:
 * 1. Delete this folder (`src/bookmarks/`).
 * 2. AgentPage / ScanAgentPage: drop the `<BookmarkButton>` import and tag.
 * 3. ScanAgentRow: drop the `<BookmarkButton>` import, tag, and `bookmarked` prop/class.
 * 4. AgentsPage: drop `usePinnedAgents`; render `data.items` again (and empty-check on that).
 */
import { computed, ref, watch, type Ref } from 'vue'
import { fetchScanAgentDetail, type ScanAgent } from '../data/scan'
import { networkEnv, type NetworkEnv } from '../env'

export type Bookmark = { chainId: number; tokenId: string }

type Store = Record<NetworkEnv, Bookmark[]>

const KEY = '8004rep:bookmarks'

function empty(): Store {
  return { mainnet: [], testnet: [] }
}

function parse(raw: string | null): Store {
  if (!raw) return empty()
  try {
    const data = JSON.parse(raw) as Partial<Store>
    return {
      mainnet: Array.isArray(data.mainnet) ? data.mainnet.filter(valid) : [],
      testnet: Array.isArray(data.testnet) ? data.testnet.filter(valid) : [],
    }
  } catch {
    return empty()
  }
}

function valid(value: unknown): value is Bookmark {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<Bookmark>
  return Number.isInteger(row.chainId) && typeof row.tokenId === 'string' && /^\d+$/.test(row.tokenId)
}

function load(): Store {
  try {
    return parse(localStorage.getItem(KEY))
  } catch {
    return empty()
  }
}

function save(next: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode: still keep the in-memory list for this session.
  }
}

const store = ref<Store>(load())

/** Bookmarks for the header mainnet/testnet switch. */
export const bookmarks = computed(() => store.value[networkEnv.value])

export function bookmarkId(chainId: number, tokenId: string | bigint): string {
  return `${chainId}:${tokenId}`
}

function envOf(testnet: boolean): NetworkEnv {
  return testnet ? 'testnet' : 'mainnet'
}

export function isBookmarked(chainId: number, tokenId: string | bigint, testnet: boolean): boolean {
  const id = bookmarkId(chainId, tokenId)
  return store.value[envOf(testnet)].some((row) => bookmarkId(row.chainId, row.tokenId) === id)
}

/** Newest save first. Same agent is not stored twice. */
export function toggleBookmark(chainId: number, tokenId: string | bigint, testnet: boolean): void {
  const env = envOf(testnet)
  const id = bookmarkId(chainId, tokenId)
  const list = store.value[env]
  const next = list.some((row) => bookmarkId(row.chainId, row.tokenId) === id)
    ? list.filter((row) => bookmarkId(row.chainId, row.tokenId) !== id)
    : [{ chainId, tokenId: tokenId.toString() }, ...list]
  store.value = { ...store.value, [env]: next }
  save(store.value)
}

function stub(chainId: number, tokenId: string | bigint, testnet: boolean): ScanAgent {
  return {
    chainId,
    tokenId: typeof tokenId === 'bigint' ? tokenId : BigInt(tokenId),
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

/** Pins saved agents above the feed. Drop this call when removing bookmarks. */
export function usePinnedAgents(options: {
  items: Ref<ScanAgent[]>
  chainId: Ref<number | undefined>
  search: Ref<string>
}) {
  const pinnedRaw = ref<ScanAgent[]>([])
  let run = 0

  watch(
    [bookmarks, networkEnv],
    async () => {
      const id = ++run
      const testnet = networkEnv.value === 'testnet'
      const rows = await Promise.all(
        bookmarks.value.map(async (row) => {
          const detail = await fetchScanAgentDetail(row.chainId, BigInt(row.tokenId)).catch(() => null)
          return detail ? fromDetail(detail, testnet) : stub(row.chainId, row.tokenId, testnet)
        }),
      )
      if (id === run) pinnedRaw.value = rows
    },
    { immediate: true },
  )

  const pinned = computed(() => {
    const testnet = networkEnv.value === 'testnet'
    const byId = new Map<string, ScanAgent>()
    for (const agent of pinnedRaw.value) byId.set(bookmarkId(agent.chainId, agent.tokenId), agent)
    for (const agent of options.items.value) {
      const id = bookmarkId(agent.chainId, agent.tokenId)
      if (!byId.has(id)) byId.set(id, agent)
    }
    const chainId = options.chainId.value
    const q = options.search.value.toLowerCase()
    return bookmarks.value.flatMap((row) => {
      const agent = byId.get(bookmarkId(row.chainId, row.tokenId)) ?? stub(row.chainId, row.tokenId, testnet)
      if (chainId !== undefined && agent.chainId !== chainId) return []
      if (q) {
        const name = agent.name?.toLowerCase() ?? ''
        if (!name.includes(q) && !agent.tokenId.toString().includes(q)) return []
      }
      return [agent]
    })
  })

  const feed = computed(() => {
    const pinnedIds = new Set(pinned.value.map((agent) => bookmarkId(agent.chainId, agent.tokenId)))
    return options.items.value.filter((agent) => !pinnedIds.has(bookmarkId(agent.chainId, agent.tokenId)))
  })

  const hasRows = computed(() => pinned.value.length > 0 || feed.value.length > 0)

  return { pinned, feed, hasRows }
}
