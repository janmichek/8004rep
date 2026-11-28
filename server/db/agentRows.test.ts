import { describe, expect, it } from 'vitest';
import { feedbackRowSchema } from './rowSchemas';
import {
  agentDetail,
  agentDetailRowSchema,
  listAgent,
  listAgentRowSchema,
  scatterResponses,
  scalesFromRows,
} from './agentRows';

const listRow = {
  chain_id: 8453,
  token_id: '7',
  name: 'Atlas',
  description: 'Broker',
  image_url: 'https://img.example/a.png',
  owner: '0x1111111111111111111111111111111111111111',
  protocols: ['MCP'],
  x402: false,
  score: 72,
  ci_low: 64,
  ci_high: 80,
  confidence: 'medium',
  unrated: false,
  raw_average: 80,
  rated_rows: 12,
  unique_wallets: 6,
  feedback_count: 18,
  registered_at: '1736154840',
};

const feedbackRow = {
  chain_id: 8453,
  token_id: '7',
  client_address: '0x2222222222222222222222222222222222222222',
  feedback_index: '1',
  endpoint: 'https://endpoint.example',
  feedback_uri: 'https://file.example',
  value_scaled: 4,
  tag1: 'starred',
  tag2: 'quality',
  revoked: false,
  created_at: '1700000000',
  tx_hash: '0xabc',
};

const detailRow = {
  chain_id: 8453,
  token_id: '7',
  name: 'Atlas',
  description: null,
  image_url: null,
  owner: '0x1111111111111111111111111111111111111111',
  agent_wallet: '0x3333333333333333333333333333333333333333',
  agent_uri: 'ipfs://cid',
  active: true,
  x402: true,
  protocols: ['MCP'],
  supported_trust: ['reputation'],
  services_json: [{ name: 'MCP', endpoint: 'https://mcp.example', version: '1.0.0' }, { name: 7 }],
  version: '1.0.0',
  registered_at: '1736154840',
  feedback_count: '1',
};

describe('listAgent', () => {
  it('maps every optional field', () => {
    const agent = listAgent(listAgentRowSchema.parse(listRow), false);
    expect(agent).toMatchObject({
      tokenId: '7',
      score: 72,
      ciLow: 64,
      confidence: 'medium',
      unrated: false,
      formulaVersion: 'rep-1.0',
      createdAt: 1_736_154_840,
      testnet: false,
    });
  });

  it('keeps optional fields absent and defaults a missing score', () => {
    const agent = listAgent(
      listAgentRowSchema.parse({
        ...listRow,
        chain_id: 999,
        name: null,
        description: null,
        image_url: null,
        protocols: null,
        score: null,
        ci_low: null,
        ci_high: null,
        confidence: null,
        unrated: null,
        raw_average: null,
        rated_rows: null,
        unique_wallets: null,
        feedback_count: null,
        registered_at: null,
      }),
      true
    );

    expect(agent.name).toBeUndefined();
    expect(agent.score).toBeNull();
    expect(agent.confidence).toBe('low');
    expect(agent.unrated).toBe(true);
    expect(agent.createdAt).toBeUndefined();
    expect(agent.testnet).toBe(true);
  });
});

describe('agentDetail', () => {
  it('maps metadata, feedback and responses', () => {
    const responses = scatterResponses([
      {
        chain_id: 8453,
        token_id: '7',
        client_address: feedbackRow.client_address,
        feedback_index: '1',
        responder: '0x1111111111111111111111111111111111111111',
        response_uri: 'https://reply.example',
        created_at: '1700000100',
        tx_hash: '0xdef',
      },
    ]);

    const detail = agentDetail({
      row: agentDetailRowSchema.parse(detailRow),
      feedback: [feedbackRowSchema.parse(feedbackRow)],
      responses,
      tagScales: {},
      testnet: false,
    });

    expect(detail).toMatchObject({
      tokenId: '7',
      agentWallet: detailRow.agent_wallet,
      services: [{ name: 'MCP', endpoint: 'https://mcp.example', version: '1.0.0' }],
      registeredAt: 1_736_154_840,
      feedbackCount: 1,
    });
    expect(detail.feedback[0]?.responses[0]).toMatchObject({
      responder: '0x1111111111111111111111111111111111111111',
      uri: 'https://reply.example',
    });
  });

  it('handles missing services and no feedback', () => {
    const detail = agentDetail({
      row: agentDetailRowSchema.parse({
        ...detailRow,
        services_json: null,
        feedback_count: null,
        registered_at: null,
      }),
      feedback: [],
      responses: new Map(),
      tagScales: {},
      testnet: true,
    });

    expect(detail.services).toEqual([]);
    expect(detail.feedbackCount).toBe(0);
    expect(detail.registeredAt).toBeNull();
    expect(detail.testnet).toBe(true);
  });
});

describe('scalesFromRows', () => {
  it('builds both a record and a map', () => {
    const scales = scalesFromRows([{ tag_key: 'starred', scale: 'five', span: 5 }]);
    expect(scales.record).toEqual({ starred: { scale: 'five', span: 5 } });
    expect(scales.map.get('starred')?.span).toBe(5);
  });
});
