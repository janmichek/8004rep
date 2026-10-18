import type { Address, Hex, PublicClient } from 'viem'
import { feedbackRevokedEvent, newFeedbackEvent, responseAppendedEvent } from '../abi'
import type { ChainInfo } from '../chains'
import type { Feedback, FeedbackEvent, FeedbackResponse } from './types'

/** Windows scanned per step; 8 × Mantle's 10k range ≈ 2 days back. */
export const SCAN_CHUNKS = 8
/** Log/block requests in flight at once. */
const SCAN_CONCURRENCY = 4

export type BlockWindow = { from: bigint; to: bigint }

export type ScanQuery = { agent?: bigint; client?: Address; cursor?: string }

export type ScanResult = {
  items: FeedbackEvent[]
  /** Opaque; absent = nothing older. */
  cursor?: string
  /** Unix seconds the scan reached. */
  since?: number
}

/**
 * Up to `chunks` consecutive [from, to] windows ending at `toBlock`,
 * each at most `range` blocks, never below `floor`.
 */
export function scanWindows(toBlock: bigint, range: bigint, chunks: number, floor: bigint): BlockWindow[] {
  if (range < 1n || chunks < 1 || toBlock < floor) return []
  const windows: BlockWindow[] = []
  let to = toBlock
  while (windows.length < chunks && to >= floor) {
    const from = to - range + 1n < floor ? floor : to - range + 1n
    windows.push({ from, to })
    if (from <= floor) break
    to = from - 1n
  }
  return windows
}

/** Decoded `NewFeedback` log, structurally (real viem logs satisfy this). */
export type NewFeedbackLog = {
  args: {
    agentId?: bigint
    clientAddress?: Address
    feedbackIndex?: bigint
    value?: bigint
    valueDecimals?: number
    tag1?: string
    tag2?: string
    endpoint?: string
    feedbackURI?: string
  }
  blockNumber: bigint
  logIndex: number
  transactionHash: Hex
  /** Some RPCs attach it; Arbitrum Sepolia reports 0, which means "look it up". */
  blockTimestamp?: bigint | null
}

export type RevokedLog = {
  args: { agentId?: bigint; clientAddress?: Address; feedbackIndex?: bigint }
}

type ScannedRow = Omit<FeedbackEvent, 'createdAt'> & {
  blockNumber: bigint
  logIndex: number
  blockTimestamp?: bigint | null
}

/** Log → feed row; `createdAt` is attached later (it may need a `getBlock`). */
export function mapNewFeedbackLog(log: NewFeedbackLog): ScannedRow {
  const { agentId = 0n, clientAddress = '0x0000000000000000000000000000000000000000' as Address } = log.args
  const { feedbackIndex = 0n, value = 0n, valueDecimals = 0 } = log.args
  return {
    tokenId: agentId,
    client: clientAddress,
    index: Number(feedbackIndex),
    value: Number(value) / 10 ** valueDecimals,
    ...(log.args.tag1 ? { tag1: log.args.tag1 } : {}),
    ...(log.args.tag2 ? { tag2: log.args.tag2 } : {}),
    ...(log.args.endpoint ? { endpoint: log.args.endpoint } : {}),
    ...(log.args.feedbackURI ? { feedbackURI: log.args.feedbackURI } : {}),
    revoked: false,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    ...(log.blockTimestamp != null ? { blockTimestamp: log.blockTimestamp } : {}),
  }
}

function revocationKey(agentId: bigint, client: Address, index: bigint): string {
  return `${agentId}:${client.toLowerCase()}:${index}`
}

/** Marks rows whose (agent, client, index) appears in `FeedbackRevoked` logs. */
export function markRevoked<T extends ScannedRow | FeedbackEvent>(
  rows: T[],
  revoked: RevokedLog[],
): T[] {
  if (revoked.length === 0) return rows
  const gone = new Set(
    revoked.map((log) =>
      revocationKey(log.args.agentId ?? 0n, log.args.clientAddress ?? '0x0', log.args.feedbackIndex ?? 0n),
    ),
  )
  return rows.map((row) =>
    row.index !== undefined && gone.has(revocationKey(row.tokenId, row.client, BigInt(row.index)))
      ? { ...row, revoked: true }
      : row,
  )
}

type BaseRow = Pick<Feedback, 'client' | 'index'>

/**
 * Fills bare `readAllFeedback` rows with what an indexed source (the log
 * scan, or a subgraph) knows about the same (client, index): date,
 * endpoint, comment URI and transaction.
 */
export function mergeFeedback<T extends BaseRow>(base: T[], scanned: Feedback[]): T[] {
  if (scanned.length === 0) return base
  const byKey = new Map(scanned.map((s) => [`${s.client.toLowerCase()}:${s.index ?? -1}`, s]))
  return base.map((row) => {
    const extra = byKey.get(`${row.client.toLowerCase()}:${row.index ?? -1}`)
    if (!extra) return row
    return {
      ...row,
      ...(extra.createdAt !== undefined ? { createdAt: extra.createdAt } : {}),
      ...(!('endpoint' in row && row.endpoint) && extra.endpoint ? { endpoint: extra.endpoint } : {}),
      ...(!('feedbackURI' in row && row.feedbackURI) && extra.feedbackURI
        ? { feedbackURI: extra.feedbackURI }
        : {}),
      ...(extra.txHash ? { txHash: extra.txHash } : {}),
      ...(extra.responses?.length && !('responses' in row && row.responses) ? { responses: extra.responses } : {}),
    }
  })
}

async function pool<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (next < tasks.length) {
      const current = next++
      results[current] = await tasks[current]()
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Bounded `NewFeedback` scan: up to SCAN_CHUNKS windows ending at `cursor`
 * (or the head), then older steps on demand via the returned cursor.
 * A window that fails rejects the whole scan — partial results are never
 * shown as if complete.
 */
export async function scanFeedback(
  client: PublicClient,
  chain: ChainInfo,
  query: ScanQuery = {},
): Promise<ScanResult> {
  const head = await client.getBlockNumber()
  let to = query.cursor && /^\d+$/.test(query.cursor) ? BigInt(query.cursor) : head
  if (to > head) to = head
  const range = chain.logsLogRange ?? chain.logRange
  const floor = chain.reputationFromBlock ?? 0n
  const windows = scanWindows(to, range, SCAN_CHUNKS, floor)
  if (windows.length === 0) return { items: [] }

  const args = {
    ...(query.agent !== undefined ? { agentId: query.agent } : {}),
    ...(query.client ? { clientAddress: query.client } : {}),
  }
  const tasks: Array<() => Promise<unknown>> = windows.flatMap((w) => [
    () =>
      client.getLogs({
        address: chain.reputation,
        event: newFeedbackEvent,
        args,
        fromBlock: w.from,
        toBlock: w.to,
      }),
    () =>
      client.getLogs({
        address: chain.reputation,
        event: feedbackRevokedEvent,
        args,
        fromBlock: w.from,
        toBlock: w.to,
      }),
  ])
  const results = await pool(tasks, SCAN_CONCURRENCY)
  const given: NewFeedbackLog[] = []
  const revoked: RevokedLog[] = []
  for (let i = 0; i < windows.length; i++) {
    given.push(...(results[2 * i] as NewFeedbackLog[]))
    revoked.push(...(results[2 * i + 1] as RevokedLog[]))
  }

  const rows = markRevoked(given.map(mapNewFeedbackLog), revoked).sort(
    (a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : b.logIndex - a.logIndex),
  )

  // Dates: Arbitrum Sepolia logs carry blockTimestamp 0, so fall back to getBlock.
  const times = new Map<bigint, number>()
  async function timestampOf(blockNumber: bigint, hint?: bigint | null): Promise<number> {
    if (hint) return Number(hint)
    const cached = times.get(blockNumber)
    if (cached !== undefined) return cached
    const block = await client.getBlock({ blockNumber })
    const timestamp = Number(block.timestamp)
    times.set(blockNumber, timestamp)
    return timestamp
  }
  const items = await pool(
    rows.map((row) => async () => {
      const { blockNumber, logIndex: _logIndex, blockTimestamp, ...rest } = row
      void _logIndex
      return { ...rest, createdAt: await timestampOf(blockNumber, blockTimestamp ?? null) }
    }),
    SCAN_CONCURRENCY,
  )

  const oldestFrom = windows[windows.length - 1].from
  return {
    items,
    ...(oldestFrom > floor ? { cursor: (oldestFrom - 1n).toString() } : {}),
    since: await timestampOf(oldestFrom),
  }
}

export type ResponseLog = {
  args: { clientAddress?: Address; feedbackIndex?: bigint; responder?: Address; responseURI?: string }
  blockNumber: bigint
  logIndex: number
  transactionHash: Hex
  blockTimestamp?: bigint | null
}

/** Responses keyed by `client:index`, oldest first. */
export type ResponseMap = Map<string, FeedbackResponse[]>

export function responseKey(client: string, index: number | bigint | undefined): string {
  return `${client.toLowerCase()}:${index ?? -1}`
}

export function groupResponses(logs: ResponseLog[]): ResponseMap {
  const sorted = [...logs].sort((a, b) =>
    a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : a.logIndex - b.logIndex,
  )
  const map: ResponseMap = new Map()
  for (const log of sorted) {
    const { clientAddress, feedbackIndex, responder, responseURI } = log.args
    if (!clientAddress || feedbackIndex === undefined || !responder) continue
    const key = responseKey(clientAddress, feedbackIndex)
    const entry: FeedbackResponse = {
      responder,
      ...(responseURI ? { uri: responseURI } : {}),
      ...(log.blockTimestamp ? { createdAt: Number(log.blockTimestamp) } : {}),
      txHash: log.transactionHash,
    }
    map.set(key, [...(map.get(key) ?? []), entry])
  }
  return map
}

/** Attaches responses to the rows they answer; rows keep any responses they already carry. */
export function attachResponses<T extends Feedback>(rows: T[], responses: ResponseMap): T[] {
  if (responses.size === 0) return rows
  return rows.map((row) => {
    const found = responses.get(responseKey(row.client, row.index))
    return found && !row.responses?.length ? { ...row, responses: found } : row
  })
}

/** `ResponseAppended` logs of one agent over the same bounded windows as `scanFeedback`. */
export async function scanResponses(client: PublicClient, chain: ChainInfo, agent: bigint): Promise<ResponseMap> {
  const head = await client.getBlockNumber()
  const windows = scanWindows(head, chain.logsLogRange ?? chain.logRange, SCAN_CHUNKS, chain.reputationFromBlock ?? 0n)
  const results = await pool(
    windows.map((w) => () =>
      client.getLogs({
        address: chain.reputation,
        event: responseAppendedEvent,
        args: { agentId: agent },
        fromBlock: w.from,
        toBlock: w.to,
      }),
    ),
    SCAN_CONCURRENCY,
  )
  return groupResponses(results.flat() as ResponseLog[])
}
