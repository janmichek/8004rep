import type { Address, Hex } from 'viem'
import { formatAmount, formatDate, formatDuration, formatScore, shortAddress } from '../format'
import { FLAG_INFO, type FeedbackStats } from './feedbackStats'
import type { Feedback } from './types'

/** An EOA that sent fewer transactions than this is a fresh wallet. */
export const MIN_NONCE = 5
/** Herfindahl index above which a few reviewers dominate (the antitrust "highly concentrated" line). */
export const HHI_CONCENTRATED = 0.25
/** Feedback this soon after the agent was registered is an instant review. */
export const INSTANT_SECONDS = 3600
/** Fewer rows than this say nothing about how a reviewer rates. */
const MIN_FOR_PATTERN = 3

const ZERO_HASH = `0x${'0'.repeat(64)}`
/** Flags that lower a row's authenticity weight. */
const WEIGHT_RULES = new Set<string>(['revoked', 'self', 'duplicate', 'burst', 'monotonous', 'hyperactive'])

/**
 * pass / warn / fail are verdicts. `missing` = the evidence was not offered,
 * `unknown` = it could not be checked from here, `info` = a measurement
 * with no verdict (left out of the band).
 */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'missing' | 'unknown' | 'info'

export type Check = {
  id: string
  label: string
  status: CheckStatus
  /** What was found, in terms that can be re-checked on a block explorer. */
  detail: string
  /** The rule behind the status. */
  rule: string
}

export type CheckGroupId = 'tx' | 'file' | 'payment' | 'reviewer' | 'agent'

export type CheckGroup = { id: CheckGroupId; title: string; checks: Check[] }

/** Counts per status over the verdict checks (`info` excluded). */
export type EvidenceBand = {
  pass: number
  warn: number
  fail: number
  missing: number
  unknown: number
  total: number
  /** Checks that hold for certain. */
  low: number
  /** Checks that hold if every unknown turned out fine. */
  high: number
}

/** The transaction that wrote the feedback row. */
export type TxFacts = {
  hash: Hex
  from: Address
  to: Address | null
  blockNumber: bigint
  /** Gas used × effective gas price, plus the L1 data fee where the rollup reports one; wei. */
  feeWei: bigint
  /** `NewFeedback` logs of the reputation registry in this transaction. */
  feedbackLogs: number
  /** `feedbackHash` of this row's log; undefined when the log is not in the receipt. */
  feedbackHash?: Hex
  /** `feedbackURI` of this row's log. */
  feedbackURI?: string
}

export type UriScheme = 'data' | 'ipfs' | 'https' | 'http' | 'other'

/** The off-chain file behind `feedbackURI`. */
export type FileFacts = {
  uri: string
  scheme: UriScheme
  /** keccak256 of the bytes served; undefined when they could not be fetched. */
  contentHash?: Hex
  /** keccak256 of the file's canonical JSON (keys sorted, no whitespace): what SDKs commit to. */
  canonicalHash?: Hex
  /** The parsed file; undefined when unreachable or not JSON. */
  json?: unknown
  /** Why the bytes or the JSON are missing. */
  error?: string
}

export type PaymentProof = { fromAddress?: string; toAddress?: string; chainId?: number; txHash?: string }

/** One movement of value inside a transaction. */
export type Transfer = {
  from: Address
  to: Address
  amount: bigint
  /** null = the chain's native currency. */
  token: Address | null
  symbol?: string
  decimals?: number
}

/** The transaction a `proofOfPayment` cites. */
export type PaymentFacts = {
  proof: PaymentProof
  /** Chain the proof names (defaults to the feedback's chain). */
  chainId: number
  /** Undefined when the chain is not configured or the lookup failed (see `error`). */
  tx?: { found: boolean; reverted?: boolean; blockNumber?: bigint; timestamp?: number; transfers: Transfer[] }
  error?: string
  /** Rows of other reviewers on this agent whose file cites the same payment. */
  reusedByOthers: number
  /** Other rows of the same reviewer that cite it (one call rated on several tags is legitimate). */
  reusedBySame: number
  /** Other feedback files of this agent that could be read and compared. */
  comparedFiles: number
}

/** What the chain and the feed say about the reviewer's address. */
export type ReviewerFacts = {
  /** Transactions sent (account nonce). */
  nonce?: number
  kind?: 'eoa' | 'contract' | 'delegated'
  /** Its feedback across agents, as far as the source reaches. */
  rows?: { tokenId: bigint; value: number; revoked: boolean }[]
  /** True when older rows exist beyond `rows`. */
  rowsTruncated?: boolean
  /** Unix seconds the log scan reached; log scan only. */
  rowsSince?: number
}

export type TxDetailFacts = {
  tx: TxFacts | null
  /** Why `tx` is null. */
  txNote?: string
  /** Null when the row has no `feedbackURI`. */
  file: FileFacts | null
  /** Null when the file cites no payment. */
  payment: PaymentFacts | null
  reviewer: ReviewerFacts
}

export type TxDetailContext = {
  chainId: number
  /** Symbol of the native currency, for the fee. */
  nativeSymbol: string
  identity: Address
  reputation: Address
  tokenId: bigint
  owner: Address | null
  agentWallet: Address | null
  /** Unix seconds; only indexed sources know it. */
  agentCreatedAt?: number
  /** Every feedback row of the agent, and its stats. */
  feedback: Feedback[]
  stats: FeedbackStats
  /** Position of the inspected row in `feedback`. */
  index: number
}

type Verdict = Pick<Check, 'status' | 'detail'>

/** Gives a ternary of verdicts its literal `status` type. */
function verdict(value: Verdict): Verdict {
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b) && a!.toLowerCase() === b!.toLowerCase()
}

/** Last segment of a CAIP-10 id (`eip155:1:0xabc…`), or the bare address. */
function bareAddress(value: string): string {
  return value.slice(value.lastIndexOf(':') + 1)
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

/** 'owner' / 'agent wallet' when `address` is one of the agent's own, else null. */
function selfRole(address: string, ctx: TxDetailContext): string | null {
  if (same(address, ctx.owner)) return 'owner'
  if (same(address, ctx.agentWallet)) return 'agent wallet'
  return null
}

/** `proofOfPayment` of a feedback file; null when the file cites no payment. */
export function readPaymentProof(json: unknown): PaymentProof | null {
  if (!isRecord(json) || !isRecord(json.proofOfPayment)) return null
  const proof = json.proofOfPayment
  const chainId = Number(typeof proof.chainId === 'string' ? bareAddress(proof.chainId) : proof.chainId)
  const fromAddress = str(proof.fromAddress)
  const toAddress = str(proof.toAddress)
  const txHash = str(proof.txHash)
  return {
    ...(fromAddress ? { fromAddress } : {}),
    ...(toAddress ? { toAddress } : {}),
    ...(Number.isInteger(chainId) && chainId > 0 ? { chainId } : {}),
    ...(txHash ? { txHash } : {}),
  }
}

export function isTxHash(value: string | undefined): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value)
}

export function formatTransfer(transfer: Transfer, nativeSymbol: string): string {
  if (transfer.token === null) return `${formatAmount(transfer.amount, 18)} ${nativeSymbol}`
  const symbol = transfer.symbol ?? `token ${shortAddress(transfer.token)}`
  return transfer.decimals === undefined
    ? `${transfer.amount} base units of ${symbol}`
    : `${formatAmount(transfer.amount, transfer.decimals)} ${symbol}`
}

function txChecks(facts: TxDetailFacts, ctx: TxDetailContext): Check[] {
  const { tx } = facts
  const row = ctx.feedback[ctx.index]
  if (!tx) {
    return [
      {
        id: 'tx-found',
        label: 'Transaction',
        status: 'unknown',
        detail: facts.txNote ?? 'The transaction that wrote this row is not known.',
        rule: 'The row is traced back to the transaction that wrote it.',
      },
    ]
  }

  const senderRole = selfRole(tx.from, ctx)
  // A contract account cannot send a transaction: someone calls it, and it calls the registry.
  const viaReviewer = same(tx.to, row.client)
  const sender: Check = {
    id: 'tx-sender',
    label: 'Sent by the reviewer',
    rule: 'The sender of the transaction is the client address, or calls the client when that is a contract account. Another sender means someone else paid for this feedback (relayer, EIP-7702 sponsor); the agent’s own owner or wallet as sender fails.',
    ...verdict(
      senderRole && !same(tx.from, row.client)
        ? {
            status: 'fail',
            detail: `Sent by the agent’s ${senderRole} ${shortAddress(tx.from)} in the name of ${shortAddress(row.client)}.`,
          }
        : same(tx.from, row.client)
          ? { status: 'pass', detail: `${shortAddress(tx.from)} signed the transaction and paid its fee.` }
          : viaReviewer
            ? {
                status: 'pass',
                detail: `The reviewer ${shortAddress(row.client)} is a contract; ${shortAddress(tx.from)} called it and paid the fee.`,
              }
            : {
                status: 'warn',
                detail: `Sent by ${shortAddress(tx.from)}, not by the reviewer ${shortAddress(row.client)}: relayed or sponsored.`,
              },
    ),
  }

  const target: Check = {
    id: 'tx-target',
    label: 'Direct call',
    rule: 'The transaction calls the reputation registry itself, or the client’s own contract account. Another target means a third contract wrote the feedback (batcher, relayer, app).',
    ...verdict(
      same(tx.to, ctx.reputation)
        ? { status: 'pass', detail: 'Calls the reputation registry directly.' }
        : viaReviewer
          ? { status: 'pass', detail: 'Calls the reviewer’s own contract, which called the registry.' }
          : { status: 'warn', detail: `Goes through ${tx.to ? shortAddress(tx.to) : 'a contract creation'}, which called the registry.` },
    ),
  }

  const single: Check = {
    id: 'tx-single',
    label: 'One feedback per transaction',
    rule: 'The transaction emits a single NewFeedback log. Several in one transaction is how feedback gets written in bulk.',
    ...verdict(tx.feedbackLogs === 1
      ? { status: 'pass', detail: 'The only feedback written by this transaction.' }
      : tx.feedbackLogs > 1
        ? { status: 'warn', detail: `${tx.feedbackLogs} feedback rows were written by this one transaction.` }
        : { status: 'unknown', detail: 'The receipt holds no NewFeedback log of the registry.' }),
  }

  const fee: Check = {
    id: 'tx-fee',
    label: 'Cost to write',
    status: 'info',
    detail: `${formatAmount(tx.feeWei, 18)} ${ctx.nativeSymbol} in fees.`,
    rule: 'Gas used × effective gas price (plus the L1 data fee where reported): what this row cost its sender, a floor on the cost of faking it.',
  }

  return [sender, target, single, fee]
}

/** Task, tool, skill or endpoint the row is about; empty when it names none. */
function interactionOf(row: Feedback, json: unknown): string[] {
  const named: string[] = []
  if (isRecord(json)) {
    const { mcp, a2a, oasf } = json
    if (isRecord(mcp)) {
      for (const key of ['tool', 'prompt', 'resource']) {
        const value = str(mcp[key])
        if (value) named.push(`MCP ${key} ${value}`)
      }
    }
    if (isRecord(a2a)) {
      const task = str(a2a.taskId)
      const context = str(a2a.contextId)
      if (task) named.push(`A2A task ${task}`)
      if (context) named.push(`A2A context ${context}`)
      if (Array.isArray(a2a.skills) && a2a.skills.length) named.push(`A2A ${plural(a2a.skills.length, 'skill')}`)
    }
    if (isRecord(oasf) && Array.isArray(oasf.skills) && oasf.skills.length) {
      named.push(`OASF ${plural(oasf.skills.length, 'skill')}`)
    }
  }
  const endpoint = row.endpoint ?? (isRecord(json) ? str(json.endpoint) : undefined)
  if (endpoint) named.push(`endpoint ${endpoint}`)
  return named
}

/** Fields of the file that restate the on-chain row, split into those that agree and those that do not. */
function compareFields(json: Record<string, unknown>, row: Feedback, ctx: TxDetailContext) {
  const agree: string[] = []
  const differ: string[] = []
  const note = (field: string, matches: boolean, shown: string) => {
    if (matches) agree.push(field)
    else differ.push(`${field} (file says ${shown})`)
  }

  const registry = str(json.agentRegistry)
  if (registry) {
    const [, chainId] = registry.split(':')
    note('agentRegistry', Number(chainId) === ctx.chainId && same(bareAddress(registry), ctx.identity), registry)
  }
  if (typeof json.agentId === 'number' || str(json.agentId)) {
    note('agentId', String(json.agentId).trim() === ctx.tokenId.toString(), String(json.agentId))
  }
  const client = str(json.clientAddress)
  if (client) note('clientAddress', same(bareAddress(client), row.client), shortAddress(bareAddress(client)))
  if (typeof json.value === 'number' || str(json.value)) {
    const decimals = Number(json.valueDecimals ?? 0)
    const value = Number(json.value) / 10 ** (Number.isFinite(decimals) ? decimals : 0)
    note('value', Math.abs(value - row.value) < 1e-9, formatScore(value))
  }
  for (const tag of ['tag1', 'tag2'] as const) {
    const value = str(json[tag])
    if (value) note(tag, value === row[tag], value)
  }
  // The endpoint only lives in the event log; a row read without it cannot be compared.
  const endpoint = str(json.endpoint)
  if (endpoint && row.endpoint) note('endpoint', endpoint === row.endpoint, endpoint)
  return { agree, differ }
}

function fileChecks(facts: TxDetailFacts, ctx: TxDetailContext): Check[] {
  const { file, tx } = facts
  const row = ctx.feedback[ctx.index]
  const named = interactionOf(row, file?.json)
  const unlisted = ctx.stats.rows[ctx.index]?.flags.includes('unlisted-endpoint')
  const interaction: Check = {
    id: 'file-interaction',
    label: 'Names the interaction',
    rule: 'The row or its file says what was used: an endpoint, an MCP tool, an A2A task or a skill. The endpoint must be one the registration file advertises.',
    ...verdict(named.length === 0
      ? { status: 'missing', detail: 'No endpoint, tool, task or skill: nothing ties the row to a specific interaction.' }
      : unlisted
        ? { status: 'warn', detail: `Names ${named.join(', ')} — an endpoint the agent does not advertise.` }
        : { status: 'pass', detail: `Names ${named.join(', ')}.` }),
  }

  if (!file) {
    return [
      {
        id: 'file-present',
        label: 'Feedback file',
        status: 'missing',
        detail: 'No feedbackURI: the row is a bare value with nothing behind it.',
        rule: 'The row points to an off-chain feedback file (optional in the ERC).',
      },
      interaction,
    ]
  }

  const readable: Check = {
    id: 'file-readable',
    label: 'Readable',
    rule: 'The file behind feedbackURI can be fetched and is a JSON object.',
    ...verdict(isRecord(file.json)
      ? { status: 'pass', detail: `Fetched and parsed (${plural(Object.keys(file.json).length, 'field')}).` }
      : file.json !== undefined
        ? { status: 'fail', detail: 'The URI does not hold a JSON object.' }
        : file.contentHash
          ? { status: 'fail', detail: `Fetched, but it is not JSON${file.error ? `: ${file.error}` : ''}.` }
          : { status: 'unknown', detail: `Could not be fetched from here (host down or no CORS headers)${file.error ? `: ${file.error}` : ''}.` }),
  }

  const committed = tx?.feedbackHash && tx.feedbackHash !== ZERO_HASH ? tx.feedbackHash : undefined
  // The URI alone fixes the content: inline, or addressed by its hash.
  const addressed = file.scheme === 'data' || file.scheme === 'ipfs'
  const fixed =
    file.scheme === 'data'
      ? 'Inline data: URI — the content itself is in the event log'
      : 'Content-addressed (IPFS): the URI itself commits to the content'
  const integrity: Check = {
    id: 'file-integrity',
    label: 'Cannot be rewritten',
    rule: 'The content is fixed: an inline data: URI, a content-addressed URI (IPFS), or a feedbackHash equal to keccak256 of the served bytes or of their canonical JSON (keys sorted, no whitespace). A hash that matches neither fails a mutable URI and warns on a fixed one.',
    ...verdict(
      !committed
        ? addressed
          ? { status: 'pass', detail: `${fixed}.` }
          : !tx?.feedbackHash
            ? { status: 'unknown', detail: 'The feedbackHash lives in the event log, which could not be read.' }
            : { status: 'warn', detail: 'Mutable URI and no feedbackHash: the file can be rewritten after the fact.' }
        : !file.contentHash
          ? addressed
            ? { status: 'pass', detail: `${fixed}. Its feedbackHash could not be compared: the bytes were not fetched.` }
            : { status: 'unknown', detail: 'A feedbackHash is set, but the bytes could not be fetched to compare.' }
          : same(file.contentHash, committed)
            ? { status: 'pass', detail: 'keccak256 of the served bytes equals the feedbackHash of the event.' }
            : same(file.canonicalHash, committed)
              ? {
                  status: 'pass',
                  detail: 'feedbackHash equals keccak256 of the file’s canonical JSON (keys sorted, no whitespace): same content as served, not byte for byte.',
                }
              : addressed
                ? {
                    status: 'warn',
                    detail: `${fixed}, yet feedbackHash ${shortAddress(committed)} matches neither its bytes (${shortAddress(file.contentHash)}) nor its canonical JSON.`,
                  }
                : {
                    status: 'fail',
                    detail: `The served bytes hash to ${shortAddress(file.contentHash)}, the event committed to ${shortAddress(committed)}: the file changed.`,
                  },
    ),
  }

  let consistent: Check | undefined
  if (isRecord(file.json)) {
    const { agree, differ } = compareFields(file.json, row, ctx)
    consistent = {
      id: 'file-consistent',
      label: 'Restates the row',
      rule: 'agentRegistry, agentId, clientAddress, value, tags and endpoint in the file equal the on-chain row.',
      ...verdict(differ.length
        ? { status: 'fail', detail: `Differs from the on-chain row: ${differ.join(', ')}.` }
        : agree.length
          ? { status: 'pass', detail: `${agree.join(', ')} agree with the on-chain row.` }
          : { status: 'missing', detail: 'The file states none of agentRegistry, agentId, clientAddress or value.' }),
    }
  }

  return [readable, integrity, ...(consistent ? [consistent] : []), interaction]
}

function paymentChecks(facts: TxDetailFacts, ctx: TxDetailContext): Check[] {
  const { file, payment, tx } = facts
  const row = ctx.feedback[ctx.index]
  const cited: Check = {
    id: 'pay-cited',
    label: 'Cites a payment',
    status: 'missing',
    detail: 'No proofOfPayment: nothing shows the reviewer was a paying client.',
    rule: 'The feedback file carries proofOfPayment.txHash (for example the x402 payment for the call).',
  }
  if (!payment) {
    if (file && !isRecord(file.json)) {
      return [{ ...cited, status: 'unknown', detail: 'The feedback file could not be read, so a payment proof cannot be seen.' }]
    }
    return [cited]
  }

  const { proof } = payment
  if (!isTxHash(proof.txHash)) {
    return [{ ...cited, status: 'fail', detail: 'proofOfPayment carries no valid transaction hash.' }]
  }
  const where = payment.chainId === ctx.chainId ? 'this chain' : `chain ${payment.chainId}`
  const checks: Check[] = [{ ...cited, status: 'pass', detail: `Cites ${shortAddress(proof.txHash)} on ${where}.` }]

  const exists: Check = {
    id: 'pay-exists',
    label: 'Payment exists',
    rule: 'The cited transaction is on the named chain and did not revert.',
    ...verdict(!payment.tx
      ? { status: 'unknown', detail: payment.error ?? `Chain ${payment.chainId} is not one this explorer can read.` }
      : !payment.tx.found
        ? { status: 'fail', detail: `No such transaction on ${where}.` }
        : payment.tx.reverted
          ? { status: 'fail', detail: 'The cited transaction reverted: nothing was paid.' }
          : { status: 'pass', detail: `Confirmed on ${where}${payment.tx.blockNumber !== undefined ? `, block ${payment.tx.blockNumber}` : ''}.` }),
  }
  checks.push(exists)

  const paid = payment.tx?.found && !payment.tx.reverted ? payment.tx : undefined
  if (paid) {
    const toAgent = (t: Transfer) => selfRole(t.to, ctx) !== null
    const direct = paid.transfers.find((t) => same(t.from, row.client) && toAgent(t))
    const stated = paid.transfers.find((t) => same(t.from, proof.fromAddress) && same(t.to, proof.toAddress))
    const moved = direct ?? stated ?? paid.transfers[0]
    checks.push({
      id: 'pay-parties',
      label: 'Reviewer paid the agent',
      rule: 'The cited transaction moves native currency or an ERC-20 from the client address to the agent’s owner or agent wallet.',
      ...verdict(direct
        ? {
            status: 'pass',
            detail: `${shortAddress(direct.from)} → the agent’s ${selfRole(direct.to, ctx)} ${shortAddress(direct.to)}.`,
          }
        : stated
          ? {
              status: 'warn',
              detail: `Moves value ${shortAddress(stated.from)} → ${shortAddress(stated.to)}, but ${
                same(stated.from, row.client) ? 'the payee is not the agent’s owner or wallet' : 'the payer is not the reviewer'
              }.`,
            }
          : { status: 'fail', detail: 'Nothing in that transaction goes from the reviewer to the agent’s owner or wallet.' }),
    })

    const sameChain = payment.chainId === ctx.chainId
    const feedbackTime = row.createdAt
    const before =
      sameChain && tx && paid.blockNumber !== undefined
        ? paid.blockNumber <= tx.blockNumber
        : paid.timestamp !== undefined && feedbackTime !== undefined
          ? paid.timestamp <= feedbackTime
          : undefined
    checks.push({
      id: 'pay-order',
      label: 'Paid before rating',
      rule: 'The payment is not newer than the feedback (block numbers on the same chain, block times across chains).',
      ...verdict(before === undefined
        ? { status: 'unknown', detail: 'The order of payment and feedback could not be established.' }
        : before
          ? { status: 'pass', detail: 'The payment is older than the feedback.' }
          : { status: 'fail', detail: 'The payment was made after the feedback was written.' }),
    })

    checks.push({
      id: 'pay-unique',
      label: 'Payment used once',
      rule: 'No other feedback file of this agent cites the same payment transaction. Another reviewer citing it fails; the same reviewer citing it again warns (one paid call can be rated on several tags).',
      ...verdict(payment.reusedByOthers > 0
        ? { status: 'fail', detail: `The same payment backs ${plural(payment.reusedByOthers, 'row')} of other reviewers on this agent.` }
        : payment.reusedBySame > 0
          ? { status: 'warn', detail: `The same payment backs ${plural(payment.reusedBySame, 'other row')} of this reviewer.` }
          : {
              status: 'pass',
              detail: payment.comparedFiles
                ? `Not cited by the ${plural(payment.comparedFiles, 'other feedback file')} of this agent that could be read.`
                : 'No other feedback file of this agent to compare with.',
            }),
    })

    if (moved) {
      checks.push({
        id: 'pay-amount',
        label: 'Amount paid',
        status: 'info',
        detail: `${formatTransfer(moved, ctx.nativeSymbol)}.`,
        rule: 'What the cited transaction moved: the economic weight behind this row.',
      })
    }
  }
  return checks
}

/** Shannon entropy of a list of values, in bits. */
export function entropyBits(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const p = count / values.length
    bits -= p * Math.log2(p)
  }
  return bits
}

function reviewerChecks(facts: TxDetailFacts, ctx: TxDetailContext): Check[] {
  const { reviewer } = facts
  const row = ctx.feedback[ctx.index]
  const role = selfRole(row.client, ctx)
  const checks: Check[] = [
    {
      id: 'rev-independent',
      label: 'Not the agent itself',
      rule: 'The client is neither the agent’s owner nor its agent wallet. Address equality only: a second wallet of the owner passes (linking those needs a funding graph, which a block explorer API has and an RPC does not).',
      ...verdict(role
        ? { status: 'fail', detail: `The reviewer is the agent’s ${role}.` }
        : { status: 'pass', detail: 'Neither the owner nor the agent wallet.' }),
    },
  ]

  const activity = {
    id: 'rev-activity',
    label: 'Established wallet',
    rule: `The client has sent at least ${MIN_NONCE} transactions on this chain (its nonce). Contract accounts are not judged. A wallet that only ever acts through a relayer also shows 0.`,
  }
  if (reviewer.nonce === undefined || !reviewer.kind) {
    checks.push({ ...activity, status: 'unknown', detail: 'The account could not be read.' })
  } else if (reviewer.kind === 'contract') {
    checks.push({ ...activity, status: 'info', detail: 'A contract account: its nonce says nothing about activity.' })
  } else {
    const kind = reviewer.kind === 'delegated' ? 'EOA with an EIP-7702 delegation' : 'EOA'
    checks.push({
      ...activity,
      ...verdict(reviewer.nonce >= MIN_NONCE
        ? { status: 'pass', detail: `${kind}, ${plural(reviewer.nonce, 'transaction')} sent on this chain.` }
        : { status: 'warn', detail: `${kind}, only ${plural(reviewer.nonce, 'transaction')} ever sent on this chain: a fresh wallet.` }),
    })
  }

  const reach = reviewer.rowsSince
    ? `since ${formatDate(reviewer.rowsSince)}`
    : reviewer.rowsTruncated
      ? `its latest ${reviewer.rows?.length ?? 0} rows`
      : 'all its rows'
  const rows = reviewer.rows
  const unread = rows === undefined ? 'Its feedback on other agents could not be loaded.' : `No feedback from this address in the scanned window (${reach}).`

  const breadth = {
    id: 'rev-breadth',
    label: 'Rates other agents',
    rule: 'The client left feedback on at least 2 agents, as far back as the data source reaches. A single-purpose reviewer is cheap to create.',
  }
  const pattern = {
    id: 'rev-varied',
    label: 'Ratings vary',
    rule: `Over the client’s non-revoked rows on any agent (at least ${MIN_FOR_PATTERN}): more than one distinct value. A reviewer that always gives the same value carries no information.`,
  }
  const stands = {
    id: 'rev-stands',
    label: 'Stands by its feedback',
    rule: 'Fewer than 2 revoked rows, or less than 20% of its rows revoked.',
  }
  if (!rows || rows.length === 0) {
    for (const check of [breadth, pattern, stands]) checks.push({ ...check, status: 'unknown', detail: unread })
  } else {
    const agents = new Set(rows.map((r) => r.tokenId.toString()))
    agents.add(ctx.tokenId.toString())
    checks.push({
      ...breadth,
      ...verdict(agents.size >= 2
        ? { status: 'pass', detail: `Rated ${agents.size} agents (${reach}).` }
        : { status: 'warn', detail: `Only ever rated this agent (${reach}).` }),
    })

    const values = rows.filter((r) => !r.revoked).map((r) => r.value)
    const distinct = new Set(values).size
    checks.push({
      ...pattern,
      ...verdict(values.length < MIN_FOR_PATTERN
        ? { status: 'unknown', detail: `${plural(values.length, 'counted row')}: too few to see a pattern.` }
        : distinct === 1
          ? { status: 'warn', detail: `All ${values.length} rows give the same value (${formatScore(values[0])}).` }
          : {
              status: 'pass',
              detail: `${values.length} rows, ${distinct} distinct values, entropy ${entropyBits(values).toFixed(2)} of ${Math.log2(values.length).toFixed(2)} bits.`,
            }),
    })

    const revoked = rows.length - values.length
    checks.push({
      ...stands,
      ...verdict(revoked >= 2 && revoked / rows.length >= 0.2
        ? { status: 'warn', detail: `Revoked ${revoked} of its ${rows.length} rows.` }
        : { status: 'pass', detail: `${revoked} of its ${plural(rows.length, 'row')} revoked.` }),
    })
  }
  return checks
}

/** Herfindahl index of the reviewers' shares of counted rows: 1/n when even, 1 for a single reviewer. */
export function herfindahl(shares: number[]): number {
  return shares.reduce((sum, share) => sum + share * share, 0)
}

function agentChecks(ctx: TxDetailContext): Check[] {
  const row = ctx.feedback[ctx.index]
  const rowStats = ctx.stats.rows[ctx.index]
  const checks: Check[] = []

  // Only the rules that discount the weight; outlier, off-scale and endpoint flags do not.
  const fired = (rowStats?.flags ?? [])
    .filter((flag) => WEIGHT_RULES.has(flag))
    .map((flag) => FLAG_INFO[flag].label)
    .join(', ')
  const weight = rowStats?.weight ?? 0
  checks.push({
    id: 'agent-weight',
    label: 'Counts as a full vote',
    rule: 'Authenticity weight of the row: 1 unless a self, duplicate, burst, monotonous or hyperactive rule fired (see the Weight column).',
    ...verdict(weight === 1
      ? { status: 'pass', detail: 'Weight 1: no discount rule fired.' }
      : weight === 0
        ? { status: 'fail', detail: `Weight 0 (${fired || 'discounted'}): it does not count in the weighted score.` }
        : { status: 'warn', detail: `Weight ${weight < 0.01 ? 'below 0.01' : weight.toFixed(2)} (${fired || 'discounted'}).` }),
  })

  const valid = ctx.feedback.filter((f) => !f.revoked)
  const shares = ctx.stats.reviewers.map((r) => r.share).filter((share) => share > 0)
  const own = ctx.stats.reviewers.find((r) => same(r.client, row.client))
  const voice = {
    id: 'agent-voice',
    label: 'One voice among many',
    rule: 'The client wrote less than half of the agent’s counted (non-revoked) rows; judged from 3 rows up.',
  }
  const concentration = {
    id: 'agent-concentration',
    label: 'Reviewers are spread',
    rule: `Herfindahl index of the reviewers’ shares of counted rows, Σ share². Above ${HHI_CONCENTRATED} (fewer than ${1 / HHI_CONCENTRATED} equal reviewers) a few addresses decide the score; 1 = a single reviewer. Judged from 3 rows up.`,
  }
  if (valid.length < 3) {
    const few = `${plural(valid.length, 'counted row')} on this agent: too few to judge.`
    checks.push({ ...voice, status: 'unknown', detail: few }, { ...concentration, status: 'unknown', detail: few })
  } else {
    const share = own?.share ?? 0
    const written = `Wrote ${Math.round(share * valid.length)} of the ${valid.length} counted rows (${percent(share)}).`
    checks.push({ ...voice, status: share >= 0.5 ? 'warn' : 'pass', detail: written })
    const hhi = herfindahl(shares)
    const top3 = [...shares].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0)
    checks.push({
      ...concentration,
      status: hhi > HHI_CONCENTRATED ? 'warn' : 'pass',
      detail: `HHI ${hhi.toFixed(2)} (as if ${(1 / hhi).toFixed(1)} equal reviewers) over ${plural(shares.length, 'reviewer')}; the top 3 wrote ${percent(top3)}.`,
    })
  }

  const early = {
    id: 'agent-early',
    label: 'Not an instant review',
    rule: `The feedback came more than ${formatDuration(INSTANT_SECONDS)} after the agent was registered. Reviews within minutes of registration are typical of self-seeded reputation.`,
  }
  if (ctx.agentCreatedAt === undefined || row.createdAt === undefined) {
    checks.push({
      ...early,
      status: 'unknown',
      detail:
        row.createdAt === undefined
          ? 'This row has no date.'
          : 'The registration date is not known here (only indexed networks carry it).',
    })
  } else {
    const after = row.createdAt - ctx.agentCreatedAt
    checks.push({
      ...early,
      ...verdict(after < INSTANT_SECONDS
        ? { status: 'warn', detail: `Left ${formatDuration(Math.max(0, after))} after the agent was registered.` }
        : { status: 'pass', detail: `Left ${formatDuration(after)} after the agent was registered.` }),
    })
  }

  // Leave-one-out on the weighted score.
  const weights = ctx.stats.rows.map((r) => r.weight)
  const total = weights.reduce((a, b) => a + b, 0)
  const sum = ctx.feedback.reduce((a, f, i) => a + weights[i] * f.value, 0)
  const rest = total - weight
  const influence = {
    id: 'agent-influence',
    label: 'Pull on the score',
    status: 'info' as const,
    rule: 'Weighted score without this row minus the weighted score with it (weights as in the Weight column).',
  }
  if (weight === 0 || total === 0) {
    checks.push({ ...influence, detail: 'Weighs 0: removing it changes nothing.' })
  } else if (rest <= 0) {
    checks.push({ ...influence, detail: `It is the only row with weight: the weighted score is its value, ${formatScore(row.value)}.` })
  } else {
    const withRow = sum / total
    const without = (sum - weight * row.value) / rest
    const shift = without - withRow
    checks.push({
      ...influence,
      detail: `Without it the weighted score moves ${withRow.toFixed(2)} → ${without.toFixed(2)} (${shift > 0 ? '+' : ''}${shift.toFixed(2)}).`,
    })
  }

  checks.push({
    id: 'agent-validation',
    label: 'Validated work',
    status: 'info',
    detail: 'No ERC-8004 validation registry is deployed yet, so no validator result exists to hold this rating against.',
    rule: 'Feedback and a validator’s response for the same work agree (Validation Registry). Not computable until that registry ships.',
  })
  return checks
}

export function bandOf(groups: CheckGroup[]): EvidenceBand {
  const band = { pass: 0, warn: 0, fail: 0, missing: 0, unknown: 0 }
  for (const check of groups.flatMap((group) => group.checks)) {
    if (check.status !== 'info') band[check.status]++
  }
  const total = band.pass + band.warn + band.fail + band.missing + band.unknown
  return { ...band, total, low: band.pass, high: band.pass + band.unknown }
}

/**
 * Turns what was read about one feedback row into checks. Pure: every
 * status follows from `facts` and `ctx` by the rule printed next to it.
 */
export function evaluateTxDetail(facts: TxDetailFacts, ctx: TxDetailContext): { groups: CheckGroup[]; band: EvidenceBand } {
  const groups: CheckGroup[] = [
    { id: 'tx', title: 'Transaction', checks: txChecks(facts, ctx) },
    { id: 'file', title: 'Feedback file', checks: fileChecks(facts, ctx) },
    { id: 'payment', title: 'Proof of payment', checks: paymentChecks(facts, ctx) },
    { id: 'reviewer', title: 'Reviewer', checks: reviewerChecks(facts, ctx) },
    { id: 'agent', title: 'Within this agent', checks: agentChecks(ctx) },
  ]
  return { groups, band: bandOf(groups) }
}
