import { Link, useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import type { ChainInfo } from '../../../lib/explorer';
import type { AgentDetail, RegistrationFile } from '../../../lib/explorer/data/types';
import { formatDate, shortAddress } from '../../../lib/explorer';
import { useReputation } from '../../../lib/explorer/hooks/useReputation';
import { AddressIdenticon } from '../../marks/AddressIdenticon';
import { FeedbackTab } from '../FeedbackTab';
import { TabBar } from '../TabBar';
import { StatTiles } from '../StatTiles';
import { CompareTab } from './CompareTab';
import { MethodsTab } from './MethodsTab';
import { OverviewTab } from './OverviewTab';
import { ReviewersTab } from './ReviewersTab';

type Props = {
  agent: AgentDetail;
  chain: ChainInfo;
  file?: RegistrationFile | null | undefined;
  overviewTop?: ReactNode;
  identity: ReactNode;
};

export function ReputationPanel({ agent, chain, file, overviewTop, identity }: Props) {
  const { self, stats, report, rep, scan, tiles, tabs } = useReputation(agent, chain, file);
  const navigate = useNavigate();

  const reviewerLink = (address: string) => (
    <Link
      to="/reviewers/$slug/$address"
      params={{ slug: chain.slug, address }}
      className="address-mark mono"
      title={address}
    >
      <AddressIdenticon address={address} />
      {shortAddress(address)}
    </Link>
  );

  const openDetail = (index: number) => {
    void navigate({
      to: '/agents/$slug/$id/feedback/$index',
      params: { slug: chain.slug, id: agent.tokenId.toString(), index: String(index) },
    });
  };

  const empty = <p className="muted">No feedback yet.</p>;

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
        empty
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
