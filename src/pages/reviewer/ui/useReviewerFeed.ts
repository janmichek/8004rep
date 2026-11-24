import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import {
  errorMessage,
  loadFeedWindow,
  sourceFor,
  type ChainInfo,
  type FeedWindow,
} from '../../../shared/lib/explorer';

type FeedOptions = { minRows: number; from?: FeedWindow };

type FeedState = {
  key: string;
  feed?: FeedWindow;
  error?: string;
  loading: boolean;
};

function scopeKeyOf(chain: ChainInfo | undefined, address: Address | undefined): string {
  return `${chain?.chainId ?? 'none'}:${address ?? 'none'}`;
}

function startState(key: string, previous: FeedWindow | undefined): FeedState {
  const state: FeedState = { key, loading: true };

  if (previous) state.feed = previous;

  return state;
}

function sameScopeFeed(
  previous: { key: string; feed: FeedWindow } | undefined,
  key: string
): FeedWindow | undefined {
  if (!previous) return undefined;

  if (previous.key !== key) return undefined;

  return previous.feed;
}

/** The reviewer's feedback grows with "Load older"; a new chain or address restarts it. */
export function useReviewerFeed(chain: ChainInfo | undefined, address: Address | undefined) {
  const scopeKey = scopeKeyOf(chain, address);
  const [state, setState] = useState<FeedState>({ key: scopeKey, loading: false });
  const feedRef = useRef<{ key: string; feed: FeedWindow } | undefined>(undefined);
  const runRef = useRef(0);
  const current = state.key === scopeKey ? state : undefined;
  const feed = current?.feed;
  const feedError = current?.error;
  const loadingFeed = current?.loading ?? false;

  const loadFeed = useCallback(
    async (extend = false): Promise<void> => {
      if (!chain) return;

      if (!address) return;

      const key = scopeKeyOf(chain, address);
      const run = ++runRef.current;
      const previous = sameScopeFeed(feedRef.current, key);

      setState(startState(key, previous));

      try {
        const { source } = await sourceFor(chain);
        const options: FeedOptions = { minRows: 100 };

        if (extend && previous) options.from = previous;

        const next = await loadFeedWindow(source, { client: address }, options);

        if (run !== runRef.current) return;

        feedRef.current = { key, feed: next };
        setState({ key, feed: next, loading: false });
      } catch (err) {
        if (run === runRef.current) setState({ key, error: errorMessage(err), loading: false });
      }
    },
    [chain, address]
  );

  useEffect(() => {
    feedRef.current = undefined;
    void loadFeed();
  }, [loadFeed]);

  return { feed, feedError, loadingFeed, loadFeed };
}
