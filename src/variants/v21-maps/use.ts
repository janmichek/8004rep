import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { CITIES } from '../../places/catalog'

/** Route slug → city; `all` is every city, anything else unknown is a 404. */
export function useRouteCity() {
  const route = useRoute()
  const slug = computed(() => (typeof route.params.slug === 'string' ? route.params.slug : 'all'))
  const city = computed(() => CITIES.find((c) => c.slug === slug.value))
  const known = computed(() => slug.value === 'all' || city.value !== undefined)
  return { route, slug, city, known }
}

export const stars = (x: number | null | undefined, digits = 1) => (x === null || x === undefined ? '—' : x.toFixed(digits))
export const gapClass = (gap: number | null) => (gap === null ? '' : gap >= 0.5 ? 'bad' : gap <= -0.5 ? 'good' : '')
