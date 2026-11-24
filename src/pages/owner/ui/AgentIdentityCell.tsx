import type { AgentSummary, ChainInfo, RegistrationFile } from '../../../shared/lib/explorer';
import { AgentAvatar } from '../../../shared/ui';
import { AgentName } from './AgentName';

type Props = {
  agent: AgentSummary;
  chain: ChainInfo;
  file: RegistrationFile | null | undefined;
};

export function AgentIdentityCell({ agent, chain, file }: Props) {
  return (
    <td>
      <div className="agent-cell">
        <AgentAvatar
          pending={file === undefined}
          image={file?.image}
          label={file?.name ?? ''}
          seed={`${chain.chainId}:${agent.tokenId.toString()}`}
        />
        <AgentName agent={agent} file={file} />
      </div>
    </td>
  );
}
