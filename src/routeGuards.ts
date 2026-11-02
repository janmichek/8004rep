import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import { ALL_NETWORKS, findChainBySlug } from './chains'

function slugOf(to: RouteLocationNormalized): string {
  return typeof to.params.slug === 'string' ? to.params.slug : ''
}

/**
 * A per-chain page reads its chain as `findChainBySlug(slug)!`, so a slug that
 * names no chain — a stale link, or `all` in a detail URL — would render against
 * `undefined`. Send those to the list that can still answer instead.
 */
export function requireChain(list: 'agents' | 'owners' | 'reviewers') {
  return (to: RouteLocationNormalized): true | RouteLocationRaw =>
    findChainBySlug(slugOf(to)) ? true : { name: list, params: { slug: ALL_NETWORKS } }
}

/** A list page takes one chain or `all`; anything else falls back to `all`. */
export function requireScope(to: RouteLocationNormalized): true | RouteLocationRaw {
  const slug = slugOf(to)
  if (slug === ALL_NETWORKS || findChainBySlug(slug)) return true
  return { name: to.name ?? 'agents', params: { slug: ALL_NETWORKS } }
}
