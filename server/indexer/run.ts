import { createPublicClient, http } from 'viem';
import { type ChainRecord, catalogChain, CHAIN_CATALOG } from '../../shared/chains';
import { viemChainFor } from '../../shared/viemChains';
import { createSql, WORKER_POOL } from '../db/client';
import { createIndexerStore } from '../db/indexerStore';
import { createMetadataStore } from '../db/metadataStore';
import { migrateFromDisk } from '../db/migrations';
import { createScorerStore } from '../db/scorerStore';
import { runMetadataBatch } from './metadataWorker';
import { runScorer } from './scorer';
import { syncChain } from './syncChain';
import type { ChainRpc } from './types';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

function selectedChains(): ChainRecord[] {
  const raw = process.env['INDEXER_CHAINS']?.trim();

  if (!raw) return [...CHAIN_CATALOG];

  return raw.split(',').flatMap((part) => {
    const chain = catalogChain(Number(part.trim()));

    return chain ? [chain] : [];
  });
}

function rpcFor(record: ChainRecord): ChainRpc {
  const url =
    process.env[`INDEXER_RPC_URL_${record.chainId}`]?.trim() ||
    record.defaultLogsRpcUrl ||
    record.defaultRpcUrl;

  const client = createPublicClient({
    chain: viemChainFor(record.chainId),
    transport: http(url),
  });

  return {
    getBlockNumber: () => client.getBlockNumber(),
    async getBlock(blockNumber) {
      const block = await client.getBlock({ blockNumber });

      return { number: block.number, hash: block.hash, timestamp: block.timestamp };
    },
    async getLogs({ address, fromBlock, toBlock }) {
      const logs = await client.getLogs({ address: [...address], fromBlock, toBlock });

      return logs.flatMap((log) => {
        const topic = log.topics[0];

        if (!topic) return [];

        return [
          {
            data: log.data,
            topics: log.topics,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
          },
        ];
      });
    },
  };
}

const once = process.argv.includes('--once');
const pollMs = Number(process.env['INDEXER_POLL_MS'] ?? 15_000);
const chains = selectedChains();
const db = createSql(databaseUrl, WORKER_POOL);

await migrateFromDisk(db);

const indexerStore = createIndexerStore(db);
const metadataStore = createMetadataStore(db);
const scorerStore = createScorerStore(db);
const clients = new Map(chains.map((chain) => [chain.chainId, rpcFor(chain)]));
const lifecycle = { running: true };

function stop(): void {
  lifecycle.running = false;
  console.log('indexer stopping after the current pass');
}

process.on('SIGINT', stop);

process.on('SIGTERM', stop);

while (lifecycle.running) {
  for (const chain of chains) {
    const rpc = clients.get(chain.chainId);

    if (!rpc) continue;

    try {
      const result = await syncChain({ chain, rpc, store: indexerStore, log: console.log });
      console.log(
        `${chain.slug}: ${result.indexedTo}/${result.safeHead} in ${result.chunks} chunk(s)${result.rewound ? ' after reorg' : ''}`
      );
    } catch (error) {
      console.error(`${chain.slug}: ${error instanceof Error ? error.message : 'sync failed'}`);
    }
  }

  const metadata = await runMetadataBatch({
    store: metadataStore,
    now: Math.floor(Date.now() / 1000),
  });

  const scored = await runScorer({
    store: scorerStore,
    now: Math.floor(Date.now() / 1000),
  });

  console.log(
    `metadata ${metadata.saved}/${metadata.pending} saved; scores ${scored.agents} dirty + ${scored.stale} stale`
  );

  if (once) break;
  await new Promise((resolve) => setTimeout(resolve, pollMs));
}

await db.close();
