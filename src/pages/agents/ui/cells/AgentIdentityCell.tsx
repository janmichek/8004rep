import type { IndexedAgent } from '../../../../shared/lib/explorer';
import { AgentAvatar, StarButton } from '../../../../shared/ui';

type Props = {
  agent: IndexedAgent;
  name: string;
};

export function AgentIdentityCell({ agent, name }: Props) {
  return (
    <td>
      <div className="agent-cell">
        <StarButton
          kind="agent"
          variant="icon"
          chainId={agent.chainId}
          id={agent.tokenId}
          label={name}
          {...(agent.imageUrl ? { image: agent.imageUrl } : {})}
        />
        <AgentAvatar
          image={agent.imageUrl}
          label={name}
          seed={`${agent.chainId}:${agent.tokenId}`}
        />
        <div className="agent-name">
          <span className="agent-title">{name}</span>
          {agent.description ? <small>{agent.description}</small> : null}
        </div>
      </div>
    </td>
  );
}
