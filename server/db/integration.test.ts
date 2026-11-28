import { afterAll, describe, expect, it } from 'vitest';
import { createAgentStore } from './agentStore';
import { createSql } from './client';
import { createIndexerStore } from './indexerStore';
import { migrateFromDisk } from './migrations';
import { createNetworkStore } from './networkStore';
import { createScorerStore } from './scorerStore';
import { runScorer } from '../indexer/scorer';

/**
 * Integration checks against the compose Postgres. Skipped unless
 * `DATABASE_URL` is set, so `bun run test:unit` stays hermetic.
 */
const databaseUrl = process.env['DATABASE_URL'];
const integration = databaseUrl ? describe : describe.skip;
const db = databaseUrl ? createSql(databaseUrl, 2) : null;
const OWNER = '0x1111111111111111111111111111111111111111';
const CLIENT = '0x2222222222222222222222222222222222222222';

afterAll(async () => {
  await db?.close();
});

integration('PostgreSQL integration', () => {
  it('applies migrations idempotently', async () => {
    if (!db) return;

    const first = await migrateFromDisk(db);
    expect(Array.isArray(first)).toBe(true);
    await expect(migrateFromDisk(db)).resolves.toEqual([]);
  });

  it('applies events, materializes a score and rewinds cleanly', async () => {
    if (!db) return;

    await db.query(
      'TRUNCATE feedback_responses, feedbacks, agent_metadata_kv, agent_transfers, agent_scores, tag_scales, agents, chain_cursors'
    );
    const indexer = createIndexerStore(db);

    const base = {
      blockNumber: 100n,
      blockTimestamp: 1_700_000_000n,
      logIndex: 0,
      txHash: '0xabc',
    };

    await indexer.applyChunk({
      chainId: 8453,
      mutations: [
        { ...base, kind: 'registered', tokenId: 7n, owner: OWNER, agentUri: 'data:,{}' },
        {
          ...base,
          kind: 'feedback',
          tokenId: 7n,
          client: CLIENT,
          feedbackIndex: 0n,
          valueRaw: '5',
          valueDecimals: 0,
          valueScaled: 5,
          tag1: 'starred',
          tag2: '',
          tagKey: 'starred',
          endpoint: '',
          feedbackUri: '',
          feedbackHash: `0x${'ab'.repeat(32)}`,
        },
      ],
      cursor: {
        chainId: 8453,
        block: 100n,
        hash: '0xblock',
        headBlock: 100n,
        status: 'ok',
        error: null,
      },
    });

    await runScorer({ store: createScorerStore(db), now: 1_700_000_000 });
    const agents = await createAgentStore(db).listAgents({ chain: 8453 });
    expect(agents.items[0]).toMatchObject({ tokenId: '7', confidence: 'low' });
    expect(agents.items[0]?.score).not.toBeNull();

    const detail = await createAgentStore(db).getAgentDetail(8453, '7');
    expect(detail?.feedback).toHaveLength(1);
    expect(detail?.tagScales['starred']?.scale).toBe('five');

    const reputation = await createAgentStore(db).getAgentReputation(8453, '7');
    expect(reputation?.contentHash).toHaveLength(64);
    expect(reputation?.report.counts.rating).toBe(1);

    await indexer.unwind(8453, 99n, {
      chainId: 8453,
      block: 99n,
      hash: null,
      headBlock: null,
      status: 'syncing',
      error: null,
    });
    const after = await createAgentStore(db).listAgents({ chain: 8453 });
    expect(after).toMatchObject({ total: 0, items: [] });
  });

  it('reads chains and empty stores', async () => {
    if (!db) return;

    const networks = await createNetworkStore(db).listNetworks();
    const stats = await createNetworkStore(db).getNetworkStats(8453);

    expect(networks).toHaveLength(13);
    expect(stats?.chainId).toBe(8453);
  });
});
