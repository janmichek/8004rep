import { useNavigate } from '@tanstack/react-router';
import {
  CHAINS,
  formatDate,
  formatScore,
  formatTimeline,
  useIsStarred,
  type ScanAgent,
  type ScanChain,
} from '../../../shared/lib/explorer';
import { AgentChainCell } from './cells/AgentChainCell';
import { AgentIdentityCell } from './cells/AgentIdentityCell';
import { AgentOwnerCell } from './cells/AgentOwnerCell';
import { AgentScoreCell } from './cells/AgentScoreCell';
import { AgentServicesCell } from './cells/AgentServicesCell';

type Props = {
  agent: ScanAgent;
  chains: Map<number, ScanChain>;
  pinned?: boolean | undefined;
};

function isNestedControl(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;

  return Boolean(target.closest('a, button, input, select, textarea, label'));
}

export function ScanAgentRow({ agent, chains, pinned }: Props) {
  const navigate = useNavigate();
  const known = CHAINS.find((chain) => chain.chainId === agent.chainId);
  const chain = chains.get(agent.chainId);
  const name = agent.name || `Agent #${agent.tokenId.toString()}`;
  const services = agent.protocols.map((protocol) => protocol.toUpperCase());
  const score = Math.max(0, Math.min(100, agent.totalScore));
  const scoreLabel = formatScore(Math.round(agent.totalScore * 10) / 10);
  const createdAt = agent.createdAt ? formatTimeline(agent.createdAt) : '—';
  const createdTitle = agent.createdAt ? formatDate(agent.createdAt) : undefined;
  const starred = useIsStarred('agent', agent.chainId, agent.tokenId);
  const rowClass = `row-link${pinned || starred ? ' starred' : ''}`;

  function open() {
    if (known) {
      void navigate({
        to: '/agents/$slug/$id',
        params: { slug: known.slug, id: agent.tokenId.toString() },
      });

      return;
    }

    void navigate({
      to: '/scan/$chainId/$id',
      params: { chainId: String(agent.chainId), id: agent.tokenId.toString() },
    });
  }

  return (
    <tr
      className={rowClass}
      role="link"
      tabIndex={0}
      aria-label={`Open ${name}`}
      onClick={(event) => {
        if (isNestedControl(event.target)) return;

        open();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <AgentIdentityCell agent={agent} name={name} />
      <td className="num">#{agent.tokenId.toString()}</td>
      <AgentChainCell agent={agent} chain={chain} />
      <AgentServicesCell agent={agent} services={services} />
      <AgentScoreCell score={score} scoreLabel={scoreLabel} />
      <td className="num">{agent.feedbackCount}</td>
      <AgentOwnerCell agent={agent} known={known} />
      <td className="num" title={createdTitle}>
        {createdAt}
      </td>
    </tr>
  );
}
