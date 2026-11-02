import { describe, expect, it, vi } from 'vitest'
import { computed, shallowRef } from 'vue'
import { CHAINS, type ChainInfo } from './chains'
import { useChainLoad } from './useChainLoad'

const [a, b] = CHAINS as [ChainInfo, ChainInfo]

/** A stand-in for `useScope`: the same shape, without a router. */
function scopeOf(chains: ChainInfo[]) {
  // shallowRef, like the real `computed`: deep reactivity would proxy the chain
  // objects and break the identity the loaders rely on.
  const list = shallowRef(chains)
  return {
    scope: {
      all: computed(() => false),
      chains: computed(() => list.value),
      key: computed(() => list.value.map((c) => c.chainId).join(',')),
    },
    set: (next: ChainInfo[]) => void (list.value = next),
  }
}

/** Waits for the watcher's load to settle without depending on its duration. */
async function settle(check: () => boolean): Promise<void> {
  await vi.waitFor(() => {
    if (!check()) throw new Error('not settled')
  })
}

describe('useChainLoad', () => {
  it('loads every chain and keys the values by chain id', async () => {
    const { scope } = scopeOf([a, b])
    const loadOne = vi.fn(async (chain: ChainInfo) => `rows:${chain.chainId}`)

    const { values, loaded } = useChainLoad(scope, loadOne)
    await settle(() => loaded.value)

    expect(loadOne).toHaveBeenCalledTimes(2)
    expect(values.value[a.chainId]).toBe(`rows:${a.chainId}`)
    expect(values.value[b.chainId]).toBe(`rows:${b.chainId}`)
  })

  it('drops the old chains when the scope changes, keeping only the new ones', async () => {
    const { scope, set } = scopeOf([a, b])
    const { values, loaded } = useChainLoad(scope, async (chain) => `rows:${chain.chainId}`)
    await settle(() => loaded.value)

    set([b])
    await settle(() => Object.keys(values.value).length === 1)

    expect(values.value[a.chainId]).toBeUndefined()
    expect(values.value[b.chainId]).toBe(`rows:${b.chainId}`)
  })

  it('passes the previous value only when extending, and merges it into the same chain', async () => {
    const { scope } = scopeOf([a])
    const loadOne = vi.fn(async (_chain: ChainInfo, previous: string[] | undefined) => [
      ...(previous ?? []),
      `page${(previous?.length ?? 0) + 1}`,
    ])

    const { values, load } = useChainLoad<string[]>(scope, loadOne)
    await settle(() => loadOne.mock.calls.length === 1)
    expect(loadOne).toHaveBeenLastCalledWith(a, undefined)

    await load(true)
    expect(loadOne).toHaveBeenLastCalledWith(a, ['page1'])
    expect(values.value[a.chainId]).toEqual(['page1', 'page2'])
  })

  it('ignores a slower earlier run when the scope changes under it', async () => {
    const { scope, set } = scopeOf([a])
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const loadOne = vi.fn(async (chain: ChainInfo) => {
      if (chain === a) await gate
      return `rows:${chain.chainId}`
    })

    const { values } = useChainLoad(scope, loadOne)
    set([b])
    await settle(() => values.value[b.chainId] === `rows:${b.chainId}`)

    release()
    await Promise.resolve()
    await Promise.resolve()

    expect(values.value[a.chainId]).toBeUndefined()
    expect(values.value[b.chainId]).toBe(`rows:${b.chainId}`)
  })

  it('keeps the rows on screen when an extend fails outright, reporting it as a partial failure', async () => {
    const { scope } = scopeOf([a])
    let fail = false
    const { values, error, failed, load } = useChainLoad(scope, async (chain) => {
      if (fail) throw new Error('rpc down')
      return `rows:${chain.chainId}`
    })
    await settle(() => values.value[a.chainId] !== undefined)

    fail = true
    await load(true)

    // The window the user paged to must survive a dropped connection.
    expect(values.value[a.chainId]).toBe(`rows:${a.chainId}`)
    expect(error.value).toBeUndefined()
    expect(failed.value).toHaveLength(1)
  })

  it('falls back to the error state when a plain reload finds nothing', async () => {
    const { scope } = scopeOf([a])
    let fail = false
    const { error, load } = useChainLoad(scope, async (chain) => {
      if (fail) throw new Error('rpc down')
      return `rows:${chain.chainId}`
    })
    await settle(() => !fail)

    fail = true
    await load()

    expect(error.value).toBe(`${a.name}: rpc down`)
  })

  it('clears a stale failure once every chain answers again', async () => {
    const { scope } = scopeOf([a, b])
    let fail = true
    const { failed, load } = useChainLoad(scope, async (chain) => {
      if (fail && chain === a) throw new Error('rpc down')
      return 'ok'
    })
    await settle(() => failed.value.length === 1)

    fail = false
    await load()

    expect(failed.value).toEqual([])
  })

  it('reports the first failure only when nothing loaded, and a partial failure otherwise', async () => {
    const { scope } = scopeOf([a, b])
    const { failed, error } = useChainLoad(scope, async (chain) => {
      if (chain === a) throw new Error('rpc down')
      return 'ok'
    })
    await settle(() => failed.value.length === 1)

    expect(error.value).toBeUndefined()
    expect(failed.value[0]).toMatchObject({ chain: a, message: 'rpc down' })

    const { scope: onlyA } = scopeOf([a])
    const all = useChainLoad(onlyA, async () => {
      throw new Error('rpc down')
    })
    await settle(() => Boolean(all.error.value))

    expect(all.error.value).toBe(`${a.name}: rpc down`)
  })
})
