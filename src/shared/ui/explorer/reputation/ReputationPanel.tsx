import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { ChainInfo } from '../../../lib/explorer';
import type { AgentDetail, RegistrationFile } from '../../../lib/explorer/data/types';
import type { TagScale } from '@shared/reputation';
import { formatDate } from '../../../lib/explorer';
import { useReputation } from '../../../lib/explorer/hooks/useReputation';
import { FeedbackTab } from '../FeedbackTab';
import { TabBar } from '../TabBar';
import { StatTiles } from '../StatTiles';
import { CompareTab } from './CompareTab';
import { MethodsTab } from './MethodsTab';
import { OverviewTab } from './OverviewTab';
import { ReviewerLink } from './ReviewerLink';
import { ReviewersTab } from './ReviewersTab';

type Props = {
  agent: AgentDetail;
  chain: ChainInfo;
  file?: RegistrationFile | null | undefined;
  /** Agents the owner holds on this chain; null when the read failed. */
  ownerAgentCount?: number | null | undefined;
  tagScales?: Record<string, TagScale> | undefined;
  overviewTop?: ReactNode;
  identity: ReactNode;
};

function openFeedback(navigate: ReturnType<typeof useNavigate>, slug: string, tokenId: bigint) {
  return (index: number) => {
    void navigate({
      to: '/agents/$slug/$id/feedback/$index',
      params: { slug, id: tokenId.toString(), index: String(index) },
    });
  };
}

export function ReputationPanel({
  agent,
  chain,
  file,
  ownerAgentCount,
  tagScales,
  overviewTop,
  identity,
}: Props) {
  const { self, stats, report, rep, scan, tiles, tabs } = useReputation(
    agent,
    chain,
    file,
    ownerAgentCount,
    tagScales
  );

  const navigate = useNavigate();
  const reviewerLink = (address: string) => <ReviewerLink address={address} slug={chain.slug} />;
  const openDetail = openFeedback(navigate, chain.slug, agent.tokenId);

  const panels = {
    overview:
      agent.feedback.length === 0 ? (
        <p className="muted">No feedback yet. Nothing to score.</p>
      ) : (
        <>
          {overviewTop}
          {agent.feedbackSince ? (
            <p className="muted note">
              Feedback dated back to {formatDate(agent.feedbackSince)} (log scan window).
            </p>
          ) : null}
          <StatTiles tiles={tiles} />
          <OverviewTab feedback={agent.feedback} stats={stats} report={report} rep={rep} />
        </>
      ),
    feedback:
      agent.feedback.length === 0 ? (
        <p className="muted">No feedback yet.</p>
      ) : (
        <FeedbackTab
          agent={agent}
          chain={chain}
          stats={stats}
          renderReviewer={reviewerLink}
          onDetail={openDetail}
        />
      ),
    reviewers:
      agent.feedback.length === 0 ? (
        <p className="muted">No reviewers yet.</p>
      ) : (
        <ReviewersTab agent={agent} chain={chain} stats={stats} rep={rep} self={self} />
      ),
    identity,
    methods:
      agent.feedback.length === 0 ? (
        <p className="muted">No feedback yet. Nothing to score.</p>
      ) : (
        <MethodsTab rep={rep} feedback={agent.feedback} />
      ),
    compare:
      agent.feedback.length === 0 ? (
        <p className="muted">No feedback yet. Nothing to compare.</p>
      ) : (
        <CompareTab
          chain={chain}
          tokenId={agent.tokenId}
          feedback={agent.feedback}
          raw={report.raw}
          trusted={rep.score}
          scan={scan.data}
          loading={scan.loading}
          error={scan.error}
        />
      ),
  };

  return <TabBar tabs={tabs} label="Agent views" panels={panels} />;
}
