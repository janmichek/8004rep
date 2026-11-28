import { useEffect, useMemo, useState } from 'react';
import { fetchAgents } from '../../../api';
import type { IndexedAgent } from '../data/indexed';
import { getNetworkEnv } from '../env';
import type { Network } from '@shared/schemas';
import { useNetworkEnv } from '../useNetworkEnv';
import { getStarred, starKey } from '../stars';

function stub(chainId: number, tokenId: string, testnet: boolean): IndexedAgent {
  return {
    chainId,
    tokenId: BigInt(tokenId),
    owner: null,
    protocols: [],
    x402: false,
    score: null,
    ciLow: null,
    ciHigh: null,
    confidence: 'low',
    unrated: true,
    rawAverage: null,
    ratedRows: 0,
    uniqueWallets: 0,
    feedbackCount: 0,
    formulaVersion: 'rep-1.0',
    testnet,
  };
}

/** Starred agents above the agent feed, limited to the current network environment. */
export function usePinnedAgents(options: {
  items: IndexedAgent[];
  chains: Network[] | undefined;
  chainId: number | undefined;
  search: string;
  stars: ReturnType<typeof getStarred>;
}) {
  const { items, chains, chainId, search, stars } = options;
  const [env] = useNetworkEnv();
  const [pinnedRaw, setPinnedRaw] = useState<IndexedAgent[]>([]);
  const starredAgents = useMemo(() => stars.filter((row) => row.kind === 'agent'), [stars]);

  useEffect(() => {
    let live = true;
    const testnet = getNetworkEnv() === 'testnet';

    function inEnv(id: number): boolean {
      const chain = chains?.find((item) => item.chainId === id);

      return chain === undefined || chain.testnet === testnet;
    }

    const pairs = starredAgents
      .filter((row) => inEnv(row.chainId))
      .map((row) => `${row.chainId}:${row.id}`);
    const chunks: string[][] = [];
    for (let index = 0; index < pairs.length; index += 100) {
      chunks.push(pairs.slice(index, index + 100));
    }

    if (!chunks.length) {
      setPinnedRaw([]);

      return undefined;
    }

    void Promise.all(chunks.map((ids) => fetchAgents({ ids: ids.join(','), pageSize: 100 })))
      .then((pages) => {
        if (live) setPinnedRaw(pages.flatMap((page) => page.items));
      })
      .catch(() => {
        if (live) setPinnedRaw([]);
      });

    return () => {
      live = false;
    };
  }, [starredAgents, env, chains]);

  const pinned = useMemo(() => {
    const testnet = env === 'testnet';
    const byId = new Map<string, IndexedAgent>();

    for (const agent of pinnedRaw) byId.set(starKey('agent', agent.chainId, agent.tokenId), agent);

    for (const agent of items) {
      const key = starKey('agent', agent.chainId, agent.tokenId);

      if (!byId.has(key)) byId.set(key, agent);
    }

    const q = search.toLowerCase();

    return starredAgents.flatMap((row) => {
      const chain = chains?.find((item) => item.chainId === row.chainId);

      if (chain && chain.testnet !== testnet) return [];

      const agent =
        byId.get(starKey('agent', row.chainId, row.id)) ?? stub(row.chainId, row.id, testnet);

      if (chainId !== undefined && agent.chainId !== chainId) return [];

      if (q) {
        const name = agent.name?.toLowerCase() ?? '';

        if (!name.includes(q) && !agent.tokenId.toString().includes(q)) return [];
      }

      return [agent];
    });
  }, [pinnedRaw, items, chains, chainId, search, env, starredAgents]);

  const feed = useMemo(() => {
    const pinnedKeys = new Set(
      pinned.map((agent) => starKey('agent', agent.chainId, agent.tokenId))
    );

    return items.filter((agent) => !pinnedKeys.has(starKey('agent', agent.chainId, agent.tokenId)));
  }, [items, pinned]);

  return { pinned, feed, hasRows: pinned.length > 0 || feed.length > 0 };
}
