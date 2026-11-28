import type { IndexedAgent } from '../../../../shared/lib/explorer';
import { ChainIcon } from '../../../../shared/ui';
import type { Network } from '@shared/schemas';

type Props = {
  agent: IndexedAgent;
  chain: Network | undefined;
};

export function AgentChainCell({ agent, chain }: Props) {
  return (
    <td>
      <span className="chain-cell">
        <ChainIcon chainId={agent.chainId} name={chain?.name} size={14} />
        <span className="chain-name" title={chain?.name}>
          {chain?.name ?? `Chain ${agent.chainId}`}
        </span>
      </span>
    </td>
  );
}
