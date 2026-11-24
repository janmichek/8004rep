import type { ChainInfo, FeedWindow, ReviewerProfile } from '../../../shared/lib/explorer';
import { ChartSkeleton, TilesSkeleton } from '../../../shared/ui';
import { ReviewerTabs } from './ReviewerTabs';
import type { ReviewerWallet } from './useReviewerWallet';

type Props = {
  chain: ChainInfo;
  profile: ReviewerProfile | undefined;
  feed: FeedWindow | undefined;
  feedError: string | undefined;
  loadingFeed: boolean;
  wallet: ReviewerWallet | null | undefined;
  walletLoading: boolean;
  onRetry: () => void;
  onLoadOlder: () => void;
};

export function ReviewerContent({
  chain,
  profile,
  feed,
  feedError,
  loadingFeed,
  wallet,
  walletLoading,
  onRetry,
  onLoadOlder,
}: Props) {
  if (feedError) {
    return (
      <p className="notice">
        Could not load its feedback: {feedError}{' '}
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }

  if (!profile || !feed) {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading its feedback</span>
        <TilesSkeleton count={6} />
        <div className="chart-grid">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  return (
    <ReviewerTabs
      chain={chain}
      profile={profile}
      feed={feed}
      wallet={wallet}
      walletLoading={walletLoading}
      loadingFeed={loadingFeed}
      onLoadOlder={onLoadOlder}
    />
  );
}
