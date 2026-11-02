import type { DataSource, FeedbackEvent, FeedbackQuery } from './types'

export type FeedWindow = {
  items: FeedbackEvent[]
  /** Continue from here; absent = nothing older. */
  cursor?: string
  /** Unix seconds the log scan reached; log scan only. */
  since?: number
}

/**
 * Identity of a feedback row, when the source gives one: `(client, index)` per
 * agent, or the transaction for a log-scanned row. Undefined means the row
 * cannot be told apart from a genuine repeat, so it is always kept.
 */
function rowKey(r: FeedbackEvent): string | undefined {
  const client = r.client.toLowerCase()
  if (r.index !== undefined) return `${r.chainId ?? ''}:${r.tokenId}:${client}:${r.index}`
  return r.txHash ? `tx:${r.txHash}:${r.tokenId}:${client}` : undefined
}

/**
 * Pages through `listFeedback` until `minRows` are in, the source runs out,
 * or `maxSteps` requests were made. Pass the previous window to extend it.
 *
 * Rows the window already holds are dropped: a source that gains rows between
 * two requests shifts its own cursor, and a repeated row would otherwise count
 * twice in every average and flag built on the window.
 */
export async function loadFeedWindow(
  source: DataSource,
  query: Omit<FeedbackQuery, 'cursor'>,
  { minRows = 200, maxSteps = 8, from }: { minRows?: number; maxSteps?: number; from?: FeedWindow } = {},
): Promise<FeedWindow> {
  // An earlier window without a cursor already reached the oldest row.
  if (from && from.cursor === undefined) return from
  const items = [...(from?.items ?? [])]
  const seen = new Set(items.flatMap((r) => rowKey(r) ?? []))
  let cursor = from?.cursor
  let since = from?.since
  const target = items.length + minRows
  for (let step = 0; step < maxSteps; step++) {
    const page = await source.listFeedback({ ...query, ...(cursor ? { cursor } : {}) })
    for (const row of page.items) {
      const key = rowKey(row)
      if (key !== undefined) {
        if (seen.has(key)) continue
        seen.add(key)
      }
      items.push(row)
    }
    cursor = page.cursor
    if (page.since !== undefined) since = page.since
    if (!cursor || items.length >= target) break
  }
  return { items, ...(cursor ? { cursor } : {}), ...(since !== undefined ? { since } : {}) }
}
