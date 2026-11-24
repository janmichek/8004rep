import { addressExplorerUrl, shortAddress, type ChainInfo } from '../../../shared/lib/explorer';
import { AddressIdenticon, Skeleton, StarButton } from '../../../shared/ui';

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
          {loading || !dataPresent ? (
            <span>
              <Skeleton width="4.2em" height="1.35em" radius="999px" />
            </span>
          ) : null}
          {!loading && dataPresent && owned !== undefined ? (
            <span className="chip">
              {owned} {owned === 1 ? 'agent' : 'agents'}
            </span>
          ) : null}
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
