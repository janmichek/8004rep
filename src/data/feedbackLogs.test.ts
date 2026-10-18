import { describe, expect, it } from 'vitest'
import type { Address, Hex, PublicClient } from 'viem'
import type { ChainInfo } from '../chains'
import {
  mapNewFeedbackLog,
  markRevoked,
  mergeFeedback,
  scanFeedback,
  scanWindows,
  type NewFeedbackLog,
} from './feedbackLogs'
import type { FeedbackEvent } from './types'

const CLIENT = '0x928607eFdFCF7D14FA08A1E92e551C47201dbf0F' as Address

function log(over: Partial<NewFeedbackLog> = {}): NewFeedbackLog {
  return {
    args: {
      agentId: 221n,
      clientAddress: CLIENT,
      feedbackIndex: 1n,
      value: 100n,
      valueDecimals: 0,
      tag1: '',
      tag2: '',
      endpoint: '',
      feedbackURI: '',
      ...over.args,
    },
    blockNumber: 100n,
    logIndex: 0,
    transactionHash: '0xabc' as Hex,
    ...over,
  }
}

describe('scanWindows', () => {
  it('returns consecutive windows ending at the head', () => {
    expect(scanWindows(100n, 10n, 3, 0n)).toEqual([
      { from: 91n, to: 100n },
      { from: 81n, to: 90n },
      { from: 71n, to: 80n },
    ])
  })

  it('clamps the oldest window at the floor', () => {
    expect(scanWindows(25n, 10n, 8, 0n)).toEqual([
      { from: 16n, to: 25n },
      { from: 6n, to: 15n },
      { from: 0n, to: 5n },
    ])
  })

  it('handles a head smaller than one range', () => {
    expect(scanWindows(5n, 10n, 8, 0n)).toEqual([{ from: 0n, to: 5n }])
  })

  it('stops exactly at the floor without going below', () => {
    expect(scanWindows(20n, 10n, 8, 11n)).toEqual([{ from: 11n, to: 20n }])
  })

  it('returns nothing below the floor or for degenerate input', () => {
    expect(scanWindows(5n, 10n, 8, 10n)).toEqual([])
    expect(scanWindows(100n, 0n, 8, 0n)).toEqual([])
    expect(scanWindows(100n, 10n, 0, 0n)).toEqual([])
  })
})

describe('mapNewFeedbackLog', () => {
  it('scales the value and keeps the index, tags, endpoint, URI and tx', () => {
    const row = mapNewFeedbackLog(
      log({
        args: {
          agentId: 221n,
          clientAddress: CLIENT,
          feedbackIndex: 3n,
          value: 9050n,
          valueDecimals: 2,
          tag1: 'starred',
          tag2: 'swap',
          endpoint: 'https://a.example',
          feedbackURI: 'data:application/json,{}',
        },
        blockNumber: 50n,
        logIndex: 7,
        transactionHash: '0xdef' as Hex,
      }),
    )
    expect(row).toMatchObject({
      tokenId: 221n,
      client: CLIENT,
      index: 3,
      value: 90.5,
      tag1: 'starred',
      tag2: 'swap',
      endpoint: 'https://a.example',
      feedbackURI: 'data:application/json,{}',
      revoked: false,
      txHash: '0xdef',
    })
  })

  it('renders negative and unscaled values as-is', () => {
    expect(mapNewFeedbackLog(log({ args: { value: -50n, valueDecimals: 0 } })).value).toBe(-50)
    expect(mapNewFeedbackLog(log({ args: { value: 1143n, valueDecimals: 0 } })).value).toBe(1143)
  })

  it('drops empty strings', () => {
    const row = mapNewFeedbackLog(log())
    expect('tag1' in row).toBe(false)
    expect('endpoint' in row).toBe(false)
    expect('feedbackURI' in row).toBe(false)
  })
})

describe('markRevoked', () => {
  const rows = [
    { ...mapNewFeedbackLog(log({ args: { agentId: 1n, clientAddress: CLIENT, feedbackIndex: 0n } })) },
    { ...mapNewFeedbackLog(log({ args: { agentId: 1n, clientAddress: CLIENT, feedbackIndex: 1n } })) },
  ]

  it('marks only the matching (agent, client, index)', () => {
    const marked = markRevoked(rows, [{ args: { agentId: 1n, clientAddress: CLIENT, feedbackIndex: 1n } }])
    expect(marked.map((r) => r.revoked)).toEqual([false, true])
  })

  it('matches clients case-insensitively', () => {
    const marked = markRevoked(rows, [
      { args: { agentId: 1n, clientAddress: CLIENT.toLowerCase() as Address, feedbackIndex: 0n } },
    ])
    expect(marked[0].revoked).toBe(true)
  })

  it('leaves rows alone without revocations', () => {
    expect(markRevoked(rows, []).map((r) => r.revoked)).toEqual([false, false])
  })
})

describe('mergeFeedback', () => {
  it('fills dates, endpoint, URI and tx on the matching row only', () => {
    const base = [
      { client: CLIENT, index: 0, value: 80, revoked: false },
      { client: '0x00000000000000000000000000000000000000b2' as Address, value: 90, revoked: false },
    ]
    const scanned: FeedbackEvent[] = [
      {
        tokenId: 7n,
        client: CLIENT,
        index: 0,
        value: 80,
        revoked: false,
        createdAt: 1791000000,
        endpoint: 'https://a.example',
        feedbackURI: 'data:application/json,{}',
        txHash: '0xabc' as Hex,
      },
    ]
    expect(mergeFeedback(base, scanned)).toEqual([
      {
        client: CLIENT,
        index: 0,
        value: 80,
        revoked: false,
        createdAt: 1791000000,
        endpoint: 'https://a.example',
        feedbackURI: 'data:application/json,{}',
        txHash: '0xabc',
      },
      base[1],
    ])
  })
})

/** Minimal chain for scan tests: 10-block ranges, no floor. */
function testChain(): ChainInfo {
  return {
    chainId: 421614,
    name: 'Test',
    shortName: 'Test',
    slug: 'test',
    testnet: true,
    explorerUrl: 'https://example.com',
    scanUrl: 'https://example.com',
    rpcUrl: 'https://example.com',
    viemChain: {} as ChainInfo['viemChain'],
    identity: '0x0000000000000000000000000000000000000001' as Address,
    reputation: '0x0000000000000000000000000000000000000002' as Address,
    logRange: 10n,
  }
}

function fakeClient(scripts: {
  head?: bigint
  given?: NewFeedbackLog[]
  revokedArgs?: { agentId?: bigint; clientAddress?: Address; feedbackIndex?: bigint }[]
  blockTime?: (block: bigint) => bigint
}): { client: PublicClient; calls: { getLogs: number; getBlock: number } } {
  const calls = { getLogs: 0, getBlock: 0 }
  const client = {
    async getBlockNumber() {
      return scripts.head ?? 100n
    },
    async getLogs(params: { event?: { name: string }; fromBlock?: bigint; toBlock?: bigint }) {
      calls.getLogs++
      // A node only returns the logs inside the requested window.
      const inWindow = (b: bigint) =>
        (params.fromBlock === undefined || b >= params.fromBlock) &&
        (params.toBlock === undefined || b <= params.toBlock)
      if (params.event?.name === 'FeedbackRevoked')
        return (scripts.revokedArgs ?? []).map((args) => ({ args }))
      return (scripts.given ?? []).filter((l) => inWindow(l.blockNumber))
    },
    async getBlock({ blockNumber }: { blockNumber: bigint }) {
      calls.getBlock++
      return { timestamp: scripts.blockTime?.(blockNumber) ?? blockNumber * 10n }
    },
  } as unknown as PublicClient
  return { client, calls }
}

describe('scanFeedback', () => {
  it('maps logs newest-first and resolves dates via getBlock when the log has none', async () => {
    const { client, calls } = fakeClient({
      head: 50n,
      given: [
        log({ blockNumber: 20n, logIndex: 1, args: { agentId: 1n, feedbackIndex: 0n, value: 80n } }),
        log({ blockNumber: 45n, logIndex: 0, args: { agentId: 2n, feedbackIndex: 0n, value: 90n } }),
      ],
    })
    const page = await scanFeedback(client, testChain())
    expect(page.items.map((i) => i.tokenId)).toEqual([2n, 1n])
    expect(page.items[0].createdAt).toBe(450)
    expect(page.items[1].createdAt).toBe(200)
    expect(calls.getBlock).toBeGreaterThan(0)
    // 8 windows of 10 from block 50 reach the floor: no cursor, `since` is block 0's time.
    expect(page.cursor).toBeUndefined()
    expect(page.since).toBe(0)
  })

  it('uses the log timestamp when present and pages with a cursor', async () => {
    const { client } = fakeClient({
      head: 1000n,
      given: [log({ blockNumber: 999n, blockTimestamp: 1791000000n })],
    })
    const page = await scanFeedback(client, testChain())
    expect(page.items[0].createdAt).toBe(1791000000)
    // 8 × 10 blocks from 1000 → oldest from 921, cursor just below it.
    expect(page.cursor).toBe('920')
    expect(page.since).toBeDefined()
  })

  it('continues from a cursor and treats blockTimestamp 0 as missing', async () => {
    const seen: string[] = []
    const base = fakeClient({
      head: 1000n,
      given: [log({ blockNumber: 915n, blockTimestamp: 0n })],
    })
    const wrapped = {
      ...base.client,
      getLogs: (async (params: { fromBlock: bigint }) => {
        seen.push(String(params.fromBlock))
        return base.client.getLogs(params as never)
      }) as typeof base.client.getLogs,
    }
    const page = await scanFeedback(wrapped, testChain(), { cursor: '930' })
    expect(seen[0]).toBe('921')
    expect(page.items[0].createdAt).toBe(9150)
  })

  it('returns an empty page below the floor', async () => {
    const { client } = fakeClient({})
    const chain = { ...testChain(), reputationFromBlock: 50n }
    expect(await scanFeedback(client, chain, { cursor: '10' })).toEqual({ items: [] })
  })
})
