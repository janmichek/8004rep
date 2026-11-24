import { addressExplorerUrl, shortAddress, type ChainInfo } from '../../../shared/lib/explorer';
import { AddressIdenticon, StarButton } from '../../../shared/ui';

type Props = { chain: ChainInfo; address: string };

export function ReviewerHead({ chain, address }: Props) {
  return (
    <div className="agent-head">
      <AddressIdenticon address={address} size={64} />
      <div>
        <h1>{shortAddress(address)}</h1>
        <p className="meta">
          <span className="chip">reviewer</span>
          <span className="mono">{address}</span>
          <a href={addressExplorerUrl(chain, address)} target="_blank" rel="noopener noreferrer">
            Explorer ↗
          </a>
          <StarButton
            kind="reviewer"
            chainId={chain.chainId}
            id={address}
            label={shortAddress(address)}
          />
        </p>
      </div>
    </div>
  );
}
