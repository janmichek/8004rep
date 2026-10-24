import { describe, expect, it } from 'vitest'
import { parseScanAgent, parseScanAgentDetail, parseScanAgentPage, parseScanChains, parseScanScore, parseScanStats } from './scan'

// Trimmed from GET /agents/1/22771 (2026-10-18).
const AGENT = {
  total_score: 93.73,
  scores: {
    last_scored_at: '2026-10-18T00:50:33.532850+00:00',
    breakdown: {
      version: '5.2',
      algorithm: 'v5_leaderboard_policy',
      dimensions: {
        service: { score: 95, weight: 0.25 },
        momentum: { score: 5, weight: 0.1 },
        publisher: { score: 48.58, weight: 0.2 },
        compliance: { score: 98, weight: 0.15 },
        engagement: { score: 71.37, weight: 0.3, details: { average_score: 97.75, feedback_count: 49, feedback_weight: 1 } },
      },
      leaderboard_policy: {
        score_band: { floor: 78, ceiling: 95 },
        weights: { proof: 0.7, support: 0.3 },
        proof_score: 100,
        support_score: 54.22,
        merit_score: 86.27,
        evidence_tier: 'battle-tested',
        integrity_tier: 'healthy',
      },
    },
  },
}

describe('parseScanScore', () => {
  it('reads the total, the dimensions heaviest first, and the feedback inputs', () => {
    const score = parseScanScore(AGENT)!
    expect(score.total).toBe(93.73)
    expect(score.dimensions.map((d) => d.id)).toEqual(['engagement', 'service', 'publisher', 'compliance', 'momentum'])
    expect(score.dimensions[0]).toEqual({ id: 'engagement', label: 'Engagement', score: 71.37, weight: 0.3 })
    expect(score.feedback).toEqual({ average: 97.75, count: 49, weight: 1 })
    expect(score.band).toEqual({ floor: 78, ceiling: 95 })
    expect(score.policy).toMatchObject({ proofWeight: 0.7, supportWeight: 0.3, proofScore: 100, supportScore: 54.22, merit: 86.27 })
    expect(score.algorithm).toBe('v5_leaderboard_policy v5.2')
    expect(score.scoredAt).toMatch(/^2026-10-18/)
  })

  it('keeps what it can from a partial or hostile body', () => {
    expect(parseScanScore(null)).toBeNull()
    expect(parseScanScore({ total_score: 'high' })).toBeNull()
    const score = parseScanScore({ total_score: 12, scores: { breakdown: { dimensions: { x: { score: '1', weight: 1 }, y: 7 } } } })
    expect(score).toEqual({ total: 12, dimensions: [] })
  })
})

describe('parseScanStats', () => {
  it('reads the ecosystem baseline', () => {
    expect(parseScanStats({ average_feedback_score: 92.86, total_feedbacks: 4022119, total_agents: 1003923 })).toEqual({
      averageFeedback: 92.86,
      totalFeedback: 4022119,
      totalAgents: 1003923,
    })
    expect(parseScanStats({ average_feedback_score: 92.86 })).toBeNull()
  })
})

describe('parseScanScore unscored', () => {
  it('reads a bare 0 without a breakdown as not scored', () => {
    expect(parseScanScore({ total_score: 0, scores: null })).toBeNull()
  })
})

describe('parseScanChains', () => {
  it('names the networks rows can come from', () => {
    expect(
      parseScanChains({
        supported_chains: [
          { chain_id: 4663, name: 'Robinhood Chain', key: 'robinhood_mainnet', is_testnet: false },
          { chain_id: 421614, name: 'Arbitrum Sepolia', key: 'arbitrum_sepolia', is_testnet: true },
          { chain_id: 'x', name: 'broken', key: 'broken' },
        ],
      }),
    ).toEqual([
      { chainId: 4663, name: 'Robinhood Chain', key: 'robinhood_mainnet', testnet: false },
      { chainId: 421614, name: 'Arbitrum Sepolia', key: 'arbitrum_sepolia', testnet: true },
    ])
  })
})

describe('parseScanAgent', () => {
  const row = {
    token_id: '19793',
    chain_id: 4663,
    owner_address: '0x52b42a3a08fd5a5404d12480bf1fd5f70a9e93d0',
    name: 'kakashigirl.agent',
    description: 'kakashigirl.agent on Termix Platform',
    image_url: 'https://api.8004scan.io/api/v1/media/agents/4663/19793/image',
    supported_protocols: ['CUSTOM'],
    x402_supported: false,
    total_score: 0,
    average_score: 0,
    total_feedbacks: 0,
    is_testnet: false,
    created_at: '2026-10-24T07:22:54Z',
  }

  it('maps a row and ignores stars', () => {
    expect(parseScanAgent({ ...row, star_count: 9 })).toEqual({
      chainId: 4663,
      tokenId: 19793n,
      name: 'kakashigirl.agent',
      description: 'kakashigirl.agent on Termix Platform',
      imageUrl: 'https://api.8004scan.io/api/v1/media/agents/4663/19793/image',
      owner: '0x52b42a3a08fd5a5404d12480bf1fd5f70a9e93d0',
      protocols: ['CUSTOM'],
      x402: false,
      totalScore: 0,
      averageScore: 0,
      feedbackCount: 0,
      createdAt: 1792826574,
      testnet: false,
    })
  })

  it('drops rows without a chain or token id', () => {
    expect(parseScanAgent({ ...row, chain_id: null })).toBeNull()
    expect(parseScanAgent({ ...row, token_id: 'x' })).toBeNull()
  })
})

describe('parseScanAgentPage', () => {
  it('reads the rows and pager from the envelope', () => {
    const page = parseScanAgentPage({
      success: true,
      data: [{ token_id: '1', chain_id: 1 }],
      meta: { pagination: { page: 1, limit: 25, total: 100, hasMore: true } },
    })!
    expect(page.items).toHaveLength(1)
    expect(page.total).toBe(100)
    expect(page.hasMore).toBe(true)
  })

  it('rejects a body without data', () => {
    expect(parseScanAgentPage({ success: false, data: [] })).toBeNull()
    expect(parseScanAgentPage({ success: true, data: null })).toBeNull()
  })
})

describe('parseScanAgentDetail', () => {
  const detail = {
    chain_id: 4217,
    token_id: '426',
    name: 'xylem-drainer',
    description: 'Helps LPs withdraw.',
    image_url: 'https://api.8004scan.io/api/v1/media/agents/4217/426/image',
    owner_address: '0x57bd992bf4c0452617c47ba3423de8b7a472d35d',
    agent_wallet: '0x57bd992bf4c0452617c47ba3423de8b7a472d35d',
    supported_protocols: ['A2A', 'Web'],
    x402_supported: false,
    services: {
      a2a: { endpoint: 'https://xylem-drainer.xyz/.well-known/agent-card.json', version: '0.3.0' },
      web: { endpoint: 'https://xylem-drainer.xyz/' },
    },
    supported_trust_models: ['reputation'],
    total_score: 42.5,
    average_score: 90,
    total_feedbacks: 3,
    is_active: true,
    created_at: '2026-10-24T08:00:04Z',
  }

  it('maps the identity and the services', () => {
    expect(parseScanAgentDetail(detail)).toEqual({
      chainId: 4217,
      tokenId: 426n,
      name: 'xylem-drainer',
      description: 'Helps LPs withdraw.',
      imageUrl: 'https://api.8004scan.io/api/v1/media/agents/4217/426/image',
      owner: '0x57bd992bf4c0452617c47ba3423de8b7a472d35d',
      agentWallet: '0x57bd992bf4c0452617c47ba3423de8b7a472d35d',
      protocols: ['A2A', 'Web'],
      x402: false,
      services: [
        { name: 'a2a', endpoint: 'https://xylem-drainer.xyz/.well-known/agent-card.json', version: '0.3.0' },
        { name: 'web', endpoint: 'https://xylem-drainer.xyz/' },
      ],
      supportedTrust: ['reputation'],
      totalScore: 42.5,
      averageScore: 90,
      feedbackCount: 3,
      active: true,
      createdAt: 1792828804,
    })
  })

  it('drops services without an endpoint and rejects a body without ids', () => {
    const parsed = parseScanAgentDetail({ ...detail, services: { a2a: { version: '1' }, web: detail.services.web } })!
    expect(parsed.services).toEqual([{ name: 'web', endpoint: 'https://xylem-drainer.xyz/' }])
    expect(parseScanAgentDetail({ ...detail, chain_id: null })).toBeNull()
    expect(parseScanAgentDetail({ ...detail, token_id: 'x' })).toBeNull()
  })
})
