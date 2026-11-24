import { formatDate } from '../../../shared/lib/explorer';
import type { FeedWindow } from '../../../shared/lib/explorer';
import type { NetworkStats } from '../../../shared/lib/explorer';
import { StatTiles, TabBar } from '../../../shared/ui';
import { NetworkAgents } from './NetworkAgents';
import { NetworkCharts } from './NetworkCharts';
import { NetworkLatest } from './NetworkLatest';
import { NetworkLookalikes } from './NetworkLookalikes';
import { NetworkSuspects } from './NetworkSuspects';
import { networkWindowTiles } from './networkWindowTiles';
import type { ChainInfo } from '../../../shared/lib/explorer';

type NetworkTab = { id: string; label: string; count: number; tone?: 'warn' };

type Props = {
  chain: ChainInfo;
  feed: FeedWindow;
  stats: NetworkStats;
  loading: boolean;
  load: (extend?: boolean) => Promise<void>;
};

export function NetworkWindow({ chain, feed, stats, loading, load }: Props) {
  const suspectsTab: NetworkTab = {
    id: 'suspects',
    label: 'Suspect reviewers',
    count: stats.suspects.length,
  };

  if (stats.suspects.length) suspectsTab.tone = 'warn';

  const tabs = [
    suspectsTab,
    { id: 'lookalikes', label: 'Lookalike agents', count: stats.lookalikes.length },
    { id: 'agents', label: 'Busiest agents', count: stats.topAgents.length },
    { id: 'latest', label: 'Latest Feedback' },
  ];

  const panels = {
    suspects: <NetworkSuspects rows={stats.suspects} chain={chain} />,
    lookalikes: <NetworkLookalikes groups={stats.lookalikes} chain={chain} />,
    agents: <NetworkAgents rows={stats.topAgents} chain={chain} />,
    latest: <NetworkLatest rows={feed.items} chain={chain} />,
  };

  return (
    <>
      <h2 className="stat-heading">
        Loaded window <small>computed here</small>
      </h2>
      <StatTiles tiles={networkWindowTiles(stats)} />
      <p className="muted note">
        Window: {stats.rows} newest rows{feed.since ? ` since ${formatDate(feed.since)}` : ''}.{' '}
        {feed.cursor ? (
          <button type="button" disabled={loading} onClick={() => void load(true)}>
            {loading ? 'Loading…' : 'Load older feedback'}
          </button>
        ) : (
          <span>That is everything the source holds.</span>
        )}
      </p>
      <NetworkCharts items={feed.items} stats={stats} />
      <TabBar tabs={tabs} label="Network views" panels={panels} />
    </>
  );
}
