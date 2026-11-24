import type { Address } from 'viem';
import {
  identityAbi,
  sourceFor,
  useAsync,
  type AgentSummary,
  type ChainInfo,
} from '../../../shared/lib/explorer';
import type { ListOptions } from '../../../shared/lib/explorer';
import type { OwnerOrder, OwnerSort } from './ownerSearch';

const PAGE_SIZE = 25;

type OwnerList = {
  items: AgentSummary[];
  total?: number | undefined;
  hasMore: boolean;
  owned: number | undefined;
  sourceKind: 'subgraph' | 'rpc';
};

type Args = {
  chain: ChainInfo | undefined;
  address: Address | undefined;
  page: number;
  sort: OwnerSort | null;
  order: OwnerOrder;
};

export function useOwnerList({ chain, address, page, sort, order }: Args) {
  return useAsync(async () => {
    if (!address || !chain) return null;

    const { source, rpcClient } = await sourceFor(chain);
    const options: ListOptions = { page, pageSize: PAGE_SIZE, owner: address };

    if (sort === 'id') options.sort = 'tokenId';

    if (sort === 'created') options.sort = 'createdAt';

    if (sort) options.order = order;

    const listed = await source.listAgents(options);
    let owned = listed.total;

    if (owned === undefined) {
      try {
        const balance = await rpcClient.readContract({
          address: chain.identity,
          abi: identityAbi,
          functionName: 'balanceOf',
          args: [address],
        });

        owned = Number(balance);
      } catch {
        owned = undefined;
      }
    }

    const result: OwnerList = {
      items: listed.items,
      total: listed.total,
      hasMore: listed.hasMore,
      owned,
      sourceKind: source.kind,
    };

    return result;
  }, [chain?.chainId, address, page, sort, order]);
}
