import { useParams } from '@tanstack/react-router';
import { DEFAULT_CHAIN, findChainBySlug } from '../../../shared/lib/explorer';
import { NetworkBody } from './NetworkBody';
import { NetworkHead } from './NetworkHead';
import { useNetworkFeed } from './useNetworkFeed';

export function NetworkPage() {
  const { slug } = useParams({ from: '/network/$slug' });
  const selected = findChainBySlug(slug);
  const feed = useNetworkFeed(selected ?? DEFAULT_CHAIN);

  if (!selected) return null;

  return (
    <>
      <NetworkHead chain={feed.chain} slug={slug} />
      <NetworkBody
        chain={feed.chain}
        error={feed.error}
        stats={feed.stats}
        feed={feed.feed}
        loading={feed.loading}
        load={feed.load}
        network={{
          feedback30d: feed.network.data?.feedback30d,
          totalFeedback: feed.network.data?.totalFeedback,
          ratedAgents: feed.network.data?.ratedAgents,
          loading: feed.network.loading,
        }}
      />
    </>
  );
}
