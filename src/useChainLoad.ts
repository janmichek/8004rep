import { shallowRef, watch } from 'vue'
import type { ChainInfo } from './chains'
import { loadChains, type ChainFailure, type Scope } from './scope'

/**
 * Runs `load` for every chain of the scope and keeps the last value per chain,
 * so a page can extend one chain without refetching the others.
 *
 * `load(extend)` re-reads the scope; with `extend` each loader also receives its
 * previous value. A slower earlier run never overwrites a newer one.
 */
export function useChainLoad<T>(scope: Scope, loadOne: (chain: ChainInfo, previous: T | undefined) => Promise<T>) {
  const values = shallowRef<Record<number, T>>({})
  const loaded = shallowRef(false)
  const failed = shallowRef<ChainFailure[]>([])
  const error = shallowRef<string>()
  const loading = shallowRef(false)
  let run = 0

  async function load(extend = false): Promise<void> {
    const current = ++run
    loading.value = true
    error.value = undefined
    try {
      const result = await loadChains(scope.chains.value, (chain) =>
        loadOne(chain, extend ? values.value[chain.chainId] : undefined),
      )
      if (current !== run) return
      failed.value = result.failed
      // Nothing loaded at all: the page has nothing to show but the first failure.
      // While extending, the rows already on screen stay and `failed` carries the
      // notice, so a dropped connection does not wipe the window the user paged to.
      const held = Object.keys(values.value).length > 0
      if (!result.values.length && result.failed.length && !(extend && held)) {
        error.value = `${result.failed[0].chain.name}: ${result.failed[0].message}`
        return
      }
      const next: Record<number, T> = extend ? { ...values.value } : {}
      for (const { chain, value } of result.values) next[chain.chainId] = value
      values.value = next
      loaded.value = true
    } finally {
      if (current === run) loading.value = false
    }
  }

  // A new scope starts from nothing: rows of the chains left behind must not linger.
  watch(
    scope.key,
    () => {
      values.value = {}
      loaded.value = false
      void load()
    },
    { immediate: true },
  )

  return { values, loaded, failed, error, loading, load }
}
