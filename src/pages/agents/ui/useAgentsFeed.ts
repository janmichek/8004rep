import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchAgents, type AgentListQuery } from '../../../shared/api';
import { fetchScanChains } from '../../../shared/lib/explorer';
import type { NetworkEnv } from '../../../shared/lib/explorer';

const PAGE_SIZE = 25;
const RATED_SIZE = 50;

export function useAgentsFeed(args: {
  env: NetworkEnv;
  page: number;
  rated: boolean;
  q: string;
  chainQuery: number | undefined;
  sort: 'registered' | 'score' | 'feedback' | null;
  order: 'asc' | 'desc';
}) {
  const { env, page, rated, q, chainQuery, sort, order } = args;

  const chainsQuery = useQuery({ queryKey: ['scan-chains'], queryFn: fetchScanChains });

  const envChains = useMemo(
    () => (chainsQuery.data ?? []).filter((chain) => chain.testnet === (env === 'testnet')),
    [chainsQuery.data, env]
  );

  const selectedChain = envChains.find((chain) => chain.chainId === chainQuery);

  const chainMap = useMemo(
    () => new Map((chainsQuery.data ?? []).map((chain) => [chain.chainId, chain])),
    [chainsQuery.data]
  );

  const agentsQuery = useQuery({
    queryKey: ['agents', env, page, rated, q, selectedChain?.chainId, sort, order],
    queryFn: () => {
      const params: AgentListQuery = {
        page,
        pageSize: rated ? RATED_SIZE : PAGE_SIZE,
        env,
      };

      if (q) params.q = q;

      if (selectedChain) params.chain = selectedChain.chainId;

      if (rated) {
        params.sort = 'feedback';
        params.order = 'desc';
      } else if (sort) {
        params.sort = sort;
        params.order = order;
      }

      return fetchAgents(params);
    },
  });

  return { envChains, chains: chainsQuery.data, selectedChain, chainMap, agentsQuery };
}
