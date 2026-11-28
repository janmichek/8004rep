import type { ChainInfo, FeedWindow } from '../../../shared/lib/explorer';
import type { NetworkStats } from '../../../shared/lib/explorer';
import { NetworkLoading } from './NetworkLoading';
import { NetworkTotals } from './NetworkTotals';
import { NetworkWindow } from './NetworkWindow';

type NetworkData = {
  feedback30d: number | null | undefined;
  totalFeedback: number | null | undefined;
  ratedAgents: number | null | undefined;
  lastIndexedBlock: number | null | undefined;
  syncedAt: number | null | undefined;
  loading: boolean;
};

type Props = {
  chain: ChainInfo;
  error: string | undefined;
  stats: NetworkStats | undefined;
  feed: FeedWindow | undefined;
  loading: boolean;
  load: (extend?: boolean) => Promise<void>;
  network: NetworkData;
};

export function NetworkBody({ chain, error, stats, feed, loading, load, network }: Props) {
  return (
    <>
      <p className="lede">
        Network totals are indexed on-chain by 8004rep. The window metrics are computed from the
        feedback rows loaded here — load older rows to widen the window.
      </p>
      <h2 className="stat-heading">
        Network totals <small>indexed on-chain</small>
      </h2>
      <NetworkTotals
        feedback30d={network.feedback30d}
        totalFeedback={network.totalFeedback}
        ratedAgents={network.ratedAgents}
        lastIndexedBlock={network.lastIndexedBlock}
        syncedAt={network.syncedAt}
        loading={network.loading}
      />
      {error ? (
        <p className="notice">
          Could not load the feed: {error}{' '}
          <button type="button" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : null}
      {!error && !stats ? <NetworkLoading /> : null}
      {!error && stats && feed ? (
        <NetworkWindow chain={chain} feed={feed} stats={stats} loading={loading} load={load} />
      ) : null}
    </>
  );
}
