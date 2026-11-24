import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import {
  formatDate,
  isNestedControl,
  type AgentSummary,
  type ChainInfo,
  type ReputationSummary,
} from '../../../shared/lib/explorer';
import { AgentFeedbackCell } from './AgentFeedbackCell';
import { AgentIdentityCell } from './AgentIdentityCell';
import { AgentOwnerCell } from './AgentOwnerCell';
import { AgentServicesCell } from './AgentServicesCell';
import { useAgentFile } from './useAgentFile';

type Props = {
  agent: AgentSummary;
  chain: ChainInfo;
  /** On-chain count and average; absent while it loads or if the read failed. */
  score?: ReputationSummary | undefined;
  /** Scores for this page are still being read. */
  scoreLoading?: boolean | undefined;
  /** Owner page already is that address; the column would only repeat it. */
  hideOwner?: boolean | undefined;
};

export function AgentRow({ agent, chain, score, scoreLoading, hideOwner }: Props) {
  const navigate = useNavigate();
  const file = useAgentFile(agent);
  const name = file?.name ?? `Agent #${agent.tokenId.toString()}`;

  function open(event?: MouseEvent<HTMLTableRowElement>): void {
    if (event && isNestedControl(event.target)) return;

    void navigate({
      to: '/agents/$slug/$id',
      params: { slug: chain.slug, id: agent.tokenId.toString() },
    });
  }

  return (
    <tr
      className="row-link"
      role="link"
      tabIndex={0}
      aria-label={`Open ${name}`}
      onClick={(event) => open(event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <AgentIdentityCell agent={agent} chain={chain} file={file} />
      <td className="num">#{agent.tokenId.toString()}</td>
      {hideOwner ? null : <AgentOwnerCell owner={agent.owner} chain={chain} />}
      <AgentServicesCell file={file} />
      <AgentFeedbackCell score={score} loading={scoreLoading} />
      <td className="num">{agent.createdAt ? formatDate(agent.createdAt) : '—'}</td>
    </tr>
  );
}
