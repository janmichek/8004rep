import type { ChainInfo } from '../../../lib/explorer';
import type { FeedbackStats } from '../../../lib/explorer/data/feedbackStats';
import type { ReputationReport } from '../../../lib/explorer/data/reputation/report';
import type { AgentDetail } from '../../../lib/explorer/data/types';
import { useReviewerInsights } from '../../../lib/explorer/hooks/useReviewerInsights';
import { ReviewerFundingNote } from './ReviewerFundingNote';
import { ReviewersClusters } from './ReviewersClusters';
import { ReviewersTable } from './ReviewersTable';
import type { ReviewerRow } from './reviewerRow';

type Props = {
  agent: AgentDetail;
  chain: ChainInfo;
  stats: FeedbackStats;
  rep: ReputationReport;
  self: string[];
};

export function ReviewersTab({ agent, chain, stats, rep, self }: Props) {
  const byClient = new Map(
    rep.contributions.map((contribution) => [contribution.client.toLowerCase(), contribution])
  );

  const reviewers: ReviewerRow[] = stats.reviewers
    .map((reviewer) => {
      const contribution = byClient.get(reviewer.client.toLowerCase());

      return {
        ...reviewer,
        scoreShare: contribution?.share ?? null,
        scoreWithout: contribution?.without ?? null,
      };
    })
    .toSorted((a, b) => (b.scoreShare ?? 0) - (a.scoreShare ?? 0) || b.rows - a.rows);

  const { insights, loading, clusters, fundingChecked } = useReviewerInsights(
    chain,
    agent.tokenId,
    reviewers,
    self
  );

  return (
    <>
      <ReviewerFundingNote chain={chain} loading={loading} found={insights.size} />
      <ReviewersClusters
        clusters={clusters}
        chain={chain}
        fundingChecked={fundingChecked}
        loading={loading}
      />
      <ReviewersTable
        rows={reviewers}
        chain={chain}
        self={self}
        insights={insights}
        loading={loading}
      />
    </>
  );
}
