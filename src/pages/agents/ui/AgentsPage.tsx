import { useParams } from '@tanstack/react-router';
import { useNetworkEnv, usePinnedAgents, useStarred } from '../../../shared/lib/explorer';
import { AgentsHero } from './AgentsHero';
import { AgentsResults } from './AgentsResults';
import { AgentsToolbar } from './AgentsToolbar';
import { useAgentsFeed } from './useAgentsFeed';
import { useAgentsSearchState } from './useAgentsSearchState';

export function AgentsPage() {
  const { slug } = useParams({ from: '/agents/$slug' });
  const [env] = useNetworkEnv();

  const {
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
  } = useAgentsSearchState();

  const feed = useAgentsFeed({ env, page, rated, q, chainQuery, sort, order });
  const stars = useStarred();
  const items = feed.agentsQuery.data?.items ?? [];

  const pinned = usePinnedAgents({
    items,
    chains: feed.chains,
    chainId: feed.selectedChain?.chainId,
    search: q,
    stars,
  });

  return (
    <>
      <AgentsHero
        chainCount={feed.envChains.length}
        initialQuery={q}
        onSearch={(query) => pushQuery({ q: query, page: 0 })}
      />
      <AgentsToolbar
        envLabel={env === 'testnet' ? 'Testnet' : 'Mainnet'}
        network={
          feed.selectedChain
            ? { id: feed.selectedChain.chainId, name: feed.selectedChain.name }
            : undefined
        }
        loading={feed.agentsQuery.isLoading}
        rated={rated}
        networkValue={feed.selectedChain ? String(feed.selectedChain.chainId) : 'all'}
        networks={feed.envChains.map((chain) => ({ id: chain.chainId, name: chain.name }))}
        onToggleRated={() => pushQuery({ rated: !rated, page: 0 })}
        onNetworkChange={(value) =>
          pushQuery({ chain: value === 'all' ? null : Number(value), page: 0 })
        }
        total={feed.agentsQuery.data?.total}
      />
      <AgentsResults
        error={feed.agentsQuery.error ? String(feed.agentsQuery.error) : undefined}
        loading={feed.agentsQuery.isLoading}
        pinned={pinned.pinned}
        feed={pinned.feed}
        hasRows={pinned.hasRows}
        q={q}
        rated={rated}
        page={page}
        sort={sort}
        order={order}
        slug={slug}
        chainQuery={chainQuery}
        data={feed.agentsQuery.data}
        chains={feed.chainMap}
        registeredSort={registeredSort}
        scoreSort={scoreSort}
        feedbackSort={feedbackSort}
        onSort={toggleSort}
        onRetry={() => {
          void feed.agentsQuery.refetch();
        }}
      />
    </>
  );
}
