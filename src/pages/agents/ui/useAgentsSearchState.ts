import { useNavigate, useSearch } from '@tanstack/react-router';
import { buildAgentsSearch } from './agentsSearch';

export type AgentSort = 'registered' | 'score' | 'feedback';

export type AgentOrder = 'asc' | 'desc';

export function useAgentsSearchState() {
  const navigate = useNavigate({ from: '/agents/$slug' });
  const search = useSearch({ from: '/agents/$slug' });

  const rated = search.rated === true;
  const page = rated ? 0 : Math.max(0, (search.page ?? 1) - 1);
  const q = (search.q ?? '').trim();
  const chainQuery = search.chain;
  const sort: AgentSort | null = search.sort ?? null;
  const order: AgentOrder = search.order === 'asc' ? 'asc' : 'desc';
  const registeredSort = sort === 'registered' ? order : null;
  const scoreSort = sort === 'score' ? order : null;
  const feedbackSort = sort === 'feedback' ? order : null;

  function pushQuery(next: {
    q?: string;
    chain?: number | null;
    page?: number;
    rated?: boolean;
    sort?: AgentSort | null;
    order?: AgentOrder;
  }) {
    const nextQ = next.q !== undefined ? next.q.trim() : q;
    const nextChain = next.chain === undefined ? chainQuery : (next.chain ?? undefined);
    const nextRated = next.rated ?? rated;
    const nextPage = next.page !== undefined ? next.page : 0;
    let nextSort = next.sort === undefined ? sort : next.sort;

    if (nextRated) nextSort = null;
    const nextOrder = next.order ?? order;

    void navigate({
      search: buildAgentsSearch({
        q: nextQ,
        chain: nextChain,
        rated: nextRated,
        page: nextPage,
        sort: nextSort,
        order: nextOrder,
      }),
    });
  }

  /** Clicking the active column flips its order; a new column starts descending. */
  function toggleSort(next: AgentSort) {
    const nextOrder = sort === next && order === 'desc' ? 'asc' : 'desc';
    pushQuery({ sort: next, order: nextOrder, rated: false });
  }

  return {
    rated,
    page,
    q,
    chainQuery,
    sort,
    order,
    registeredSort,
    scoreSort,
    feedbackSort,
    pushQuery,
    toggleSort,
  };
}
