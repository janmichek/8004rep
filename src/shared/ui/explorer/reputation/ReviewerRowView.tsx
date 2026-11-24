import { Link, useNavigate } from '@tanstack/react-router';
import type { ChainInfo } from '../../../lib/explorer';
import { formatNumber, formatSigned, shortAddress } from '../../../lib/explorer';
import type { ReviewerInsight } from '../../../lib/explorer/data/reviewerInsights';
import { AddressIdenticon } from '../../marks/AddressIdenticon';
import { ReviewerElsewhereCell } from './ReviewerElsewhereCell';
import { ReviewerFlagsCell } from './ReviewerFlagsCell';
import { ReviewerScoreCell } from './ReviewerScoreCell';
import { ReviewerWalletCell } from './ReviewerWalletCell';
import { rowLookupPending, type ReviewerRow } from './reviewerRow';

type Props = {
  row: ReviewerRow;
  rows: ReviewerRow[];
  chain: ChainInfo;
  self: string[];
  insight: ReviewerInsight | undefined;
  loading: boolean;
};

export function ReviewerRowView({ row, rows, chain, self, insight, loading }: Props) {
  const navigate = useNavigate();
  const pending = loading && rowLookupPending(row, rows);

  function open() {
    void navigate({
      to: '/reviewers/$slug/$address',
      params: { slug: chain.slug, address: row.client },
    });
  }

  return (
    <tr
      className="row-link"
      role="link"
      tabIndex={0}
      aria-label={`Open reviewer ${shortAddress(row.client)}`}
      onClick={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('a, button, input, select, textarea, label')
        )
          return;
        open();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      <td className="nowrap">
        <Link
          to="/reviewers/$slug/$address"
          params={{ slug: chain.slug, address: row.client }}
          className="address-mark mono"
          title={row.client}
        >
          <AddressIdenticon address={row.client} />
          {shortAddress(row.client)}
        </Link>
        {self.some((address) => address.toLowerCase() === row.client.toLowerCase()) ? (
          <span className="chip bad">agent itself</span>
        ) : null}
      </td>
      <td className="num">
        {row.rows}
        {row.revoked ? <span className="muted"> ({row.revoked})</span> : null}
      </td>
      <ReviewerScoreCell row={row} />
      <td className="num">
        {row.ratingAverage === null ? '—' : formatNumber(row.ratingAverage)}
        {row.ratingMin !== null && row.ratingMin !== row.ratingMax ? (
          <small className="muted">
            {formatNumber(row.ratingMin)}–{formatNumber(row.ratingMax)}
          </small>
        ) : null}
      </td>
      <td className="num">{formatSigned(row.scoreWithout)}</td>
      <ReviewerFlagsCell row={row} />
      <ReviewerElsewhereCell insight={insight} lookupPending={pending} />
      <ReviewerWalletCell chain={chain} insight={insight} lookupPending={pending} />
    </tr>
  );
}
