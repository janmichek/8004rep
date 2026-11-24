import { useParams } from '@tanstack/react-router';
import { isAddress } from 'viem';
import { findChainBySlug } from '../../../shared/lib/explorer';
import { useOwnerList } from './useOwnerList';
import { useOwnerScores } from './useOwnerScores';
import { useOwnerSearch } from './useOwnerSearch';

export function useOwnerAgents() {
  const { slug, address: rawAddress } = useParams({ from: '/owners/$slug/$address' });
  const chain = findChainBySlug(slug);
  const address = isAddress(rawAddress, { strict: false }) ? rawAddress : undefined;
  const { page, sort, order, toggleSort } = useOwnerSearch();
  const { data, error, loading, reload } = useOwnerList({ chain, address, page, sort, order });
  const scores = useOwnerScores(chain, data?.items);
  const canSortCreated = data?.sourceKind === 'subgraph';
  const createdSort = canSortCreated && sort === 'created' ? order : null;
  const activeSort = sort === 'created' && !canSortCreated ? null : sort;

  return {
    slug,
    address,
    rawAddress,
    chain,
    page,
    sort,
    order,
    data,
    error,
    loading,
    reload,
    scores,
    canSortCreated,
    createdSort,
    activeSort,
    toggleSort,
  };
}

export type OwnerAgentState = ReturnType<typeof useOwnerAgents>;
