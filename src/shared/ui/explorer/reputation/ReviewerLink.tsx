import { Link } from '@tanstack/react-router';
import { shortAddress } from '../../../lib/explorer';
import { AddressIdenticon } from '../../marks/AddressIdenticon';

export function ReviewerLink({ address, slug }: { address: string; slug: string }) {
  return (
    <Link
      to="/reviewers/$slug/$address"
      params={{ slug, address }}
      className="address-mark mono"
      title={address}
    >
      <AddressIdenticon address={address} />
      {shortAddress(address)}
    </Link>
  );
}
