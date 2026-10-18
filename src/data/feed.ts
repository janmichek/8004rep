import type { DataSource, FeedbackEvent, FeedbackQuery } from './types'

export type FeedWindow = {
  items: FeedbackEvent[]
  /** Continue from here; absent = nothing older. */
  cursor?: string
  /** Unix seconds the log scan reached; log scan only. */
  since?: number
}

/**
 * Pages through `listFeedback` until `minRows` are in, the source runs out,
 * or `maxSteps` requests were made. Pass the previous window to extend it.
 */
export async function loadFeedWindow(
  source: DataSource,
  query: Omit<FeedbackQuery, 'cursor'>,
  { minRows = 200, maxSteps = 8, from }: { minRows?: number; maxSteps?: number; from?: FeedWindow } = {},
): Promise<FeedWindow> {
  // An earlier window without a cursor already reached the oldest row.
  if (from && from.cursor === undefined) return from
  const items = [...(from?.items ?? [])]
  let cursor = from?.cursor
  let since = from?.since
  const target = items.length + minRows
  for (let step = 0; step < maxSteps; step++) {
    const page = await source.listFeedback({ ...query, ...(cursor ? { cursor } : {}) })
    items.push(...page.items)
    cursor = page.cursor
    if (page.since !== undefined) since = page.since
    if (!cursor || items.length >= target) break
  }
  return { items, ...(cursor ? { cursor } : {}), ...(since !== undefined ? { since } : {}) }
}
