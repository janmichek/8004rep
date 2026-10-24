import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Address } from 'viem'
import type { ChainInfo } from '../chains'
import { createSubgraphSource, gql, mapAgent, mapFeedback, mapFeedbackEvent } from './subgraph'

function respond(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('gql', () => {
  it('returns data', async () => {
    respond(200, { data: { agents: [] } })
    expect(await gql('https://sg.example', '{ agents { id } }')).toEqual({ agents: [] })
  })

  it('rejects with the subgraph message on an error body, whatever the status', async () => {
    respond(409, { errors: [{ message: 'Studio development indexing is unavailable for this version.' }] })
    await expect(gql('https://sg.example', '{ x }')).rejects.toThrow('indexing is unavailable')
    respond(200, { errors: [{ message: 'Cannot query field "nope"' }] })
    await expect(gql('https://sg.example', '{ nope }')).rejects.toThrow('Cannot query field')
  })

  it('rejects on HTTP errors and non-JSON bodies', async () => {
    respond(502, null)
    await expect(gql('https://sg.example', '{ x }')).rejects.toThrow('HTTP 502')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      }),
    )
    await expect(gql('https://sg.example', '{ x }')).rejects.toThrow('HTTP 200')
  })
})

describe('mapAgent', () => {
  it('maps an indexed registration file', () => {
    const agent = mapAgent(84532, {
      agentId: '9540',
      owner: '0x987af5e92fbc65282bf2dd19842d5ee43e0a06b4',
      agentURI: 'ipfs://bafy',
      createdAt: '1791125186',
      totalFeedback: '3',
      registrationFile: {
        name: 'Swap bot',
        x402Support: true,
        mcpEndpoint: 'https://a.example/mcp',
        mcpVersion: '2025-06-18',
        a2aEndpoint: 'https://a.example/card.json',
      },
    })
    expect(agent).toMatchObject({
      chainId: 84532,
      tokenId: 9540n,
      owner: '0x987af5e92fbc65282bf2dd19842d5ee43e0a06b4',
      createdAt: 1791125186,
      totalFeedback: 3,
    })
    expect(agent.file?.name).toBe('Swap bot')
    expect(agent.file?.services).toEqual([
      { name: 'MCP', endpoint: 'https://a.example/mcp', version: '2025-06-18' },
      { name: 'A2A', endpoint: 'https://a.example/card.json' },
    ])
  })

  it('leaves the file unresolved when only the URI is indexed', () => {
    const agent = mapAgent(11155111, { agentId: '1580', agentURI: 'ipfs://Qm', registrationFile: null })
    expect('file' in agent).toBe(false)
  })

  it('marks agents without a URI as having no file', () => {
    const agent = mapAgent(11155111, { agentId: '1579', agentURI: null, registrationFile: null })
    expect(agent).toMatchObject({ agentURI: null, owner: null, file: null })
  })
})

describe('listAgents owner filter', () => {
  it('asks the subgraph for that owner, lowercased, and pages', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          agents: [
            { agentId: '9', owner: '0xabc', agentURI: null },
            { agentId: '8', owner: '0xabc', agentURI: null },
          ],
        },
      }),
    })
    vi.stubGlobal('fetch', fetch)
    const source = createSubgraphSource({ chainId: 84532, subgraphUrl: 'https://sg.example' } as unknown as ChainInfo & {
      subgraphUrl: string
    })
    const page = await source.listAgents({
      page: 1,
      pageSize: 1,
      owner: '0xAbCdEF0000000000000000000000000000000000' as Address,
    })
    const body = JSON.parse((fetch.mock.calls[0][1] as { body: string }).body) as {
      variables: { where: { owner: string }; first: number; skip: number }
    }
    expect(body.variables.where.owner).toBe('0xabcdef0000000000000000000000000000000000')
    expect(body.variables).toMatchObject({ first: 2, skip: 1 })
    expect(page.hasMore).toBe(true)
    expect(page.items.map((agent) => agent.tokenId)).toEqual([9n])
  })

  it('passes the requested sort field and direction to the subgraph', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { agents: [] } }),
    })
    vi.stubGlobal('fetch', fetch)
    const source = createSubgraphSource({ chainId: 84532, subgraphUrl: 'https://sg.example' } as unknown as ChainInfo & {
      subgraphUrl: string
    })
    await source.listAgents({ page: 0, pageSize: 10, owner: '0xabc' as Address, sort: 'tokenId', order: 'asc' })
    const body = JSON.parse((fetch.mock.calls[0][1] as { body: string }).body) as {
      variables: { orderBy: string; orderDirection: string }
    }
    expect(body.variables).toMatchObject({ orderBy: 'agentId', orderDirection: 'asc' })
  })
})

describe('mapFeedback', () => {
  it('keeps the index and comment URI', () => {
    expect(
      mapFeedback({
        clientAddress: '0xb24268884472e7613aa58d38c8813f7af1667382',
        feedbackIndex: '4',
        value: '1143',
        tag1: 'hyperdag_repid',
        tag2: 'tier:ESTABLISHED',
        endpoint: 'https://trustrepid.dev/api/v1/agents/x/reputation/payload.json',
        feedbackURI: 'https://trustrepid.dev/api/v1/agents/x/reputation/payload.json',
        isRevoked: false,
        createdAt: '1791115556',
      }),
    ).toEqual({
      client: '0xb24268884472e7613aa58d38c8813f7af1667382',
      index: 4,
      value: 1143,
      tag1: 'hyperdag_repid',
      tag2: 'tier:ESTABLISHED',
      endpoint: 'https://trustrepid.dev/api/v1/agents/x/reputation/payload.json',
      feedbackURI: 'https://trustrepid.dev/api/v1/agents/x/reputation/payload.json',
      revoked: false,
      createdAt: 1791115556,
    })
  })

  it('drops empty fields', () => {
    expect(
      mapFeedback({ clientAddress: '0xabc', value: '0', tag1: '', endpoint: null, isRevoked: true }),
    ).toEqual({ client: '0xabc', value: 0, revoked: true })
  })
})

describe('mapFeedbackEvent', () => {
  it('attaches the agent id and name', () => {
    const event = mapFeedbackEvent({
      clientAddress: '0xabc',
      value: '60',
      isRevoked: false,
      agent: { agentId: '6832', registrationFile: { name: 'Attention Agent' } },
    })
    expect(event).toMatchObject({ tokenId: 6832n, agentName: 'Attention Agent', value: 60 })
  })

  it('works without an indexed agent or name', () => {
    const event = mapFeedbackEvent({ clientAddress: '0xabc', value: '60', isRevoked: false, agent: null })
    expect(event.tokenId).toBe(0n)
    expect('agentName' in event).toBe(false)
  })
})
