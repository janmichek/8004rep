import {
  erc20Abi,
  keccak256,
  parseEventLogs,
  stringToBytes,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from 'viem'
import { newFeedbackEvent } from '../abi'
import { CHAINS, type ChainInfo } from '../chains'
import { errorMessage } from '../format'
import { fetchJsonUri, fetchUriBytes } from './metadata'
import { createLogsClient, createRpcClient } from './rpc'
import {
  isTxHash,
  readPaymentProof,
  type FileFacts,
  type PaymentFacts,
  type ReviewerFacts,
  type Transfer,
  type TxDetailFacts,
  type TxFacts,
  type UriScheme,
} from './txChecks'
import type { DataSource, Feedback } from './types'

/** Token transfers read from one payment; a payment has one or two. */
const MAX_TRANSFERS = 20
/** Other feedback files of the agent fetched to look for a reused payment. */
export const MAX_COMPARED_FILES = 50

export type BlockRef = { number: bigint; timestamp: number }

/** Case-insensitive, and unlike viem's `isAddressEqual` it never throws on a bad checksum. */
function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/**
 * Narrows [low, high] around the block mined at `timestamp` until it spans
 * at most `maxSpan` blocks, probing by interpolation and by bisection in
 * turn: interpolation lands within a step or two on steady block times,
 * bisection bounds the worst case. Null when `timestamp` is outside the
 * range or the probes run out.
 */
export async function bracketTimestamp(
  getBlock: (number: bigint) => Promise<BlockRef>,
  timestamp: number,
  low: BlockRef,
  high: BlockRef,
  maxSpan: bigint,
  maxProbes = 48,
): Promise<{ from: bigint; to: bigint } | null> {
  if (maxSpan < 1n || timestamp < low.timestamp || timestamp > high.timestamp) return null
  for (let probe = 0; high.number - low.number + 1n > maxSpan; probe++) {
    const gap = high.number - low.number
    // Two neighbours and room for one: keep the one mined at `timestamp`.
    if (gap < 2n) {
      const hit = timestamp === low.timestamp ? low.number : high.number
      return { from: hit, to: hit }
    }
    if (probe >= maxProbes) return null
    const seconds = high.timestamp - low.timestamp
    let guess =
      probe % 2 === 0 && seconds > 0
        ? low.number + (BigInt(timestamp - low.timestamp) * gap) / BigInt(seconds)
        : low.number + gap / 2n
    if (guess <= low.number) guess = low.number + 1n
    if (guess >= high.number) guess = high.number - 1n
    const block = await getBlock(guess)
    if (block.timestamp < timestamp) low = block
    else if (block.timestamp > timestamp) high = block
    else {
      // Fast chains mine several blocks a second: centre the window on the hit.
      let from = block.number - maxSpan / 2n
      if (from < low.number) from = low.number
      let to = from + maxSpan - 1n
      if (to > high.number) to = high.number
      return { from, to }
    }
  }
  return { from: low.number, to: high.number }
}

/** Log window small enough for the strictest public RPCs. */
const NARROW_SPAN = 100n
/** Blocks sampled below the head to measure the chain's pace. */
const PACE_SAMPLE = 1000n

/**
 * Block window of at most `maxSpan` blocks around `timestamp`, found by
 * walking back from the head: public RPCs prune old blocks, so nothing
 * older than the target is ever asked for. Null when `timestamp` is newer
 * than the head or older than `floor`.
 */
export async function windowAt(
  getBlock: (number: bigint) => Promise<BlockRef>,
  timestamp: number,
  head: BlockRef,
  floor: bigint,
  maxSpan: bigint,
): Promise<{ from: bigint; to: bigint } | null> {
  if (timestamp > head.timestamp || head.number < floor) return null
  const sample = head.number - floor < PACE_SAMPLE ? head.number - floor : PACE_SAMPLE
  let low = sample > 0n ? await getBlock(head.number - sample) : head
  let high = head
  if (low.timestamp > timestamp) {
    // Seconds per block near the head; the first jump aims just past the target.
    const pace = Math.max((head.timestamp - low.timestamp) / Number(sample), 0.05)
    let back = BigInt(Math.ceil(((head.timestamp - timestamp) / pace) * 1.02)) + 16n
    while (low.timestamp > timestamp && low.number > floor) {
      high = low
      low = await getBlock(head.number - back > floor ? head.number - back : floor)
      back *= 2n
    }
  }
  return bracketTimestamp(getBlock, timestamp, low, high, maxSpan)
}

/**
 * Transaction of a dated row whose hash the source does not carry (subgraph
 * rows): finds the block window of its date, then its `NewFeedback` log.
 */
async function locateTx(logs: PublicClient, chain: ChainInfo, tokenId: bigint, row: Feedback): Promise<Hex | undefined> {
  if (row.createdAt === undefined || row.index === undefined) return undefined
  const getBlock = async (blockNumber: bigint): Promise<BlockRef> => {
    const block = await logs.getBlock({ blockNumber })
    return { number: block.number, timestamp: Number(block.timestamp) }
  }
  const head = await logs.getBlock()
  const range = chain.logsLogRange ?? chain.logRange
  // RPCs lower their log range without notice: when the configured one is refused, ask for a narrow window.
  const spans = range > NARROW_SPAN ? [range, NARROW_SPAN] : [range]
  for (const [attempt, span] of spans.entries()) {
    const window = await windowAt(
      getBlock,
      row.createdAt,
      { number: head.number, timestamp: Number(head.timestamp) },
      chain.reputationFromBlock ?? 0n,
      span,
    )
    if (!window) return undefined
    try {
      const found = await logs.getLogs({
        address: chain.reputation,
        event: newFeedbackEvent,
        args: { agentId: tokenId, clientAddress: row.client },
        fromBlock: window.from,
        toBlock: window.to,
      })
      return found.find((log) => Number(log.args.feedbackIndex) === row.index)?.transactionHash
    } catch (err) {
      if (attempt === spans.length - 1) throw err
    }
  }
  return undefined
}

/** viem's one-line summary plus the node's own words ("pruned history unavailable…"), which say why. */
function reason(err: unknown): string {
  const details = (err as { details?: unknown } | null)?.details
  const summary = errorMessage(err)
  return typeof details === 'string' && details && !summary.includes(details) ? `${summary} (${details})` : summary
}

async function loadTx(
  client: PublicClient,
  chain: ChainInfo,
  tokenId: bigint,
  row: Feedback,
): Promise<Pick<TxDetailFacts, 'tx' | 'txNote'>> {
  let hash = row.txHash
  if (!hash) {
    try {
      const logs = chain.logsRpcUrl && chain.logsRpcUrl !== chain.rpcUrl ? createLogsClient(chain) : client
      hash = await locateTx(logs, chain, tokenId, row)
    } catch (err) {
      return { tx: null, txNote: `The transaction could not be looked up: ${reason(err)}` }
    }
  }
  if (!hash) {
    return {
      tx: null,
      txNote:
        row.createdAt === undefined
          ? 'This review is older than the log scan reaches, so its transaction is not known.'
          : 'No NewFeedback log of this review was found at its date.',
    }
  }
  try {
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ])
    const written = parseEventLogs({ abi: [newFeedbackEvent], logs: receipt.logs }).filter((log) =>
      sameAddress(log.address, chain.reputation),
    )
    const own = written.find(
      (log) =>
        log.args.agentId === tokenId &&
        sameAddress(log.args.clientAddress, row.client) &&
        (row.index === undefined || Number(log.args.feedbackIndex) === row.index),
    )
    // OP-stack receipts add the L1 data fee on top of the L2 gas.
    const l1Fee = (receipt as { l1Fee?: bigint | null }).l1Fee ?? 0n
    const tx: TxFacts = {
      hash,
      from: transaction.from,
      to: transaction.to,
      blockNumber: receipt.blockNumber,
      feeWei: receipt.gasUsed * receipt.effectiveGasPrice + l1Fee,
      feedbackLogs: written.length,
      ...(own ? { feedbackHash: own.args.feedbackHash } : {}),
      ...(own?.args.feedbackURI ? { feedbackURI: own.args.feedbackURI } : {}),
    }
    return { tx }
  } catch (err) {
    return { tx: null, txNote: `The transaction could not be loaded: ${reason(err)}` }
  }
}

export function schemeOf(uri: string): UriScheme {
  const match = /^(data|ipfs|https|http):/i.exec(uri.trim())
  return match ? (match[1].toLowerCase() as UriScheme) : 'other'
}

/**
 * JSON with object keys sorted at every level and no whitespace. Writers
 * commonly put the hash of this form in `feedbackHash`, while the pinned
 * file is pretty-printed.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === 'object' && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : inner,
  )
}

/** Fetches the file once: the bytes for the hash, then the JSON out of the same bytes. */
async function loadFile(uri: string): Promise<FileFacts> {
  const scheme = schemeOf(uri)
  let bytes: Uint8Array
  try {
    bytes = await fetchUriBytes(uri)
  } catch (err) {
    return { uri, scheme, error: errorMessage(err) }
  }
  const contentHash = keccak256(bytes)
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown
    return { uri, scheme, contentHash, canonicalHash: keccak256(stringToBytes(canonicalJson(json))), json }
  } catch (err) {
    return { uri, scheme, contentHash, error: errorMessage(err) }
  }
}

/** Native value and ERC-20 `Transfer` logs of a transaction. */
export function transfersOf(tx: { from: Address; to: Address | null; value: bigint }, logs: Log[]): Transfer[] {
  const native: Transfer[] = tx.value > 0n && tx.to ? [{ from: tx.from, to: tx.to, amount: tx.value, token: null }] : []
  // ERC-721 transfers share the signature but index the id, so they do not decode and are skipped.
  const tokens = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs })
    .slice(0, MAX_TRANSFERS)
    .map((log): Transfer => ({ from: log.args.from, to: log.args.to, amount: log.args.value, token: log.address }))
  return [...native, ...tokens]
}

/** Adds symbol and decimals to token transfers; a token that answers neither is left bare. */
async function withTokenInfo(client: PublicClient, transfers: Transfer[]): Promise<Transfer[]> {
  const tokens = [...new Set(transfers.flatMap((t) => (t.token ? [t.token] : [])))]
  const info = new Map(
    await Promise.all(
      tokens.map(async (address) => {
        const [symbol, decimals] = await Promise.all([
          client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }).catch(() => undefined),
          client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }).catch(() => undefined),
        ])
        return [address, { ...(symbol ? { symbol } : {}), ...(decimals !== undefined ? { decimals } : {}) }] as const
      }),
    ),
  )
  return transfers.map((t) => (t.token ? { ...t, ...info.get(t.token) } : t))
}

async function loadPaymentTx(client: PublicClient, hash: Hex, withTime: boolean): Promise<Pick<PaymentFacts, 'tx' | 'error'>> {
  try {
    const [transaction, receipt] = await Promise.all([
      client.getTransaction({ hash }),
      client.getTransactionReceipt({ hash }),
    ])
    const transfers = await withTokenInfo(client, transfersOf(transaction, receipt.logs))
    // Block numbers order two transactions of one chain; across chains only time does.
    const timestamp = withTime
      ? Number((await client.getBlock({ blockNumber: receipt.blockNumber })).timestamp)
      : undefined
    return {
      tx: {
        found: true,
        reverted: receipt.status === 'reverted',
        blockNumber: receipt.blockNumber,
        ...(timestamp !== undefined ? { timestamp } : {}),
        transfers,
      },
    }
  } catch (err) {
    if (err instanceof TransactionNotFoundError || err instanceof TransactionReceiptNotFoundError) {
      return { tx: { found: false, transfers: [] } }
    }
    return { error: `The payment could not be looked up: ${reason(err)}` }
  }
}

/** How many of `others` cite the payment `hash` in their feedback file. */
async function countReuse(hash: Hex, client: Address, others: Feedback[]) {
  const withFile = others.filter((f) => f.feedbackURI).slice(0, MAX_COMPARED_FILES)
  const files = await Promise.allSettled(withFile.map((f) => fetchJsonUri(f.feedbackURI)))
  let comparedFiles = 0
  let reusedByOthers = 0
  let reusedBySame = 0
  files.forEach((file, i) => {
    if (file.status !== 'fulfilled' || file.value == null) return
    comparedFiles++
    if (readPaymentProof(file.value)?.txHash?.toLowerCase() !== hash.toLowerCase()) return
    if (sameAddress(withFile[i].client, client)) reusedBySame++
    else reusedByOthers++
  })
  return { comparedFiles, reusedByOthers, reusedBySame }
}

async function loadPayment(
  json: unknown,
  chain: ChainInfo,
  client: PublicClient,
  row: Feedback,
  others: Feedback[],
): Promise<PaymentFacts | null> {
  const proof = readPaymentProof(json)
  if (!proof) return null
  const chainId = proof.chainId ?? chain.chainId
  const hash = proof.txHash
  if (!isTxHash(hash)) return { proof, chainId, reusedByOthers: 0, reusedBySame: 0, comparedFiles: 0 }
  const sameChain = chainId === chain.chainId
  const paidOn = sameChain ? chain : CHAINS.find((c) => c.chainId === chainId)
  const [lookup, reuse] = await Promise.all([
    paidOn ? loadPaymentTx(sameChain ? client : createRpcClient(paidOn), hash, !sameChain) : {},
    countReuse(hash, row.client, others),
  ])
  return { proof, chainId, ...lookup, ...reuse }
}

async function loadReviewer(client: PublicClient, source: DataSource, address: Address): Promise<ReviewerFacts> {
  const [nonce, code, feed] = await Promise.allSettled([
    client.getTransactionCount({ address }),
    client.getCode({ address }),
    source.listFeedback({ client: address }),
  ])
  const bytecode = code.status === 'fulfilled' ? (code.value ?? '0x') : undefined
  return {
    ...(nonce.status === 'fulfilled' ? { nonce: nonce.value } : {}),
    ...(bytecode !== undefined
      ? // 0xef0100 ‖ address is an EIP-7702 delegation: still an EOA, with code attached.
        { kind: bytecode === '0x' ? 'eoa' : bytecode.toLowerCase().startsWith('0xef0100') ? 'delegated' : 'contract' }
      : {}),
    ...(feed.status === 'fulfilled'
      ? {
          rows: feed.value.items.map(({ tokenId, value, revoked }) => ({ tokenId, value, revoked })),
          ...(feed.value.cursor ? { rowsTruncated: true } : {}),
          ...(feed.value.since !== undefined ? { rowsSince: feed.value.since } : {}),
        }
      : {}),
  }
}

export type TxDetailQuery = {
  chain: ChainInfo
  /** Contract and transaction reads on `chain`. */
  client: PublicClient
  source: DataSource
  tokenId: bigint
  row: Feedback
  /** Every feedback row of the agent, `row` included. */
  feedback: Feedback[]
}

/**
 * Reads everything the tx detail checks need about one feedback row: its
 * transaction, its feedback file, the payment that file cites and the
 * reviewer's account. Never rejects — what could not be read is left out
 * and shows as "unknown".
 */
export async function loadTxFacts({ chain, client, source, tokenId, row, feedback }: TxDetailQuery): Promise<TxDetailFacts> {
  const [located, reviewer] = await Promise.all([
    loadTx(client, chain, tokenId, row),
    loadReviewer(client, source, row.client),
  ])
  // Rows read without the event log have no URI of their own; the receipt has it.
  const uri = row.feedbackURI ?? located.tx?.feedbackURI
  const file = uri ? await loadFile(uri) : null
  const payment = file ? await loadPayment(file.json, chain, client, row, feedback.filter((f) => f !== row)) : null
  return { ...located, file, payment, reviewer }
}
