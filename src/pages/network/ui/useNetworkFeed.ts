import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchNetworkStats } from '../../../shared/api';
import { errorMessage, loadFeedWindow, sourceFor, useAsync } from '../../../shared/lib/explorer';
import type { ChainInfo, FeedWindow } from '../../../shared/lib/explorer';
import { computeNetworkStats } from '../../../shared/lib/explorer';

type FeedOptions = { minRows: number; maxSteps: number; from?: FeedWindow };

export function useNetworkFeed(chain: ChainInfo) {
  const [feed, setFeed] = useState<FeedWindow | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (extend = false) => {
      setLoading(true);
      setError(undefined);

      try {
        const { source } = await sourceFor(chain);

        const options: FeedOptions = {
          minRows: 250,
          maxSteps: 12,
        };

        if (extend && feed) options.from = feed;

        const next = await loadFeedWindow(source, {}, options);

        setFeed(next);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [chain, feed]
  );

  useEffect(() => {
    setFeed(undefined);
    void load(false);
    // oxlint-disable-next-line react/exhaustive-deps -- a new chain restarts the window
  }, [chain.chainId]);

  const network = useAsync(() => fetchNetworkStats(chain.chainId), [chain.chainId]);
  const stats = useMemo(() => (feed ? computeNetworkStats(feed.items) : undefined), [feed]);

  return { chain, feed, stats, error, loading, load, network };
}
