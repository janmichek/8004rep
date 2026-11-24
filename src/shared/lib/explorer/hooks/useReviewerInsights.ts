import { useEffect, useState } from 'react';
import type { ChainInfo } from '../chains';
import { sourceFor } from '../data';
import { clusterByFunder } from '../data/funding';
import { loadReviewerInsights, type ReviewerInsight } from '../data/reviewerInsights';
import type { ReviewerStats } from '../data/feedbackStats';

/** Reviewers looked up across agents and on the explorer, heaviest first. */
const LOOKUP = 12;

export function useReviewerInsights(
  chain: ChainInfo,
  tokenId: bigint,
  reviewers: ReviewerStats[],
  self: string[]
) {
  const [insights, setInsights] = useState<Map<string, ReviewerInsight>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setInsights(new Map());
    void (async () => {
      try {
        const { source, rpcClient } = await sourceFor(chain);
        const targets = reviewers.slice(0, LOOKUP).map((reviewer) => reviewer.client);
        const next = new Map<string, ReviewerInsight>();
        await loadReviewerInsights(chain, rpcClient, source, targets, (insight) => {
          if (!live) return;
          next.set(insight.address.toLowerCase(), insight);
          setInsights(new Map(next));
        });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- keyed on the agent being viewed
  }, [chain.chainId, tokenId]);

  const values = [...insights.values()];
  const clusters = clusterByFunder(
    values.map((insight) => ({ reviewer: insight.address, funding: insight.funding ?? null })),
    self
  );
  const fundingChecked = values.filter((insight) => insight.funding !== undefined).length;
  return { insights, loading, clusters, fundingChecked };
}
