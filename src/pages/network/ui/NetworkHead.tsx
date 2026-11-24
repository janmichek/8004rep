import { addressExplorerUrl } from '../../../shared/lib/explorer';
import type { ChainInfo } from '../../../shared/lib/explorer';
import { ChainIcon } from '../../../shared/ui';
import { NetworkPicker } from '../../../features/network-picker';

export function NetworkHead({ chain, slug }: { chain: ChainInfo; slug: string }) {
  return (
    <div className="agent-head">
      <ChainIcon chainId={chain.chainId} name={chain.name} size={64} />
      <div>
        <h1>{chain.name}</h1>
        <p className="meta">
          <span className="chip">feedback health</span>
          <span className="mono">chain {chain.chainId}</span>
          <a
            href={addressExplorerUrl(chain, chain.identity)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Registry ↗
          </a>
        </p>
        <div className="scope-pick">
          <NetworkPicker routeName="network" slug={slug} allowAll={false} />
        </div>
      </div>
    </div>
  );
}
