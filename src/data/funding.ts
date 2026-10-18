import type { Address, Hex } from 'viem'
import type { ChainInfo } from '../chains'

const FETCH_TIMEOUT_MS = 10_000
/** Oldest transactions read per address; the funding transfer is almost always among them. */
const FIRST_TXS = 25

/** The transfer that first put native currency into an address. */
export type Funding = {
  funder: Address
  txHash: Hex
  /** Unix seconds. */
  timestamp?: number
  /** Wei. */
  value: bigint
  /** True when the value came through a contract call (internal transaction). */
  internal: boolean
}

type ExplorerTx = {
  from?: unknown
  to?: unknown
  value?: unknown
  hash?: unknown
  transactionHash?: unknown
  timeStamp?: unknown
  blockNumber?: unknown
  isError?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function txsOf(body: unknown): ExplorerTx[] {
  return isRecord(body) && Array.isArray(body.result) ? body.result.filter(isRecord) : []
}

/**
 * Earliest successful transfer of value > 0 into `address`, from the
 * `result` arrays of an Etherscan-compatible `txlist` and `txlistinternal`.
 * Null when neither holds one. Never throws.
 */
export function firstFunding(address: string, txlist: unknown, internal: unknown): Funding | null {
  const target = address.toLowerCase()
  const candidates = [
    ...txsOf(txlist).map((tx) => ({ tx, internal: false })),
    ...txsOf(internal).map((tx) => ({ tx, internal: true })),
  ].flatMap(({ tx, internal }) => {
    const to = typeof tx.to === 'string' ? tx.to.toLowerCase() : ''
    const from = typeof tx.from === 'string' ? tx.from : ''
    const hash = typeof tx.hash === 'string' ? tx.hash : typeof tx.transactionHash === 'string' ? tx.transactionHash : ''
    let value = 0n
    try {
      value = BigInt(typeof tx.value === 'string' ? tx.value : '0')
    } catch {
      return []
    }
    if (to !== target || value <= 0n || tx.isError === '1' || !/^0x[0-9a-f]{40}$/i.test(from) || !hash) return []
    return [
      {
        funder: from as Address,
        txHash: hash as Hex,
        value,
        internal,
        block: Number(tx.blockNumber ?? Infinity),
        timestamp: Number(tx.timeStamp),
      },
    ]
  })
  const first = candidates.sort((a, b) => a.block - b.block || a.timestamp - b.timestamp)[0]
  if (!first) return null
  return {
    funder: first.funder,
    txHash: first.txHash,
    value: first.value,
    internal: first.internal,
    ...(Number.isFinite(first.timestamp) && first.timestamp > 0 ? { timestamp: first.timestamp } : {}),
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Explorer answered ${res.status}`)
  return res.json()
}

const cache = new Map<string, Promise<Funding | null>>()

/** Null when no funding transfer is found; rejects when the explorer cannot be read. */
export function fetchFunding(chain: ChainInfo & { explorerApiUrl: string }, address: Address): Promise<Funding | null> {
  const key = `${chain.chainId}:${address.toLowerCase()}`
  let hit = cache.get(key)
  if (!hit) {
    const query = (action: string) =>
      `${chain.explorerApiUrl}?module=account&action=${action}&address=${address}&sort=asc&page=1&offset=${FIRST_TXS}`
    hit = Promise.all([getJson(query('txlist')), getJson(query('txlistinternal'))]).then(([txs, internal]) =>
      firstFunding(address, txs, internal),
    )
    hit.catch(() => cache.delete(key))
    cache.set(key, hit)
  }
  return hit
}

export type FunderCluster = {
  funder: Address
  /** Reviewers this address funded first. */
  reviewers: Address[]
  /** The funder is the agent's owner or agent wallet. */
  self: boolean
}

/**
 * Reviewers grouped by the address that first funded them. Kept: groups of
 * two or more, and any group funded by the agent itself.
 */
export function clusterByFunder(
  fundings: { reviewer: Address; funding: Funding | null }[],
  self: readonly string[] = [],
): FunderCluster[] {
  const selves = new Set(self.map((a) => a.toLowerCase()))
  const groups = new Map<string, { funder: Address; reviewers: Address[] }>()
  for (const { reviewer, funding } of fundings) {
    if (!funding) continue
    const key = funding.funder.toLowerCase()
    const group = groups.get(key) ?? { funder: funding.funder, reviewers: [] }
    group.reviewers.push(reviewer)
    groups.set(key, group)
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ ...g, self: selves.has(key) }))
    .filter((g) => g.self || g.reviewers.length >= 2)
    .sort((a, b) => Number(b.self) - Number(a.self) || b.reviewers.length - a.reviewers.length)
}
