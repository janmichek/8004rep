import { Link } from '@tanstack/react-router';
import { shortAddress, type ChainInfo } from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';

type Props = {
  owner: string | null;
  chain: ChainInfo;
};

export function AgentOwnerCell({ owner, chain }: Props) {
  if (!owner) {
    return (
      <td>
        <span className="muted">—</span>
      </td>
    );
  }

  return (
    <td>
      <Link
        to="/owners/$slug/$address"
        params={{ slug: chain.slug, address: owner }}
        className="address-mark mono"
        title={owner}
      >
        <AddressIdenticon address={owner} />
        {shortAddress(owner)}
      </Link>
    </td>
  );
}
