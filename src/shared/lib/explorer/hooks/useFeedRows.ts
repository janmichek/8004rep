import { useMemo } from 'react';
import { sourceFor } from '../data';
import { loadFeedWindow, type FeedWindow } from '../data/feed';
import type { FeedbackEvent } from '../data/types';
import { useChainLoad } from './useChainLoad';
import type { Scope } from './useScope';

/**
 * The newest feedback of every chain in the scope, flattened into one list.
 * Every row carries the chain it came from, because token IDs repeat between
 * networks, and `load(true)` extends each chain's own window.
 */
export function useFeedRows(scope: Scope, window: { minRows: number; maxSteps: number }) {
  const chainLoad = useChainLoad<FeedWindow>(scope, async (chain, previous) => {
    const { source } = await sourceFor(chain);
    return loadFeedWindow(source, {}, { ...window, ...(previous ? { from: previous } : {}) });
  });

  const rows = useMemo<FeedbackEvent[]>(
    () =>
      Object.entries(chainLoad.values).flatMap(([id, feed]) =>
        feed.items.map((row) => ({ ...row, chainId: row.chainId ?? Number(id) }))
      ),
    [chainLoad.values]
  );
  const hasMore = useMemo(
    () => Object.values(chainLoad.values).some((feed) => feed.cursor),
    [chainLoad.values]
  );
  const since = useMemo(() => {
    const only = scope.all ? undefined : scope.chains[0];
    return only ? chainLoad.values[only.chainId]?.since : undefined;
  }, [scope.all, scope.chains, chainLoad.values]);

  return { ...chainLoad, rows, hasMore, since };
}
