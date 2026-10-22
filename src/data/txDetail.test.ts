import { describe, expect, it } from 'vitest'
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  getAddress,
  keccak256,
  stringToBytes,
  TransactionNotFoundError,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from 'viem'
import { newFeedbackEvent } from '../abi'
import { CHAINS } from '../chains'
import { bracketTimestamp, canonicalJson, loadTxFacts, schemeOf, transfersOf, windowAt, type BlockRef } from './txDetail'
import type { DataSource, Feedback } from './types'

const CHAIN = CHAINS.find((c) => c.chainId === 84532)!
const A = '0x00000000000000000000000000000000000000a1' as Address
const B = '0x00000000000000000000000000000000000000b2' as Address
const WALLET = '0x00000000000000000000000000000000000000f1' as Address
const USDC = '0x00000000000000000000000000000000000000c0' as Address
const TX = `0x${'11'.repeat(32)}` as Hex
const PAY = `0x${'22'.repeat(32)}` as Hex
const ZERO = `0x${'00'.repeat(32)}` as Hex

/** Chain whose block `n` was mined at `time(n)`; counts the probes. */
function blocks(time: (n: bigint) => number) {
  const state = { calls: 0 }
  const getBlock = async (number: bigint): Promise<BlockRef> => {
    state.calls++
    return { number, timestamp: time(number) }
  }
  const at = (number: bigint): BlockRef => ({ number, timestamp: time(number) })
  return { getBlock, at, state }
}

describe('bracketTimestamp', () => {
  it('lands on steady block times in a couple of probes', async () => {
    const chain = blocks((n) => 1_000_000 + Number(n) * 2)
    const target = 31_234_567n
    const window = await bracketTimestamp(chain.getBlock, chain.at(target).timestamp, chain.at(0n), chain.at(40_000_000n), 1_000n)
    expect(window!.from).toBeLessThanOrEqual(target)
    expect(window!.to).toBeGreaterThanOrEqual(target)
    expect(window!.to - window!.from + 1n).toBeLessThanOrEqual(1_000n)
    expect(chain.state.calls).toBeLessThanOrEqual(3)
  })

  it('still converges when block times are uneven', async () => {
    // Slow blocks for the first half of the chain, eight a second after.
    const time = (n: bigint) => (n < 1_000_000n ? Number(n) * 12 : 12_000_000 + Math.floor(Number(n - 1_000_000n) / 8))
    const chain = blocks(time)
    for (const target of [5n, 999_999n, 1_000_123n, 1_987_654n]) {
      const window = await bracketTimestamp(chain.getBlock, time(target), chain.at(0n), chain.at(2_000_000n), 500n)
      expect(window).not.toBeNull()
      expect(window!.to - window!.from + 1n).toBeLessThanOrEqual(500n)
      // Blocks sharing the second of the target are all acceptable hits.
      const inside = [window!.from, window!.to].map(time)
      expect(inside[0]).toBeLessThanOrEqual(time(target))
      expect(inside[1]).toBeGreaterThanOrEqual(time(target))
    }
    expect(chain.state.calls).toBeLessThan(4 * 48)
  })

  it('needs no probe when the range already fits', async () => {
    const chain = blocks((n) => Number(n))
    expect(await bracketTimestamp(chain.getBlock, 50, chain.at(0n), chain.at(99n), 100n)).toEqual({ from: 0n, to: 99n })
    expect(chain.state.calls).toBe(0)
  })

  it('is null outside the range and gives up when the probes run out', async () => {
    const steady = blocks((n) => Number(n) * 2)
    expect(await bracketTimestamp(steady.getBlock, 999, steady.at(0n), steady.at(100n), 10n)).toBeNull()
    // Accelerating blocks: two probes cannot pin a single block among a million.
    const uneven = blocks((n) => Math.floor(Number(n) ** 2 / 1_000))
    const window = await bracketTimestamp(uneven.getBlock, uneven.at(700_000n).timestamp, uneven.at(0n), uneven.at(1_000_000n), 1n, 2)
    expect(window).toBeNull()
    expect(uneven.state.calls).toBe(2)
  })

  it('propagates a failed probe', async () => {
    const getBlock = async (): Promise<BlockRef> => {
      throw new Error('rate limited')
    }
    const window = bracketTimestamp(getBlock, 500, { number: 0n, timestamp: 0 }, { number: 1_000n, timestamp: 1_000 }, 10n)
    await expect(window).rejects.toThrow('rate limited')
  })
})

describe('windowAt', () => {
  it('finds a recent block without asking for pruned history', async () => {
    // A 2 s chain whose node only serves the last 3.5 million blocks.
    const time = (n: bigint) => 1_000_000 + Number(n) * 2
    const asked: bigint[] = []
    const getBlock = async (number: bigint): Promise<BlockRef> => {
      asked.push(number)
      if (number < 46_500_000n) throw new Error('pruned history unavailable')
      return { number, timestamp: time(number) }
    }
    const head = { number: 50_000_000n, timestamp: time(50_000_000n) }
    const target = 49_123_456n
    const window = await windowAt(getBlock, time(target), head, 36_304_146n, 1_000n)
    expect(window!.from).toBeLessThanOrEqual(target)
    expect(window!.to).toBeGreaterThanOrEqual(target)
    expect(window!.to - window!.from + 1n).toBeLessThanOrEqual(1_000n)
    expect(asked.length).toBeLessThanOrEqual(4)
  })

  it('doubles back when the chain used to be slower, and stops at the floor', async () => {
    const time = (n: bigint) => (n < 900_000n ? Number(n) * 10 : 9_000_000 + Number(n - 900_000n))
    const chain = blocks(time)
    for (const target of [0n, 123_456n, 899_999n, 950_000n, 999_990n]) {
      const window = await windowAt(chain.getBlock, time(target), chain.at(1_000_000n), 0n, 2_000n)
      expect(window!.from).toBeLessThanOrEqual(target)
      expect(window!.to).toBeGreaterThanOrEqual(target)
    }
  })

  it('is null for a date outside the chain', async () => {
    const chain = blocks((n) => 1_000 + Number(n) * 2)
    expect(await windowAt(chain.getBlock, 999_999, chain.at(5_000n), 0n, 100n)).toBeNull()
    expect(await windowAt(chain.getBlock, 500, chain.at(5_000n), 0n, 100n)).toBeNull()
    expect(await windowAt(chain.getBlock, 1_000, chain.at(0n), 0n, 100n)).toEqual({ from: 0n, to: 0n })
  })
})

describe('canonicalJson', () => {
  it('sorts keys at every level and drops whitespace, keeping array order', () => {
    const pretty = JSON.parse('{ "b": 1,\n "a": { "d": [3, {"z": 1, "y": 2}], "c": null } }')
    expect(canonicalJson(pretty)).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}')
  })

  it('reproduces the feedbackHash of a real pinned file', () => {
    // Arbitrum Sepolia agent 221: pinned pretty-printed, committed as the canonical form.
    const pinned = {
      agentRegistry: 'eip155:421614:0x8004A818BFB912233c491871b3d84c89A494BD9e',
      agentId: 221,
      clientAddress: 'eip155:421614:0x928607eFdFCF7D14FA08A1E92e551C47201dbf0F',
      createdAt: '2026-09-18T09:26:17.250Z',
      value: 100,
      valueDecimals: 0,
      tag1: 'starred',
      tag2: 'balance',
      endpoint: 'http://localhost:5173/api/agents/agent005/chat#get_token_balance',
      text: 'good job',
    }
    expect(keccak256(stringToBytes(canonicalJson(pinned)))).toBe(
      '0x0316d3363cf09f7313629491a8e632366a744c29ecdd75c74601177dc1a76273',
    )
  })
})

describe('schemeOf', () => {
  it('names the scheme of a feedback URI', () => {
    expect(schemeOf('data:application/json;base64,e30=')).toBe('data')
    expect(schemeOf(' IPFS://bafy')).toBe('ipfs')
    expect(schemeOf('https://a.example/f.json')).toBe('https')
    expect(schemeOf('ar://abc')).toBe('other')
  })
})

function log(address: Address, topics: Hex[], data: Hex): Log {
  return {
    address,
    topics: topics as [Hex, ...Hex[]],
    data,
    blockHash: ZERO,
    blockNumber: 500n,
    logIndex: 0,
    transactionHash: TX,
    transactionIndex: 0,
    removed: false,
  }
}

function transferLog(token: Address, from: Address, to: Address, value: bigint): Log {
  const topics = encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }) as Hex[]
  return log(token, topics, encodeAbiParameters([{ type: 'uint256' }], [value]))
}

describe('transfersOf', () => {
  it('reads the native value and the ERC-20 transfers', () => {
    const transfers = transfersOf({ from: A, to: WALLET, value: 5n }, [transferLog(USDC, A, WALLET, 1_500_000n)])
    expect(transfers).toEqual([
      { from: A, to: WALLET, amount: 5n, token: null },
      // Decoded log addresses come back checksummed.
      { from: getAddress(A), to: getAddress(WALLET), amount: 1_500_000n, token: USDC },
    ])
  })

  it('skips logs that are not ERC-20 transfers', () => {
    // An ERC-721 Transfer: same signature, the token id as a fourth topic, no data.
    const [signature, from, to] = encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from: A, to: B } }) as Hex[]
    const nft = log(USDC, [signature, from, to, `0x${'00'.repeat(31)}07`], '0x')
    expect(transfersOf({ from: A, to: B, value: 0n }, [nft])).toEqual([])
  })
})

function feedbackLog(client: Address, index: bigint, feedbackURI: string, feedbackHash: Hex): Log {
  const topics = encodeEventTopics({
    abi: [newFeedbackEvent],
    eventName: 'NewFeedback',
    args: { agentId: 22n, clientAddress: client, indexedTag1: 'starred' },
  }) as Hex[]
  const data = encodeAbiParameters(
    [
      { type: 'uint64' },
      { type: 'int128' },
      { type: 'uint8' },
      { type: 'string' },
      { type: 'string' },
      { type: 'string' },
      { type: 'string' },
      { type: 'bytes32' },
    ],
    [index, 90n, 0, 'starred', '', 'https://agent.example/mcp', feedbackURI, feedbackHash],
  )
  return log(CHAIN.reputation, topics, data)
}

function dataUri(json: unknown): string {
  return `data:application/json;base64,${btoa(JSON.stringify(json))}`
}

type Fake = Partial<Record<keyof PublicClient, (args: never) => unknown>>

function fakeClient(overrides: Fake = {}): PublicClient {
  const fake: Fake = {
    getTransaction: async ({ hash }: { hash: Hex }) => {
      if (hash === TX) return { from: A, to: CHAIN.reputation, value: 0n }
      if (hash === PAY) return { from: B, to: USDC, value: 0n }
      throw new TransactionNotFoundError({ hash })
    },
    getTransactionReceipt: async ({ hash }: { hash: Hex }) =>
      hash === TX
        ? { blockNumber: 500n, gasUsed: 100_000n, effectiveGasPrice: 10n, status: 'success', logs: [] }
        : { blockNumber: 400n, gasUsed: 1n, effectiveGasPrice: 1n, status: 'success', logs: [transferLog(USDC, A, WALLET, 1_500_000n)] },
    getTransactionCount: async () => 12,
    getCode: async () => undefined,
    readContract: async ({ functionName }: { functionName: string }) => (functionName === 'symbol' ? 'USDC' : 6),
    ...overrides,
  }
  return fake as unknown as PublicClient
}

function fakeSource(items: { tokenId: bigint; value: number; revoked: boolean }[] = []): DataSource {
  return {
    kind: 'rpc',
    supportsTextSearch: false,
    listAgents: async () => ({ items: [], hasMore: false }),
    getAgent: async () => null,
    listFeedback: async () => ({ items: items.map((item) => ({ client: A, ...item })), since: 1_700_000_000 }),
  }
}

describe('loadTxFacts', () => {
  it('reads the transaction, the file, the cited payment and the reviewer', async () => {
    const proof = { proofOfPayment: { fromAddress: A, toAddress: WALLET, chainId: '84532', txHash: PAY } }
    const uri = dataUri({ agentId: 22, value: 90, ...proof })
    const row: Feedback = { client: A, index: 1, value: 90, revoked: false, txHash: TX, feedbackURI: uri, createdAt: 2_000 }
    const sameReviewer: Feedback = { client: A, index: 2, value: 80, revoked: false, feedbackURI: dataUri({ tag: 'speed', ...proof }) }
    const otherReviewer: Feedback = { client: B, index: 1, value: 70, revoked: false, feedbackURI: dataUri({ text: 'fine' }) }
    const client = fakeClient({
      getTransactionReceipt: async ({ hash }: { hash: Hex }) =>
        hash === TX
          ? {
              blockNumber: 500n,
              gasUsed: 100_000n,
              effectiveGasPrice: 10n,
              l1Fee: 7n,
              status: 'success',
              logs: [feedbackLog(A, 1n, uri, ZERO), feedbackLog(B, 1n, '', ZERO)],
            }
          : { blockNumber: 400n, gasUsed: 1n, effectiveGasPrice: 1n, status: 'success', logs: [transferLog(USDC, A, WALLET, 1_500_000n)] },
    })

    const facts = await loadTxFacts({
      chain: CHAIN,
      client,
      source: fakeSource([{ tokenId: 22n, value: 90, revoked: false }]),
      tokenId: 22n,
      row,
      feedback: [row, sameReviewer, otherReviewer],
    })

    expect(facts.tx).toEqual({
      hash: TX,
      from: A,
      to: CHAIN.reputation,
      blockNumber: 500n,
      feeWei: 1_000_007n,
      feedbackLogs: 2,
      feedbackHash: ZERO,
      feedbackURI: uri,
    })
    expect(facts.file).toMatchObject({ scheme: 'data', json: { agentId: 22, value: 90 } })
    expect(facts.file!.contentHash).toBe(keccak256(stringToBytes(JSON.stringify({ agentId: 22, value: 90, ...proof }))))
    expect(facts.payment).toEqual({
      proof: { fromAddress: A, toAddress: WALLET, chainId: 84532, txHash: PAY },
      chainId: 84532,
      tx: {
        found: true,
        reverted: false,
        blockNumber: 400n,
        transfers: [{ from: getAddress(A), to: getAddress(WALLET), amount: 1_500_000n, token: USDC, symbol: 'USDC', decimals: 6 }],
      },
      comparedFiles: 2,
      reusedByOthers: 0,
      reusedBySame: 1,
    })
    expect(facts.reviewer).toEqual({
      nonce: 12,
      kind: 'eoa',
      rows: [{ tokenId: 22n, value: 90, revoked: false }],
      rowsSince: 1_700_000_000,
    })
  })

  it('leaves out what cannot be read instead of failing', async () => {
    const row: Feedback = { client: A, index: 1, value: 90, revoked: false }
    const down = async () => {
      throw new Error('rate limited')
    }
    const client = fakeClient({ getTransactionCount: down, getCode: down })
    const source = { ...fakeSource(), listFeedback: down } as DataSource
    const facts = await loadTxFacts({ chain: CHAIN, client, source, tokenId: 22n, row, feedback: [row] })
    expect(facts).toEqual({
      tx: null,
      txNote: 'This review is older than the log scan reaches, so its transaction is not known.',
      file: null,
      payment: null,
      reviewer: {},
    })
  })

  it('finds the transaction of a dated review that carries no hash, and its URI with it', async () => {
    const uri = dataUri({ text: 'ok' })
    const row: Feedback = { client: A, index: 3, value: 90, revoked: false, createdAt: 1_000_000 + 2 * 4_321 }
    const seen: { fromBlock?: bigint; toBlock?: bigint } = {}
    const client = fakeClient({
      getBlock: async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
        const number = blockNumber ?? 50_000n
        return { number, timestamp: BigInt(1_000_000 + 2 * Number(number)) }
      },
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        Object.assign(seen, { fromBlock, toBlock })
        return [
          { args: { feedbackIndex: 2n }, transactionHash: PAY },
          { args: { feedbackIndex: 3n }, transactionHash: TX },
        ]
      },
      getTransactionReceipt: async () => ({
        blockNumber: 4_321n,
        gasUsed: 1n,
        effectiveGasPrice: 1n,
        status: 'success',
        logs: [feedbackLog(A, 3n, uri, ZERO)],
      }),
    })
    // Base Sepolia scans at most 1,000 blocks at a time, from the registry's creation block.
    const chain = { ...CHAIN, reputationFromBlock: 0n }
    const facts = await loadTxFacts({ chain, client, source: fakeSource(), tokenId: 22n, row, feedback: [row] })
    expect(facts.tx).toMatchObject({ hash: TX, feedbackURI: uri })
    expect(facts.file).toMatchObject({ uri, json: { text: 'ok' } })
    expect(seen.fromBlock).toBeLessThanOrEqual(4_321n)
    expect(seen.toBlock).toBeGreaterThanOrEqual(4_321n)
    expect(seen.toBlock! - seen.fromBlock! + 1n).toBeLessThanOrEqual(1_000n)
  })

  it('narrows the log window when the RPC refuses the configured range', async () => {
    const row: Feedback = { client: A, index: 3, value: 90, revoked: false, createdAt: 1_000_000 + 2 * 4_321 }
    const spans: bigint[] = []
    const client = fakeClient({
      getBlock: async ({ blockNumber }: { blockNumber?: bigint } = {}) => {
        const number = blockNumber ?? 50_000n
        return { number, timestamp: BigInt(1_000_000 + 2 * Number(number)) }
      },
      getLogs: async ({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) => {
        spans.push(toBlock - fromBlock + 1n)
        if (toBlock - fromBlock + 1n > 200n) throw new Error('eth_getLogs is limited to a 200 range')
        return fromBlock <= 4_321n && toBlock >= 4_321n ? [{ args: { feedbackIndex: 3n }, transactionHash: TX }] : []
      },
    })
    const chain = { ...CHAIN, reputationFromBlock: 0n }
    const facts = await loadTxFacts({ chain, client, source: fakeSource(), tokenId: 22n, row, feedback: [row] })
    expect(facts.tx).toMatchObject({ hash: TX })
    expect(spans.length).toBe(2)
    expect(spans[1]).toBeLessThanOrEqual(100n)
  })

  it('reports a cited payment that does not exist', async () => {
    const missing = `0x${'33'.repeat(32)}` as Hex
    const uri = dataUri({ proofOfPayment: { txHash: missing } })
    const row: Feedback = { client: A, index: 1, value: 90, revoked: false, txHash: TX, feedbackURI: uri }
    const facts = await loadTxFacts({ chain: CHAIN, client: fakeClient(), source: fakeSource(), tokenId: 22n, row, feedback: [row] })
    expect(facts.payment).toMatchObject({ chainId: 84532, tx: { found: false, transfers: [] } })
  })
})
