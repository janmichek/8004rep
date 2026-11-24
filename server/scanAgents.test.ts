import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAgentPage, parseAgentPage, toAgent } from './scanAgents';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toAgent', () => {
  test('maps the 8004scan row to the wire contract', () => {
    expect(
      toAgent({
        token_id: '42',
        chain_id: 8453,
        owner_address: '0x1111111111111111111111111111111111111111',
        name: 'Atlas Broker',
        description: 'A broker',
        image_url: 'https://example.com/a.png',
        supported_protocols: ['MCP'],
        x402_supported: true,
        total_score: 72,
        average_score: 80,
        total_feedbacks: 18,
        is_testnet: false,
        created_at: '2026-11-24T10:00:00Z',
      })
    ).toEqual({
      chainId: 8453,
      tokenId: '42',
      name: 'Atlas Broker',
      description: 'A broker',
      imageUrl: 'https://example.com/a.png',
      owner: '0x1111111111111111111111111111111111111111',
      protocols: ['MCP'],
      x402: true,
      totalScore: 72,
      averageScore: 80,
      feedbackCount: 18,
      createdAt: 1_795_514_400,
      testnet: false,
    });
  });

  test('accepts a numeric id and defaults missing values', () => {
    expect(
      toAgent({
        token_id: 7,
        chain_id: 1,
        owner_address: null,
        created_at: 'not a date',
      })
    ).toEqual({
      chainId: 1,
      tokenId: '7',
      owner: null,
      protocols: [],
      x402: false,
      totalScore: 0,
      averageScore: 0,
      feedbackCount: 0,
      testnet: false,
    });
  });
});

describe('parseAgentPage', () => {
  test('reads the pager and skips malformed rows', () => {
    const page = parseAgentPage({
      success: true,
      data: [
        { token_id: '1', chain_id: 1 },
        { token_id: 'x', chain_id: 1 },
        { token_id: '2', chain_id: '1' },
      ],
      meta: { pagination: { total: 100, hasMore: true } },
    });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(100);
    expect(page.hasMore).toBe(true);
  });

  test('falls back to the row count without pagination metadata', () => {
    const page = parseAgentPage({
      success: true,
      data: [{ token_id: '1', chain_id: 1 }],
    });

    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
  });

  test('accepts null counters and text from upstream', () => {
    const page = parseAgentPage({
      success: true,
      data: [
        {
          token_id: '9',
          chain_id: 1,
          name: null,
          supported_protocols: null,
          total_score: null,
          average_score: null,
          total_feedbacks: null,
          created_at: null,
        },
      ],
      meta: { pagination: { total: null, hasMore: null } },
    });

    expect(page.items[0]).toMatchObject({
      tokenId: '9',
      protocols: [],
      totalScore: 0,
      averageScore: 0,
      feedbackCount: 0,
    });
    expect(page.total).toBe(1);
    expect(page.hasMore).toBe(false);
  });
});

describe('fetchAgentPage', () => {
  test('throws on an unexpected upstream envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: true, data: null }))
    );

    await expect(fetchAgentPage({})).rejects.toThrow('unexpected agent list');
  });

  test('throws when upstream is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    );

    await expect(fetchAgentPage({})).rejects.toThrow('8004scan answered 503');
  });
});
