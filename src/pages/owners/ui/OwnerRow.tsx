import { useNavigate } from '@tanstack/react-router';
import type { MouseEvent } from 'react';
import {
  chainById,
  isNestedControl,
  shortAddress,
  type OwnerEntry,
} from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';
import { OwnerLatestCell } from './OwnerLatestCell';
import { OwnerNetworksCell } from './OwnerNetworksCell';

type Props = {
  owner: OwnerEntry;
  slug: string;
  showNetworks: boolean;
};

export function OwnerRow({ owner, slug, showNetworks }: Props) {
  const navigate = useNavigate();
  const targetSlug = chainById(owner.latest.chainId)?.slug ?? slug;

  function open(event?: MouseEvent<HTMLTableRowElement>): void {
    if (event && isNestedControl(event.target)) return;

    void navigate({
      to: '/owners/$slug/$address',
      params: { slug: targetSlug, address: owner.owner },
    });
  }

  return (
    <tr
      className="row-link"
      role="link"
      tabIndex={0}
      aria-label={`Open owner ${shortAddress(owner.owner)}`}
      onClick={(event) => open(event)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <td>
        <span className="address-mark mono" title={owner.owner}>
          <AddressIdenticon address={owner.owner} />
          {shortAddress(owner.owner)}
        </span>
      </td>
      <td className="num">{owner.agents}</td>
      {showNetworks ? <OwnerNetworksCell chainIds={owner.chainIds} /> : null}
      <OwnerLatestCell latest={owner.latest} slug={targetSlug} showNetworks={showNetworks} />
    </tr>
  );
}
