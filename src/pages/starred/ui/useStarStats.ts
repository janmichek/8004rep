import { useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { fetchAgents } from '../../../shared/api';
import { CHAINS, formatScore, sourceFor, starKey, type Star } from '../../../shared/lib/explorer';

/**
 * Basic stats per star, fetched once per star and kept for this visit.
 * Agents: `rep-1.0` score and indexed feedback count. Owners: agents owned.
 * Reviewers have no stat: counting their feedback means paging their whole history.
 */
type IndexedAgentLike = { score: number | null; unrated: boolean; feedbackCount: number };

function agentStat(agent: IndexedAgentLike): string {
  if (agent.unrated || agent.score === null) return `Unrated · ${agent.feedbackCount} feedback`;

  return `Score ${formatScore(Math.round(agent.score * 10) / 10)} · ${agent.feedbackCount} feedback`;
}

async function statFor(star: Star): Promise<string | undefined> {
  if (star.kind === 'agent') {
    const page = await fetchAgents({ ids: `${star.chainId}:${star.id}` }).catch(() => null);
    const agent = page?.items[0];

    return agent ? agentStat(agent) : '—';
  }

  if (star.kind === 'owner') {
    const chain = CHAINS.find((item) => item.chainId === star.chainId);

    if (!chain) return undefined;

    const { source } = await sourceFor(chain);

    const page = await source
      .listAgents({ page: 0, pageSize: 1, owner: getAddress(star.id) })
      .catch(() => null);

    if (!page) return '—';

    return page.total === undefined
      ? undefined
      : `${page.total} ${page.total === 1 ? 'agent' : 'agents'}`;
  }

  return undefined;
}

export function useStarStats(starred: Star[]): Record<string, string> {
  const [stats, setStats] = useState<Record<string, string>>({});
  const statsRef = useRef<Record<string, string>>({});
  const pendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const star of starred) {
      const key = starKey(star.kind, star.chainId, star.id);

      if (star.kind === 'reviewer' || key in statsRef.current || pendingRef.current.has(key)) {
        continue;
      }

      pendingRef.current.add(key);
      void statFor(star)
        .catch(() => '—')
        .then((text) => {
          if (text === undefined) return;
          statsRef.current = { ...statsRef.current, [key]: text };
          setStats(statsRef.current);
        })
        .finally(() => {
          pendingRef.current.delete(key);
        });
    }
  }, [starred]);

  return stats;
}
