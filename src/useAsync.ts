import { ref, shallowRef, watch, type WatchSource } from 'vue'
import { errorMessage } from './format'

/**
 * Runs `load` now and whenever `deps` change, exposing its state.
 * A slower earlier run never overwrites a newer one.
 */
export function useAsync<T>(load: () => Promise<T>, deps: WatchSource) {
  const data = shallowRef<T>()
  const error = ref<string>()
  const loading = ref(false)
  let latest = 0

  async function reload(): Promise<void> {
    const run = ++latest
    loading.value = true
    error.value = undefined
    data.value = undefined
    try {
      const value = await load()
      if (run === latest) data.value = value
    } catch (err) {
      if (run === latest) error.value = errorMessage(err)
    } finally {
      if (run === latest) loading.value = false
    }
  }

  watch(deps, reload, { immediate: true })
  return { data, error, loading, reload }
}
