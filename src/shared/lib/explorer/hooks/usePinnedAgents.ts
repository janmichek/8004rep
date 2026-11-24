import { useEffect, useMemo, useState } from 'react';
import { fetchScanAgentDetail, type ScanAgent, type ScanChain } from '../data/scan';
import { getNetworkEnv } from '../env';
import { useNetworkEnv } from '../useNetworkEnv';
import { getStarred, starKey } from '../stars';

function stub(chainId: number, tokenId: string, testnet: boolean): ScanAgent {
  return {
    chainId,
    tokenId: BigInt(tokenId),
    owner: null,
    protocols: [],
    x402: false,
    totalScore: 0,
    averageScore: 0,
    feedbackCount: 0,
    testnet,
  };
}

function fromDetail(
  detail: NonNullable<Awaited<ReturnType<typeof fetchScanAgentDetail>>>,
  testnet: boolean
): ScanAgent {
  return {
    chainId: detail.chainId,
    tokenId: detail.tokenId,
    ...(detail.name ? { name: detail.name } : {}),
    ...(detail.description ? { description: detail.description } : {}),
    ...(detail.imageUrl ? { imageUrl: detail.imageUrl } : {}),
    owner: detail.owner,
    protocols: detail.protocols,
    x402: detail.x402,
    totalScore: detail.totalScore,
    averageScore: detail.averageScore,
    feedbackCount: detail.feedbackCount,
    ...(detail.createdAt !== undefined ? { createdAt: detail.createdAt } : {}),
    testnet,
  };
}

/** Starred agents above the agent feed, limited to the current network environment. */
export function usePinnedAgents(options: {
  items: ScanAgent[];
  chains: ScanChain[] | undefined;
  chainId: number | undefined;
  search: string;
  stars: ReturnType<typeof getStarred>;
}) {
  const { items, chains, chainId, search, stars } = options;
  const [env] = useNetworkEnv();
  const [pinnedRaw, setPinnedRaw] = useState<ScanAgent[]>([]);
  const starredAgents = useMemo(() => stars.filter((row) => row.kind === 'agent'), [stars]);

  useEffect(() => {
    let live = true;
    const testnet = getNetworkEnv() === 'testnet';
    function inEnv(id: number): boolean {
      const chain = chains?.find((item) => item.chainId === id);
      return chain === undefined || chain.testnet === testnet;
    }
    void Promise.all(
      starredAgents
        .filter((row) => inEnv(row.chainId))
        .map(async (row) => {
          const detail = await fetchScanAgentDetail(row.chainId, BigInt(row.id)).catch(() => null);
          return detail ? fromDetail(detail, testnet) : stub(row.chainId, row.id, testnet);
        })
    ).then((rows) => {
      if (live) setPinnedRaw(rows);
    });
    return () => {
      live = false;
    };
  }, [starredAgents, env, chains]);

  const pinned = useMemo(() => {
    const testnet = env === 'testnet';
    const byId = new Map<string, ScanAgent>();
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
