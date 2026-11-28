import { afterAll, describe, expect, it } from 'vitest';
import { createAgentStore } from './agentStore';
import { createSql } from './client';
import { createIndexerStore } from './indexerStore';
import { migrateFromDisk } from './migrations';
import { createNetworkStore } from './networkStore';

/**
 * Integration checks against the compose Postgres. Skipped unless
 * `DATABASE_URL` is set, so `bun run test:unit` stays hermetic.
 */
const databaseUrl = process.env['DATABASE_URL'];
const integration = databaseUrl ? describe : describe.skip;
const db = databaseUrl ? createSql(databaseUrl, 2) : null;

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

  it('reads the owned stores on an empty or populated database', async () => {
    if (!db) return;

    const agents = await createAgentStore(db).listAgents({ pageSize: 1 });
    const networks = await createNetworkStore(db).listNetworks();
    const cursor = await createIndexerStore(db).getCursor(8453);

    expect(agents.items.length).toBeLessThanOrEqual(1);
    expect(networks).toHaveLength(13);
    expect(cursor === null || cursor.chainId === 8453).toBe(true);
  });
});
