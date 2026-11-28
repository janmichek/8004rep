import { addressExplorerUrl, shortAddress, type ChainInfo } from '../../../shared/lib/explorer';
import { AddressIdenticon, StarButton } from '../../../shared/ui';
import { OwnerCount } from './OwnerCount';

type Props = {
  address: string;
  chain: ChainInfo;
  owned: number | undefined;
  loading: boolean;
  dataPresent: boolean;
};

export function OwnerHead({ address, chain, owned, loading, dataPresent }: Props) {
  const label = shortAddress(address);

  return (
    <div className="agent-head">
      <AddressIdenticon address={address} size={64} />
      <div>
        <h1>{label}</h1>
        <p className="meta">
          <span className="chip">owner</span>
          <OwnerCount owned={owned} loading={loading} dataPresent={dataPresent} />
          <span className="mono">{address}</span>
          <a href={addressExplorerUrl(chain, address)} target="_blank" rel="noopener noreferrer">
            Explorer ↗
          </a>
          <StarButton kind="owner" chainId={chain.chainId} id={address} label={label} />
        </p>
      </div>
    </div>
  );
}
