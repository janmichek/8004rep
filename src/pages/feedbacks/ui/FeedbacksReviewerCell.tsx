import { Link } from '@tanstack/react-router';
import { chainById, shortAddress } from '../../../shared/lib/explorer';
import type { FeedbackEvent } from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';

type Props = { row: FeedbackEvent; slug: string };

export function FeedbacksReviewerCell({ row, slug }: Props) {
  const chain = chainById(row.chainId ?? 0);

  return (
    <td>
      <Link
        to="/reviewers/$slug/$address"
        params={{ slug: chain?.slug ?? slug, address: row.client }}
        className="address-mark mono"
        onClick={(event) => event.stopPropagation()}
      >
        <AddressIdenticon address={row.client} />
        {shortAddress(row.client)}
      </Link>
    </td>
  );
}
