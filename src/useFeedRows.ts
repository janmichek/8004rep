import { computed } from 'vue'
import { sourceFor } from './data'
import { loadFeedWindow, type FeedWindow } from './data/feed'
import type { FeedbackEvent } from './data/types'
import type { Scope } from './scope'
import { useChainLoad } from './useChainLoad'

/**
 * The newest feedback of every chain in the scope, flattened into one list.
 * Every row carries the chain it came from, because token IDs repeat between
 * networks, and `load(true)` extends each chain's own window.
 */
export function useFeedRows(scope: Scope, window: { minRows: number; maxSteps: number }) {
  const chainLoad = useChainLoad<FeedWindow>(scope, async (chain, previous) => {
    const { source } = await sourceFor(chain)
    return loadFeedWindow(source, {}, { ...window, ...(previous ? { from: previous } : {}) })
  })

  const rows = computed<FeedbackEvent[]>(() =>
    Object.entries(chainLoad.values.value).flatMap(([id, w]) =>
      w.items.map((r) => ({ ...r, chainId: r.chainId ?? Number(id) })),
    ),
  )
  const hasMore = computed(() => Object.values(chainLoad.values.value).some((w) => w.cursor))
  /**
   * How far back the log scan reached. Only meaningful for a single chain: two
   * chains reach different depths, so there is no one date to name.
   */
  const since = computed(() => {
    const only = scope.all.value ? undefined : scope.chains.value[0]
    return only ? chainLoad.values.value[only.chainId]?.since : undefined
  })

  return { ...chainLoad, rows, hasMore, since }
}
