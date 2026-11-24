import { Link } from '@tanstack/react-router';
import type { AgentDetail, ChainInfo, Feedback } from '../../../shared/lib/explorer';
import { ChainIcon } from '../../../shared/ui';

type Props = {
  slug: string;
  id: string;
  name: string;
  chain: ChainInfo;
  agent: AgentDetail;
  row: Feedback;
};

export function FeedbackDetailHeader({ slug, id, name, chain, agent, row }: Props) {
  return (
    <>
      <h1>Feedback detail</h1>
      <p className="meta">
        <Link to="/agents/$slug/$id" params={{ slug, id }}>
          {name}
        </Link>
        <span className="mono">
          <ChainIcon chainId={chain.chainId} name={chain.name} size={13} /> {chain.chainId}:
          {agent.tokenId.toString()}
        </span>
        {row.index !== undefined ? <span className="muted">feedback #{row.index}</span> : null}
        {row.revoked ? <span className="chip">revoked</span> : null}
      </p>
    </>
  );
}
