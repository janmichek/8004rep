import { describe, expect, it, vi } from 'vitest'
import type { Address, Hex } from 'viem'
import { loadFeedWindow, type FeedWindow } from './feed'
import type { DataSource, FeedbackEvent, FeedbackPage } from './types'

const A: Address = '0x00000000000000000000000000000000000000a1'

function row(index: number | undefined, tokenId = 1n, extra: Partial<FeedbackEvent> = {}): FeedbackEvent {
  return { client: A, value: 80, revoked: false, tokenId, ...(index !== undefined ? { index } : {}), ...extra }
}

/** A source that answers `listFeedback` with the given pages, in order. */
function sourceOf(pages: FeedbackPage[]) {
  const seen: (string | undefined)[] = []
  const listFeedback = vi.fn(async ({ cursor }: { cursor?: string }) => {
    seen.push(cursor)
    return pages[seen.length - 1] ?? { items: [] }
  })
  return { source: { listFeedback } as unknown as DataSource, seen, listFeedback }
}

describe('loadFeedWindow', () => {
  it('stops once the row target is met, leaving the cursor for later', async () => {
    const { source, listFeedback } = sourceOf([
      { items: [row(1), row(2)], cursor: 'c1' },
      { items: [row(3)], cursor: 'c2' },
    ])
    const window = await loadFeedWindow(source, {}, { minRows: 2, maxSteps: 5 })
    expect(listFeedback).toHaveBeenCalledTimes(1)
    expect(window.items).toHaveLength(2)
    expect(window.cursor).toBe('c1')
  })

  it('pages until the target is met and follows the cursor it was given', async () => {
    const { source, seen } = sourceOf([
      { items: [row(1)], cursor: 'c1' },
      { items: [row(2)], cursor: 'c2' },
      { items: [row(3)], cursor: 'c3' },
    ])
    const window = await loadFeedWindow(source, {}, { minRows: 3, maxSteps: 5 })
    expect(seen).toEqual([undefined, 'c1', 'c2'])
    expect(window.items).toHaveLength(3)
  })

  it('stops when the source runs out, and reports no cursor', async () => {
    const { source, listFeedback } = sourceOf([{ items: [row(1)] }])
    const window = await loadFeedWindow(source, {}, { minRows: 50, maxSteps: 5 })
    expect(listFeedback).toHaveBeenCalledTimes(1)
    expect(window.cursor).toBeUndefined()
  })

  it('gives up after maxSteps, keeping the cursor so the user can ask for more', async () => {
    const { source, listFeedback } = sourceOf([
      { items: [row(1)], cursor: 'c1' },
      { items: [row(2)], cursor: 'c2' },
    ])
    const window = await loadFeedWindow(source, {}, { minRows: 99, maxSteps: 2 })
    expect(listFeedback).toHaveBeenCalledTimes(2)
    expect(window.items).toHaveLength(2)
    expect(window.cursor).toBe('c2')
  })

  it('passes the query through on every page', async () => {
    const { source, listFeedback } = sourceOf([{ items: [], cursor: 'c1' }, { items: [] }])
    await loadFeedWindow(source, { client: A }, { minRows: 10, maxSteps: 3 })
    expect(listFeedback).toHaveBeenNthCalledWith(1, { client: A })
    expect(listFeedback).toHaveBeenNthCalledWith(2, { client: A, cursor: 'c1' })
  })

  it('keeps the newest `since` it saw and leaves it out when no page reported one', async () => {
    const withSince = sourceOf([{ items: [row(1)], cursor: 'c1', since: 100 }, { items: [row(2)] }])
    expect((await loadFeedWindow(withSince.source, {}, { minRows: 9, maxSteps: 3 })).since).toBe(100)

    const without = sourceOf([{ items: [row(1)] }])
    expect('since' in (await loadFeedWindow(without.source, {}, { minRows: 9, maxSteps: 3 }))).toBe(false)
  })

  it('returns an exhausted window untouched, without asking the source again', async () => {
    const { source, listFeedback } = sourceOf([{ items: [row(9)] }])
    const done: FeedWindow = { items: [row(1)] }
    expect(await loadFeedWindow(source, {}, { from: done })).toBe(done)
    expect(listFeedback).not.toHaveBeenCalled()
  })

  it('extends a window from its cursor and counts the target from what it already holds', async () => {
    const { source, seen } = sourceOf([{ items: [row(2)], cursor: 'c2' }])
    const window = await loadFeedWindow(
      source,
      {},
      { minRows: 1, maxSteps: 5, from: { items: [row(1)], cursor: 'c1' } },
    )
    expect(seen).toEqual(['c1'])
    expect(window.items.map((r) => r.index)).toEqual([1, 2])
  })

  it('drops a row the window already holds, so an overlapping page does not count twice', async () => {
    const { source } = sourceOf([{ items: [row(1), row(2)], cursor: 'c2' }])
    const window = await loadFeedWindow(source, {}, { minRows: 1, from: { items: [row(1)], cursor: 'c1' } })
    expect(window.items.map((r) => r.index)).toEqual([1, 2])
  })

  it('tells rows of the same index apart by agent and by chain', async () => {
    const { source } = sourceOf([
      { items: [row(1, 1n), row(1, 2n), { ...row(1, 1n), chainId: 8453 }] },
    ])
    const window = await loadFeedWindow(source, {}, { minRows: 1 })
    expect(window.items).toHaveLength(3)
  })

  it('dedupes a log-scanned row by its transaction when it carries no index', async () => {
    const tx = '0xaa' as Hex
    const { source } = sourceOf([{ items: [row(undefined, 1n, { txHash: tx })], cursor: 'c2' }])
    const window = await loadFeedWindow(
      source,
      {},
      { minRows: 1, from: { items: [row(undefined, 1n, { txHash: tx })], cursor: 'c1' } },
    )
    expect(window.items).toHaveLength(1)
  })

  it('keeps rows it cannot tell apart, rather than guessing they are the same', async () => {
    const { source } = sourceOf([{ items: [row(undefined), row(undefined)] }])
    const window = await loadFeedWindow(source, {}, { minRows: 1 })
    expect(window.items).toHaveLength(2)
  })

  it('folds address case when matching a row it already holds', async () => {
    const upper = A.toUpperCase().replace('0X', '0x') as Address
    const { source } = sourceOf([{ items: [{ ...row(1), client: upper }], cursor: 'c2' }])
    const window = await loadFeedWindow(source, {}, { minRows: 1, from: { items: [row(1)], cursor: 'c1' } })
    expect(window.items).toHaveLength(1)
  })
})
