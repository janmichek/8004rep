import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { ALL_NETWORKS, CHAINS } from './chains'
import { requireChain, requireScope } from './routeGuards'

const SLUG = CHAINS[0].slug

function to(slug: unknown, name?: string): RouteLocationNormalized {
  return { name, params: { slug } } as unknown as RouteLocationNormalized
}

describe('requireChain', () => {
  it('lets a real chain slug through', () => {
    expect(requireChain('agents')(to(SLUG))).toBe(true)
  })

  it('sends `all` to the list it names, since a detail page addresses one chain', () => {
    expect(requireChain('reviewers')(to(ALL_NETWORKS))).toEqual({
      name: 'reviewers',
      params: { slug: ALL_NETWORKS },
    })
  })

  it('sends an unknown slug to the list', () => {
    expect(requireChain('owners')(to('fantasy-net'))).toEqual({ name: 'owners', params: { slug: ALL_NETWORKS } })
  })

  it('treats a missing or repeated slug param as unknown', () => {
    expect(requireChain('agents')(to(undefined))).toEqual({ name: 'agents', params: { slug: ALL_NETWORKS } })
    expect(requireChain('agents')(to([SLUG, SLUG]))).toEqual({ name: 'agents', params: { slug: ALL_NETWORKS } })
  })
})

describe('requireScope', () => {
  it('lets `all` and a real chain slug through', () => {
    expect(requireScope(to(ALL_NETWORKS, 'owners'))).toBe(true)
    expect(requireScope(to(SLUG, 'owners'))).toBe(true)
  })

  it('keeps the page and falls back to all networks for an unknown slug', () => {
    expect(requireScope(to('fantasy-net', 'feedbacks'))).toEqual({
      name: 'feedbacks',
      params: { slug: ALL_NETWORKS },
    })
  })

  it('falls back to the agent list when the route has no name', () => {
    expect(requireScope(to('fantasy-net'))).toEqual({ name: 'agents', params: { slug: ALL_NETWORKS } })
  })
})
