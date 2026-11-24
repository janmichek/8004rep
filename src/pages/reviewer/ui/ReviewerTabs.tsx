import { Gauge, MessageSquare, Users } from 'lucide-react';
import type { ChainInfo, FeedWindow, ReviewerProfile } from '../../../shared/lib/explorer';
import { TabBar, type Tab } from '../../../shared/ui';
import { ReviewerAgentsTable } from './ReviewerAgentsTable';
import { ReviewerFeedbackTable } from './ReviewerFeedbackTable';
import { ReviewerOverview } from './ReviewerOverview';
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

export function ReviewerTabs({
  chain,
  profile,
  feed,
  wallet,
  walletLoading,
  loadingFeed,
  onLoadOlder,
}: Props) {
  const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: Gauge },
    { id: 'agents', label: 'Agents rated', icon: Users, count: profile.perAgent.length },
    { id: 'feedback', label: 'Latest feedback', icon: MessageSquare, count: feed.items.length },
  ];

  const panels = {
    overview: (
      <ReviewerOverview
        chain={chain}
        profile={profile}
        feed={feed}
        wallet={wallet}
        walletLoading={walletLoading}
        loadingFeed={loadingFeed}
        onLoadOlder={onLoadOlder}
      />
    ),
    agents: <ReviewerAgentsTable agents={profile.perAgent} slug={chain.slug} />,
    feedback: <ReviewerFeedbackTable items={feed.items} chain={chain} />,
  };

  return <TabBar tabs={tabs} label="Reviewer views" panels={panels} />;
}
