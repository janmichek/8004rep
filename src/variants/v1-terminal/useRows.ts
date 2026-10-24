import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

/** j/k move a cursor over `count()` rows, Enter opens the selected one. */
export function useRowCursor(count: () => number, open: (index: number) => void): Ref<number> {
  const cursor = ref(-1)
  function onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement).tagName === 'INPUT' || e.metaKey || e.ctrlKey) return
    const n = count()
    if (!n) return
    if (e.key === 'j') cursor.value = Math.min(n - 1, cursor.value + 1)
    else if (e.key === 'k') cursor.value = Math.max(0, cursor.value - 1)
    else if (e.key === 'Enter' && cursor.value >= 0) open(cursor.value)
    else return
    e.preventDefault()
    document.querySelector('tr.sel')?.scrollIntoView({ block: 'nearest' })
  }
  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
  return cursor
}
