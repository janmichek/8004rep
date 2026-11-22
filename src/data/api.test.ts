import { describe, expect, it } from 'vitest'
import { toScanAgent, type ApiAgent } from './api'

function agent(overrides: Partial<ApiAgent> = {}): ApiAgent {
  return {
    chainId: 8453,
    tokenId: '42',
    owner: '0x0000000000000000000000000000000000000001',
    agentWallet: null,
    agentURI: null,
    createdAt: 1_700_000_000,
    totalFeedback: 3,
    name: 'Trovjo',
    description: null,
    image: null,
    active: true,
    x402: true,
    services: [
      { name: 'A2A', endpoint: 'https://example.test/a2a' },
      { name: 'web', endpoint: 'https://example.test' },
    ],
    supportedTrust: [],
    file: null,
    score: 87.4,
    rawScore: 91,
    rawRatings: 91,
    inflationGap: 3.6,
    costToFake: 12,
    confidence: 'medium',
    unrated: false,
    riskLevel: 'clean',
    wallets: 4,
    neff: 3.2,
    top1: 0.4,
    scanScore: null,
    ...overrides,
  }
}

describe('toScanAgent', () => {
  it('maps an indexed row into the table shape and clamps the score', () => {
    const row = toScanAgent(agent())
    expect(row.tokenId).toBe(42n)
    expect(row.protocols).toEqual(['A2A', 'web'])
    expect(row.x402).toBe(true)
    expect(row.totalScore).toBe(87.4)
    expect(row.averageScore).toBe(91)
    expect(row.feedbackCount).toBe(3)
  })

  it('falls back to the raw score and then to zero', () => {
    expect(toScanAgent(agent({ score: null, rawScore: 60 })).totalScore).toBe(60)
    expect(toScanAgent(agent({ score: null, rawScore: null, scanScore: null })).totalScore).toBe(0)
    expect(toScanAgent(agent({ score: 120 })).totalScore).toBe(100)
  })
})
