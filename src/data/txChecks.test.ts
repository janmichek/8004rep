import { describe, expect, it } from 'vitest'
import type { Address, Hex } from 'viem'
import { computeFeedbackStats } from './feedbackStats'
import {
  entropyBits,
  evaluateTxDetail,
  herfindahl,
  readPaymentProof,
  type Check,
  type CheckStatus,
  type FileFacts,
  type PaymentFacts,
  type TxDetailContext,
  type TxDetailFacts,
  type TxFacts,
} from './txChecks'
import type { Feedback } from './types'

const A = '0x00000000000000000000000000000000000000a1' as Address
const B = '0x00000000000000000000000000000000000000b2' as Address
const C = '0x00000000000000000000000000000000000000c3' as Address
const D = '0x00000000000000000000000000000000000000d4' as Address
const OWNER = '0x00000000000000000000000000000000000000F0' as Address
const WALLET = '0x00000000000000000000000000000000000000F1' as Address
const RELAYER = '0x00000000000000000000000000000000000000E9' as Address
const IDENTITY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address
const REPUTATION = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as Address
const USDC = '0x00000000000000000000000000000000000000c0' as Address
const TX = `0x${'11'.repeat(32)}` as Hex
const PAY = `0x${'22'.repeat(32)}` as Hex
const HASH = `0x${'ab'.repeat(32)}` as Hex
const ZERO = `0x${'00'.repeat(32)}` as Hex
const NOW = 100_000_000

function row(client: Address, value: number, extra: Partial<Feedback> = {}): Feedback {
  return { client, value, revoked: false, ...extra }
}

/** Four reviewers, one row each; the inspected row is the first. */
const FEEDBACK = [row(A, 90, { createdAt: NOW - 1000 }), row(B, 80), row(C, 70), row(D, 60)]

function context(feedback: Feedback[] = FEEDBACK, extra: Partial<TxDetailContext> = {}): TxDetailContext {
  return {
    chainId: 84532,
    nativeSymbol: 'ETH',
    identity: IDENTITY,
    reputation: REPUTATION,
    tokenId: 22n,
    owner: OWNER,
    agentWallet: WALLET,
    feedback,
    stats: computeFeedbackStats(feedback, { owner: OWNER, agentWallet: WALLET, now: NOW }),
    index: 0,
    ...extra,
  }
}

function tx(extra: Partial<TxFacts> = {}): TxFacts {
  return { hash: TX, from: A, to: REPUTATION, blockNumber: 500n, feeWei: 12_000_000_000_000n, feedbackLogs: 1, feedbackHash: ZERO, ...extra }
}

function facts(extra: Partial<TxDetailFacts> = {}): TxDetailFacts {
  return { tx: tx(), file: null, payment: null, reviewer: {}, ...extra }
}

function check(id: string, f: TxDetailFacts, ctx: TxDetailContext = context()): Check {
  const found = evaluateTxDetail(f, ctx)
    .groups.flatMap((group) => group.checks)
    .find((c) => c.id === id)
  if (!found) throw new Error(`no check ${id}`)
  return found
}

function status(id: string, f: TxDetailFacts, ctx?: TxDetailContext): CheckStatus {
  return check(id, f, ctx).status
}

describe('transaction checks', () => {
  it('passes a direct, single feedback sent by the reviewer and reports its fee', () => {
    const f = facts()
    expect(status('tx-sender', f)).toBe('pass')
    expect(status('tx-target', f)).toBe('pass')
    expect(status('tx-single', f)).toBe('pass')
    expect(check('tx-fee', f)).toMatchObject({ status: 'info', detail: '0.000012 ETH in fees.' })
  })

  it('warns on a relayed transaction and fails when the agent itself sent it', () => {
    expect(status('tx-sender', facts({ tx: tx({ from: RELAYER }) }))).toBe('warn')
    expect(status('tx-sender', facts({ tx: tx({ from: OWNER.toLowerCase() as Address }) }))).toBe('fail')
    expect(check('tx-sender', facts({ tx: tx({ from: WALLET }) })).detail).toContain('agent wallet')
  })

  it('accepts a contract reviewer called by its operator, unless the agent is the caller', () => {
    const f = facts({ tx: tx({ from: RELAYER, to: A }) })
    expect(check('tx-sender', f)).toMatchObject({ status: 'pass' })
    expect(check('tx-target', f)).toMatchObject({ status: 'pass', detail: 'Calls the reviewer’s own contract, which called the registry.' })
    expect(status('tx-sender', facts({ tx: tx({ from: OWNER, to: A }) }))).toBe('fail')
  })

  it('warns when a contract wrote the feedback or several reviews share the transaction', () => {
    expect(status('tx-target', facts({ tx: tx({ to: RELAYER }) }))).toBe('warn')
    expect(check('tx-single', facts({ tx: tx({ feedbackLogs: 7 }) }))).toMatchObject({ status: 'warn' })
  })

  it('is unknown, with the reason, when the transaction is not known', () => {
    const f = facts({ tx: null, txNote: 'Older than the log scan reaches.' })
    expect(check('tx-found', f)).toMatchObject({ status: 'unknown', detail: 'Older than the log scan reaches.' })
  })
})

function file(json: unknown, extra: Partial<FileFacts> = {}): FileFacts {
  return { uri: 'https://files.example/f.json', scheme: 'https', contentHash: HASH, json, ...extra }
}

describe('feedback file checks', () => {
  it('reports a bare review as missing its file and its interaction', () => {
    const f = facts()
    expect(status('file-present', f)).toBe('missing')
    expect(status('file-interaction', f)).toBe('missing')
  })

  it('separates an unreachable file from one that is not JSON', () => {
    const down = facts({ file: { uri: 'https://x.example/f', scheme: 'https', error: 'Failed to fetch' } })
    expect(check('file-readable', down)).toMatchObject({ status: 'unknown' })
    expect(status('file-readable', facts({ file: file(undefined, { error: 'Unexpected token' }) }))).toBe('fail')
    expect(status('file-readable', facts({ file: file([1, 2]) }))).toBe('fail')
    expect(status('file-readable', facts({ file: file({ value: 90 }) }))).toBe('pass')
  })

  it('accepts inline and content-addressed files without a hash', () => {
    expect(status('file-integrity', facts({ file: file({}, { uri: 'data:application/json,{}', scheme: 'data' }) }))).toBe('pass')
    expect(status('file-integrity', facts({ file: file({}, { uri: 'ipfs://bafy', scheme: 'ipfs' }) }))).toBe('pass')
  })

  it('compares the served bytes, then their canonical JSON, with the committed hash', () => {
    const f = (feedbackHash: Hex, extra: Partial<FileFacts> = {}) => facts({ tx: tx({ feedbackHash }), file: file({}, extra) })
    expect(status('file-integrity', f(HASH.toUpperCase().replace('0X', '0x') as Hex))).toBe('pass')
    expect(check('file-integrity', f(PAY, { canonicalHash: PAY }))).toMatchObject({ status: 'pass' })
    expect(check('file-integrity', f(PAY, { canonicalHash: TX }))).toMatchObject({ status: 'fail' })
    expect(status('file-integrity', f(HASH, { contentHash: undefined }))).toBe('unknown')
  })

  it('only warns when a fixed URI carries a hash that matches nothing', () => {
    const f = (extra: Partial<FileFacts>) => facts({ tx: tx({ feedbackHash: TX }), file: file({}, extra) })
    expect(status('file-integrity', f({ scheme: 'ipfs' }))).toBe('warn')
    expect(status('file-integrity', f({ scheme: 'data' }))).toBe('warn')
    expect(status('file-integrity', f({ scheme: 'ipfs', canonicalHash: TX }))).toBe('pass')
    // Unreachable through the gateways, but the CID still pins the content.
    expect(status('file-integrity', f({ scheme: 'ipfs', contentHash: undefined }))).toBe('pass')
  })

  it('warns on a mutable URI without a hash, and says so only when the event was read', () => {
    expect(status('file-integrity', facts({ file: file({}) }))).toBe('warn')
    expect(status('file-integrity', facts({ tx: null, file: file({}) }))).toBe('unknown')
  })

  it('checks that the file restates the on-chain review', () => {
    const good = {
      agentRegistry: `eip155:84532:${IDENTITY.toLowerCase()}`,
      agentId: 22,
      clientAddress: `eip155:84532:${A}`,
      value: 9000,
      valueDecimals: 2,
    }
    expect(check('file-consistent', facts({ file: file(good) }))).toMatchObject({
      status: 'pass',
      detail: 'agentRegistry, agentId, clientAddress, value agree with the on-chain review.',
    })
    const bad = check('file-consistent', facts({ file: file({ ...good, agentId: '23', value: 100, valueDecimals: 0 }) }))
    expect(bad.status).toBe('fail')
    expect(bad.detail).toContain('agentId (file says 23)')
    expect(bad.detail).toContain('value (file says 100)')
    expect(status('file-consistent', facts({ file: file({ text: 'great' }) }))).toBe('missing')
  })

  it('names the interaction from the file or the on-chain endpoint', () => {
    const f = facts({ file: file({ mcp: { tool: 'GetPrice' }, a2a: { taskId: 't-1', skills: ['a', 'b'] } }) })
    expect(check('file-interaction', f)).toMatchObject({ status: 'pass', detail: 'Names MCP tool GetPrice, A2A task t-1, A2A 2 skills.' })

    const feedback = [row(A, 90, { endpoint: 'https://other.example/x' }), ...FEEDBACK.slice(1)]
    const stats = computeFeedbackStats(feedback, { services: ['https://agent.example'], now: NOW })
    expect(status('file-interaction', facts(), context(feedback, { stats }))).toBe('warn')
    const listed = computeFeedbackStats(feedback, { services: ['https://other.example'], now: NOW })
    expect(status('file-interaction', facts(), context(feedback, { stats: listed }))).toBe('pass')
  })
})

function payment(extra: Partial<PaymentFacts> = {}): PaymentFacts {
  return {
    proof: { fromAddress: A, toAddress: WALLET, chainId: 84532, txHash: PAY },
    chainId: 84532,
    tx: {
      found: true,
      blockNumber: 400n,
      transfers: [{ from: A, to: WALLET, amount: 1_500_000n, token: USDC, symbol: 'USDC', decimals: 6 }],
    },
    reusedByOthers: 0,
    reusedBySame: 0,
    comparedFiles: 3,
    ...extra,
  }
}

describe('readPaymentProof', () => {
  it('reads the proof and tolerates a CAIP chain id', () => {
    expect(readPaymentProof({ proofOfPayment: { fromAddress: A, toAddress: B, chainId: '1', txHash: PAY } })).toEqual({
      fromAddress: A,
      toAddress: B,
      chainId: 1,
      txHash: PAY,
    })
    expect(readPaymentProof({ proofOfPayment: { chainId: 'eip155:8453', txHash: PAY } })).toEqual({ chainId: 8453, txHash: PAY })
  })

  it('is null without a proof object', () => {
    expect(readPaymentProof({ text: 'nice' })).toBeNull()
    expect(readPaymentProof({ proofOfPayment: 'paid' })).toBeNull()
    expect(readPaymentProof(null)).toBeNull()
  })
})

describe('payment checks', () => {
  it('is missing without a proof and unknown when the file could not be read', () => {
    expect(status('pay-cited', facts({ file: file({ text: 'nice' }) }))).toBe('missing')
    expect(status('pay-cited', facts())).toBe('missing')
    expect(status('pay-cited', facts({ file: { uri: 'https://x.example/f', scheme: 'https', error: 'down' } }))).toBe('unknown')
  })

  it('passes a payment from the reviewer to the agent wallet made before the feedback', () => {
    const f = facts({ file: file({}), payment: payment() })
    for (const id of ['pay-cited', 'pay-exists', 'pay-parties', 'pay-order', 'pay-unique']) expect(status(id, f)).toBe('pass')
    expect(check('pay-amount', f)).toMatchObject({ status: 'info', detail: '1.5 USDC.' })
  })

  it('fails a malformed hash, a missing or a reverted transaction', () => {
    const malformed = payment({ proof: { txHash: '0x1234' } })
    expect(status('pay-cited', facts({ file: file({}), payment: malformed }))).toBe('fail')
    expect(status('pay-exists', facts({ file: file({}), payment: payment({ tx: { found: false, transfers: [] } }) }))).toBe('fail')
    const reverted = payment({ tx: { found: true, reverted: true, transfers: [] } })
    expect(status('pay-exists', facts({ file: file({}), payment: reverted }))).toBe('fail')
  })

  it('is unknown on a chain it cannot read', () => {
    const f = facts({ file: file({}), payment: payment({ chainId: 1, tx: undefined }) })
    expect(check('pay-exists', f)).toMatchObject({ status: 'unknown', detail: 'Chain 1 is not one this explorer can read.' })
  })

  it('warns when the payer is not the reviewer and fails when nothing links them', () => {
    const third = payment({
      proof: { fromAddress: B, toAddress: WALLET, txHash: PAY },
      tx: { found: true, blockNumber: 400n, transfers: [{ from: B, to: WALLET, amount: 1n, token: null }] },
    })
    expect(check('pay-parties', facts({ file: file({}), payment: third }))).toMatchObject({ status: 'warn' })
    const unrelated = payment({ tx: { found: true, blockNumber: 400n, transfers: [{ from: B, to: C, amount: 1n, token: null }] } })
    expect(status('pay-parties', facts({ file: file({}), payment: unrelated }))).toBe('fail')
  })

  it('fails a payment made after the feedback, by block or by time', () => {
    const late = payment({ tx: { found: true, blockNumber: 501n, transfers: [] } })
    expect(status('pay-order', facts({ file: file({}), payment: late }))).toBe('fail')
    const otherChain = (timestamp: number) => payment({ chainId: 1, tx: { found: true, blockNumber: 9n, timestamp, transfers: [] } })
    expect(status('pay-order', facts({ file: file({}), payment: otherChain(NOW - 2000) }))).toBe('pass')
    expect(status('pay-order', facts({ file: file({}), payment: otherChain(NOW) }))).toBe('fail')
  })

  it('fails a payment that other reviewers cite too, and warns when the same reviewer reuses it', () => {
    expect(check('pay-unique', facts({ file: file({}), payment: payment({ reusedByOthers: 2, reusedBySame: 1 }) }))).toMatchObject({
      status: 'fail',
      detail: 'The same payment backs 2 reviews of other reviewers on this agent.',
    })
    expect(check('pay-unique', facts({ file: file({}), payment: payment({ reusedBySame: 1 }) }))).toMatchObject({
      status: 'warn',
      detail: 'The same payment backs 1 other review of this reviewer.',
    })
  })
})

describe('reviewer checks', () => {
  it('fails the agent rating itself', () => {
    const feedback = [row(WALLET, 100), ...FEEDBACK.slice(1)]
    expect(status('rev-independent', facts(), context(feedback))).toBe('fail')
    expect(status('rev-independent', facts())).toBe('pass')
  })

  it('judges wallet activity for EOAs only', () => {
    expect(status('rev-activity', facts({ reviewer: { nonce: 1, kind: 'eoa' } }))).toBe('warn')
    expect(status('rev-activity', facts({ reviewer: { nonce: 40, kind: 'delegated' } }))).toBe('pass')
    expect(status('rev-activity', facts({ reviewer: { nonce: 1, kind: 'contract' } }))).toBe('info')
    expect(status('rev-activity', facts())).toBe('unknown')
  })

  it('reads breadth, variety and revocations from the reviewer’s other feedback', () => {
    const rows = [
      { tokenId: 22n, value: 90, revoked: false },
      { tokenId: 7n, value: 40, revoked: false },
      { tokenId: 9n, value: 90, revoked: false },
    ]
    const f = facts({ reviewer: { rows } })
    expect(check('rev-breadth', f)).toMatchObject({ status: 'pass', detail: 'Rated 3 agents (all its reviews).' })
    expect(status('rev-varied', f)).toBe('pass')
    expect(status('rev-stands', f)).toBe('pass')
  })

  it('warns on a single-agent reviewer that always gives the same value and revokes a lot', () => {
    const rows = [100, 100, 100, 100].map((value, i) => ({ tokenId: 22n, value, revoked: i === 0 }))
    const f = facts({ reviewer: { rows: [...rows, { tokenId: 22n, value: 100, revoked: true }], rowsTruncated: true } })
    expect(check('rev-breadth', f)).toMatchObject({ status: 'warn', detail: 'Only ever rated this agent (its latest 5 reviews).' })
    expect(check('rev-varied', f)).toMatchObject({ status: 'warn', detail: 'All 3 reviews give the same value (100).' })
    expect(check('rev-stands', f)).toMatchObject({ status: 'warn', detail: 'Revoked 2 of its 5 reviews.' })
  })

  it('is unknown when the feed holds nothing from the reviewer', () => {
    expect(status('rev-breadth', facts())).toBe('unknown')
    const empty = facts({ reviewer: { rows: [], rowsSince: 1_700_000_000 } })
    expect(check('rev-varied', empty).detail).toBe('No feedback from this address in the scanned window (since 2023-11-14).')
  })
})

describe('checks within the agent', () => {
  it('measures concentration and the reviewer’s own share', () => {
    const f = facts()
    expect(check('agent-concentration', f)).toMatchObject({ status: 'pass', detail: 'HHI 0.25 (as if 4.0 equal reviewers) over 4 reviewers; the top 3 wrote 75%.' })
    expect(check('agent-voice', f)).toMatchObject({ status: 'pass', detail: 'Wrote 1 of the 4 counted reviews (25%).' })

    const farmed = [row(A, 90), row(A, 80), row(A, 70), row(B, 60)]
    expect(check('agent-concentration', facts(), context(farmed))).toMatchObject({ status: 'warn' })
    expect(status('agent-voice', facts(), context(farmed))).toBe('warn')
    expect(status('agent-voice', facts(), context(farmed.slice(0, 2)))).toBe('unknown')
  })

  it('carries the authenticity weight of the review', () => {
    expect(status('agent-weight', facts())).toBe('pass')
    const duplicate = [row(A, 90), row(A, 90), row(C, 70)]
    expect(check('agent-weight', facts(), context(duplicate, { index: 1 }))).toMatchObject({
      status: 'fail',
      detail: 'Weight 0 (duplicate): it does not count in the weighted score.',
    })
  })

  it('flags feedback left right after the agent was registered', () => {
    expect(status('agent-early', facts())).toBe('unknown')
    expect(status('agent-early', facts(), context(FEEDBACK, { agentCreatedAt: NOW - 1600 }))).toBe('warn')
    expect(status('agent-early', facts(), context(FEEDBACK, { agentCreatedAt: NOW - 90_000 }))).toBe('pass')
  })

  it('reports the leave-one-out shift of the weighted score', () => {
    // (90+80+70+60)/4 = 75; without the 90: 70.
    expect(check('agent-influence', facts()).detail).toBe('Without it the weighted score moves 75.00 → 70.00 (-5.00).')
  })
})

describe('evidence band', () => {
  it('counts verdicts, leaving measurements out', () => {
    const { band, groups } = evaluateTxDetail(facts(), context())
    const verdicts = groups.flatMap((g) => g.checks).filter((c) => c.status !== 'info')
    expect(band.total).toBe(verdicts.length)
    expect(band.pass + band.warn + band.fail + band.missing + band.unknown).toBe(band.total)
    expect(band.low).toBe(band.pass)
    expect(band.high).toBe(band.pass + band.unknown)
  })
})

describe('helpers', () => {
  it('computes the Herfindahl index', () => {
    expect(herfindahl([1])).toBe(1)
    expect(herfindahl([0.5, 0.5])).toBe(0.5)
    expect(herfindahl([])).toBe(0)
  })

  it('computes Shannon entropy in bits', () => {
    expect(entropyBits([5, 5, 5])).toBe(0)
    expect(entropyBits([1, 2, 3, 4])).toBe(2)
  })
})
