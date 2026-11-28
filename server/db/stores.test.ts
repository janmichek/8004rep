import { describe, expect, it } from 'vitest';
import { buildReputationReport, type TagScale } from '../../shared/reputation';
import type { QueryParam, Sql } from './client';
import { createIndexerStore } from './indexerStore';
import { createMetadataStore } from './metadataStore';
import { createScorerStore } from './scorerStore';

type QueryCall = { query: string; params: readonly QueryParam[] };

type Fake = Sql & { calls: QueryCall[] };

function fakeSql(
  handler: (query: string, params: readonly QueryParam[]) => object[] = () => []
): Fake {
  const calls: QueryCall[] = [];

  const db: Sql = {
    async query(query, params = []) {
      calls.push({ query, params });

      return handler(query, params);
    },
    async transaction<T>(run: (tx: Sql) => Promise<T>) {
      return run(db);
    },
    async close() {},
  };

  return Object.assign(db, { calls });
}

const CURSOR_ROW = {
  chain_id: 8453,
  last_indexed_block: '100',
  last_indexed_hash: '0xhash',
  head_block: '120',
  status: 'ok',
  last_error: null,
};

const FEEDBACK_ROW = {
  chain_id: 8453,
  token_id: '7',
  client_address: '0x1111111111111111111111111111111111111111',
  feedback_index: '0',
  endpoint: null,
  feedback_uri: null,
  value_scaled: 5,
  tag1: 'starred',
  tag2: null,
  revoked: false,
  created_at: '1700000000',
  tx_hash: '0xabc',
  owner: '0x2222222222222222222222222222222222222222',
  agent_wallet: '0x3333333333333333333333333333333333333333',
};

const RESPONSE_ROW = {
  chain_id: 8453,
  token_id: '7',
  client_address: '0x1111111111111111111111111111111111111111',
  feedback_index: '0',
  responder: '0x2222222222222222222222222222222222222222',
  response_uri: 'https://reply.example',
  created_at: '1700000100',
  tx_hash: '0xdef',
};

const AGENT_ROW = {
  chain_id: 8453,
  token_id: '7',
  owner: '0x2222222222222222222222222222222222222222',
  agent_wallet: '0x3333333333333333333333333333333333333333',
};

describe('indexerStore', () => {
  it('reads a cursor and returns null when missing', async () => {
    const empty = fakeSql();
    await expect(createIndexerStore(empty).getCursor(8453)).resolves.toBeNull();

    const db = fakeSql(() => [CURSOR_ROW]);
    const cursor = await createIndexerStore(db).getCursor(8453);
    expect(cursor).toEqual({
      chainId: 8453,
      lastIndexedBlock: 100n,
      lastIndexedHash: '0xhash',
      headBlock: 120n,
      status: 'ok',
      lastError: null,
    });
  });

  it('writes a cursor', async () => {
    const db = fakeSql();
    await createIndexerStore(db).writeCursor({
      chainId: 8453,
      block: 100n,
      hash: '0xhash',
      headBlock: null,
      status: 'ok',
      error: null,
    });
    expect(db.calls[0]?.query).toContain('INSERT INTO chain_cursors');
    expect(db.calls[0]?.params).toEqual([8453, '100', '0xhash', null, 'ok', null]);
  });

  it('applies every mutation kind atomically', async () => {
    const db = fakeSql();
    const store = createIndexerStore(db);
    const base = { blockNumber: 10n, blockTimestamp: 100n, logIndex: 0, txHash: '0xabc' };
    await store.applyChunk({
      chainId: 8453,
      cursor: {
        chainId: 8453,
        block: 100n,
        hash: '0xhash',
        headBlock: 120n,
        status: 'ok',
        error: null,
      },
      mutations: [
        {
          ...base,
          kind: 'transfer',
          tokenId: 7n,
          from: '0x0000000000000000000000000000000000000000',
          to: AGENT_ROW.owner,
        },
        {
          ...base,
          kind: 'transfer',
          tokenId: 8n,
          from: AGENT_ROW.owner,
          to: '0x0000000000000000000000000000000000000000',
        },
        {
          ...base,
          kind: 'registered',
          tokenId: 7n,
          owner: AGENT_ROW.owner,
          agentUri: 'ipfs://cid',
        },
        { ...base, kind: 'uri-updated', tokenId: 7n, agentUri: 'https://new.example' },
        {
          ...base,
          kind: 'metadata-set',
          tokenId: 7n,
          key: 'agentWallet',
          valueHex: '0x1234',
          wallet: AGENT_ROW.owner,
        },
        {
          ...base,
          kind: 'metadata-set',
          tokenId: 7n,
          key: 'name',
          valueHex: '0x1234',
          wallet: null,
        },
        {
          ...base,
          kind: 'feedback',
          tokenId: 7n,
          client: AGENT_ROW.owner,
          feedbackIndex: 0n,
          valueRaw: '5',
          valueDecimals: 0,
          valueScaled: 5,
          tag1: 'starred',
          tag2: '',
          tagKey: 'starred',
          endpoint: '',
          feedbackUri: '',
          feedbackHash: '0xabc',
        },
        {
          ...base,
          kind: 'feedback-revoked',
          tokenId: 7n,
          client: AGENT_ROW.owner,
          feedbackIndex: 0n,
        },
        {
          ...base,
          kind: 'response-appended',
          tokenId: 7n,
          client: AGENT_ROW.owner,
          feedbackIndex: 0n,
          responder: AGENT_ROW.owner,
          responseUri: 'https://reply.example',
          responseHash: '0xdef',
        },
      ],
    });
    expect(db.calls.some((call) => call.query.includes('INSERT INTO feedbacks'))).toBe(true);
    expect(db.calls.at(-1)?.query).toContain('INSERT INTO chain_cursors');
  });

  it('unwinds every table above the rewind point', async () => {
    const db = fakeSql();
    await createIndexerStore(db).unwind(8453, 900n, {
      chainId: 8453,
      block: 900n,
      hash: '0xhash',
      headBlock: null,
      status: 'syncing',
      error: null,
    });
    expect(db.calls).toHaveLength(12);
    expect(db.calls[0]?.params).toEqual([8453, '900']);
  });
});

describe('metadataStore', () => {
  it('maps pending rows', async () => {
    const db = fakeSql(() => [
      { chain_id: 8453, token_id: '7', agent_uri: 'ipfs://cid', metadata_attempts: 2 },
    ]);

    await expect(createMetadataStore(db).pendingMetadata(10)).resolves.toEqual([
      { chainId: 8453, tokenId: '7', agentUri: 'ipfs://cid', attempts: 2 },
    ]);
  });

  it('saves normalized metadata fields', async () => {
    const db = fakeSql();
    await createMetadataStore(db).saveMetadata(
      { chainId: 8453, tokenId: '7', agentUri: 'ipfs://cid', attempts: 0 },
      {
        name: 'Atlas',
        description: 'Broker',
        image: 'https://img.example/a.png',
        active: true,
        x402: true,
        version: '1.0.0',
        services: [{ name: 'MCP', endpoint: 'https://mcp.example' }],
        supportedTrust: ['reputation'],
        raw: { name: 'Atlas' },
      }
    );
    expect(db.calls[0]?.params.slice(0, 7)).toEqual([
      8453,
      '7',
      'Atlas',
      'Broker',
      'https://img.example/a.png',
      true,
      true,
    ]);
  });

  it('records a retry', async () => {
    const db = fakeSql();
    await createMetadataStore(db).saveMetadataError(
      { chainId: 8453, tokenId: '7', agentUri: 'ipfs://cid', attempts: 1 },
      'timed out',
      1_700_000_000
    );
    expect(db.calls[0]?.params).toEqual([8453, '7', 1_700_000_000, 'timed out']);
  });
});

describe('scorerStore', () => {
  it('lists dirty chains', async () => {
    const db = fakeSql(() => [{ chain_id: 8453 }]);
    await expect(createScorerStore(db).chainsWithDirtyAgents()).resolves.toEqual([8453]);
  });

  it('maps chain feedback with self addresses', async () => {
    const db = fakeSql(() => [FEEDBACK_ROW]);
    const rows = await createScorerStore(db).chainFeedback(8453);
    expect(rows[0]).toMatchObject({
      client: FEEDBACK_ROW.client_address,
      owner: FEEDBACK_ROW.owner,
      agentWallet: FEEDBACK_ROW.agent_wallet,
      responses: [],
    });
  });

  it('maps dirty and stale agents', async () => {
    const db = fakeSql((query) =>
      query.includes('score_dirty = TRUE') ? [AGENT_ROW] : [AGENT_ROW]
    );

    await expect(createScorerStore(db).dirtyAgents(8453, 10)).resolves.toEqual([
      {
        chainId: 8453,
        tokenId: '7',
        owner: AGENT_ROW.owner,
        agentWallet: AGENT_ROW.agent_wallet,
      },
    ]);
    await expect(createScorerStore(db).staleAgents(10)).resolves.toHaveLength(1);
  });

  it('joins responses to their feedback', async () => {
    const db = fakeSql((query) =>
      query.includes('FROM feedback_responses') ? [RESPONSE_ROW] : [FEEDBACK_ROW]
    );

    const rows = await createScorerStore(db).feedbackForAgent(8453, '7');
    expect(rows[0]?.responses[0]).toEqual({
      responder: RESPONSE_ROW.responder,
      uri: RESPONSE_ROW.response_uri,
      createdAt: 1_700_000_100,
      txHash: RESPONSE_ROW.tx_hash,
    });
  });

  it('replaces tag scales in one transaction', async () => {
    const db = fakeSql();
    const scales = new Map<string, TagScale>([['starred', { scale: 'five', span: 5 }]]);
    await createScorerStore(db).saveTagScales(8453, scales);
    expect(db.calls[0]?.query).toContain('DELETE FROM tag_scales');
    expect(db.calls[1]?.query).toContain('INSERT INTO tag_scales');
  });

  it('upserts a score and clears the dirty flag', async () => {
    const db = fakeSql();

    const report = buildReputationReport(
      [
        {
          client: '0x1111111111111111111111111111111111111111',
          value: 5,
          tag1: 'starred',
          revoked: false,
          createdAt: 1_700_000_000,
        },
      ],
      { now: 1_700_000_000 }
    );

    const store = createScorerStore(db);
    await store.saveScore(8453, '7', report, 1_700_000_000);
    await store.clearDirty(8453, '7');
    expect(db.calls[0]?.query).toContain('INSERT INTO agent_scores');
    expect(db.calls[0]?.params.slice(0, 4)).toEqual([8453, '7', 'rep-1.0', report.score]);
    expect(db.calls[1]?.query).toContain('score_dirty = FALSE');
  });
});
