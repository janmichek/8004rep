import { useRouter, type RouteLocationRaw } from 'vue-router'

/** Nested controls keep their own click; the rest of the row opens the destination. */
const NESTED = 'a, button, input, select, textarea, label, [role="button"]'

export function isNestedControl(event: Event): boolean {
  const el = event.target
  return el instanceof Element && Boolean(el.closest(NESTED))
}

/** Whole-row navigation that yields to nested links and buttons. */
export function useRowLink() {
  const router = useRouter()

  function open(to: RouteLocationRaw | undefined | null, event?: Event): void {
    if (event && isNestedControl(event)) return
    if (to) void router.push(to)
  }

  return { open }
}
