import {
  formatDate,
  type ChainInfo,
  type FeedWindow,
  type ReviewerProfile,
} from '../../../shared/lib/explorer';
import { StatTiles } from '../../../shared/ui';
import { ReviewerCharts } from './ReviewerCharts';
import { ReviewerFundingNote } from './ReviewerFundingNote';
import { ReviewerHabitSignals } from './ReviewerHabitSignals';
import { reviewerTiles } from './reviewerTiles';
import type { ReviewerWallet } from './useReviewerWallet';

type Props = {
  chain: ChainInfo;
  profile: ReviewerProfile;
  feed: FeedWindow;
  wallet: ReviewerWallet | null | undefined;
  walletLoading: boolean;
  loadingFeed: boolean;
  onLoadOlder: () => void;
};

export function ReviewerOverview({
  chain,
  profile,
  feed,
  wallet,
  walletLoading,
  loadingFeed,
  onLoadOlder,
}: Props) {
  return (
    <>
      <StatTiles tiles={reviewerTiles(profile, wallet, walletLoading)} />

      <section className="panel">
        <ReviewerHabitSignals labels={profile.labels} />
        <ReviewerFundingNote chain={chain} wallet={wallet} loading={walletLoading} />
        <p className="muted note">
          Based on {profile.rows} rows
          {feed.since ? ` since ${formatDate(feed.since)} (log scan window)` : ''}.{' '}
          {feed.cursor ? (
            <button type="button" disabled={loadingFeed} onClick={onLoadOlder}>
              {loadingFeed ? 'Loading…' : 'Load older'}
            </button>
          ) : null}
        </p>
      </section>

      <ReviewerCharts ratingValues={profile.ratingValues} items={feed.items} />
    </>
  );
}
