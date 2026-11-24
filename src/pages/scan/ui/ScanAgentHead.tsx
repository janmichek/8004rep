import { AgentAvatar, StarButton } from '../../../shared/ui';
import type { ScanAgentDetail } from '../../../shared/lib/explorer';

type Props = {
  agent: ScanAgentDetail;
  id: string;
  scanUrl: string;
};

export function ScanAgentHead({ agent, id, scanUrl }: Props) {
  const name = agent.name ?? `Agent #${id}`;

  return (
    <div className="agent-head">
      <AgentAvatar
        large
        image={agent.imageUrl}
        label={name}
        seed={`${agent.chainId}:${agent.tokenId}`}
      />
      <div>
        <h1>{name}</h1>
        <p className="meta">
          <span className="mono">
            {agent.chainId}:{agent.tokenId}
          </span>
          {agent.active === true ? <span className="chip ok">active</span> : null}
          {agent.active === false ? <span className="chip">inactive</span> : null}
          {agent.x402 ? <span className="chip accent">x402</span> : null}
          {agent.protocols.map((protocol) => (
            <span key={protocol} className="chip">
              {protocol}
            </span>
          ))}
          <StarButton
            kind="agent"
            chainId={agent.chainId}
            id={agent.tokenId}
            label={name}
            image={agent.imageUrl}
          />
          <a href={scanUrl} target="_blank" rel="noopener noreferrer">
            View on 8004scan ↗
          </a>
        </p>
      </div>
    </div>
  );
}
