import { z } from 'zod';
import { CHAIN_CATALOG } from '../../shared/chains';
import {
  networkSchema,
  networkStatsSchema,
  type Network,
  type NetworkStats,
} from '../../shared/schemas';
import type { Sql } from './client';
import { bigintFromDb } from './rowSchemas';

const CURSOR = z.object({
  chain_id: z.coerce.number(),
  last_indexed_block: bigintFromDb,
  status: z.enum(['idle', 'syncing', 'ok', 'error']),
  synced_at: bigintFromDb.nullable(),
});

const STATS = z.array(
  z.object({
    total_agents: z.coerce.number(),
    rated_agents: z.coerce.number(),
    total_feedback: z.coerce.number(),
    feedback30d: z.coerce.number(),
  })
);

const CURSOR_ROW = z.array(z.object({ last_indexed_block: bigintFromDb, synced_at: bigintFromDb }));

export type NetworkStore = {
  listNetworks(): Promise<Network[]>;
  getNetworkStats(chainId: number): Promise<NetworkStats | null>;
};

export function createNetworkStore(db: Sql): NetworkStore {
  return {
    async listNetworks(): Promise<Network[]> {
      const rows = await db.query(
        'SELECT chain_id, last_indexed_block, status, EXTRACT(EPOCH FROM updated_at)::bigint AS synced_at FROM chain_cursors'
      );

      const cursors = new Map(
        z
          .array(CURSOR)
          .parse(rows)
          .map((row) => [row.chain_id, row] as const)
      );

      return CHAIN_CATALOG.map((chain) => {
        const cursor = cursors.get(chain.chainId);
        const block = cursor?.last_indexed_block ?? -1n;

        return networkSchema.parse({
          code: chain.code,
          name: chain.name,
          shortName: chain.shortName,
          slug: chain.slug,
          symbol: chain.symbol,
          color: chain.color,
          chainId: chain.chainId,
          testnet: chain.testnet,
          lastIndexedBlock: block < 0n ? null : Number(block),
          syncStatus: cursor?.status ?? 'idle',
          syncedAt:
            cursor?.synced_at === null || cursor?.synced_at === undefined
              ? null
              : Number(cursor.synced_at),
        });
      });
    },

    async getNetworkStats(chainId: number): Promise<NetworkStats | null> {
      if (!CHAIN_CATALOG.some((chain) => chain.chainId === chainId)) return null;

      const [statsRows, cursorRows] = await Promise.all([
        db.query(
          `SELECT
             (SELECT COUNT(*) FROM agents WHERE chain_id = $1)::int AS total_agents,
             (SELECT COUNT(*) FROM agent_scores WHERE chain_id = $1 AND feedback_count > 0)::int AS rated_agents,
             (SELECT COUNT(*) FROM feedbacks WHERE chain_id = $1)::int AS total_feedback,
             (SELECT COUNT(*) FROM feedbacks
               WHERE chain_id = $1 AND created_at >= EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days'))::int AS feedback30d`,
          [chainId]
        ),
        db.query(
          'SELECT last_indexed_block, EXTRACT(EPOCH FROM updated_at)::bigint AS synced_at FROM chain_cursors WHERE chain_id = $1',
          [chainId]
        ),
      ]);

      const stats = STATS.parse(statsRows)[0];

      if (!stats) return null;
      const cursor = CURSOR_ROW.parse(cursorRows)[0];

      return networkStatsSchema.parse({
        chainId,
        totalAgents: stats.total_agents,
        ratedAgents: stats.rated_agents,
        totalFeedback: stats.total_feedback,
        feedback30d: stats.feedback30d,
        lastIndexedBlock:
          cursor?.last_indexed_block === undefined || cursor.last_indexed_block < 0n
            ? null
            : Number(cursor.last_indexed_block),
        syncedAt: cursor?.synced_at === undefined ? null : Number(cursor.synced_at),
      });
    },
  };
}
