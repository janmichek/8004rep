import { Link } from '@tanstack/react-router';
import type { ChainInfo, FeedbackEvent } from '../../../shared/lib/explorer';
import { formatScore, shortAddress } from '../../../shared/lib/explorer';
import {
  AddressIdenticon,
  FeedbackFileCell,
  FeedbackTagsCell,
  FeedbackTextCell,
  FeedbackWhenCell,
} from '../../../shared/ui';

export function NetworkLatestRow({ row, chain }: { row: FeedbackEvent; chain: ChainInfo }) {
  return (
    <tr
      className={`row-link${row.revoked ? ' revoked' : ''}`}
      role="link"
      tabIndex={0}
      aria-label={`Open ${row.agentName ?? `Agent #${row.tokenId}`}`}
    >
      <td>
        <Link
          to="/agents/$slug/$id"
          params={{ slug: chain.slug, id: row.tokenId.toString() }}
          className="row-title"
        >
          {row.agentName ?? `Agent #${row.tokenId.toString()}`}
        </Link>
      </td>
      <td>
        <Link
          to="/reviewers/$slug/$address"
          params={{ slug: chain.slug, address: row.client }}
          className="address-mark mono"
        >
          <AddressIdenticon address={row.client} />
          {shortAddress(row.client)}
        </Link>
      </td>
      <td className="num">
        <b>{formatScore(row.value)}</b>
      </td>
      <FeedbackTagsCell row={row} />
      <FeedbackTextCell row={row} />
      <FeedbackFileCell row={row} />
      <FeedbackWhenCell createdAt={row.createdAt} />
    </tr>
  );
}
