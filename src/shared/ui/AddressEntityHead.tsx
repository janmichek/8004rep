import { shortAddress, toggleStar, type StarKind } from '../lib/explorer';

type Props = {
  address: string;
  chainId: number;
  chainName: string;
  kind: StarKind;
  roleLabel: string;
};

export function AddressEntityHead({ address, chainId, chainName, kind, roleLabel }: Props) {
  return (
    <div className="page-head">
      <h1 className="mono">{shortAddress(address)}</h1>
      <p className="meta">
        {roleLabel} on {chainName}
        <button
          type="button"
          className="filter-toggle"
          onClick={() => toggleStar({ kind, chainId, id: address, label: shortAddress(address) })}
        >
          ☆ Star
        </button>
      </p>
    </div>
  );
}
