import type { ReactNode } from 'react';
import { addressExplorerUrl, shortAddress } from '../../lib/explorer';
import type { ChainInfo } from '../../lib/explorer';
import type { Feedback } from '../../lib/explorer/data/types';
import { AddressIdenticon } from '../marks/AddressIdenticon';

type Props = {
  row: Feedback;
  chain: ChainInfo;
  renderReviewer?: ((address: string) => ReactNode) | undefined;
};

export function FeedbackReviewerCell({ row, chain, renderReviewer }: Props) {
  return (
    <td className="nowrap">
      {renderReviewer ? (
        renderReviewer(row.client)
      ) : (
        <a
          href={addressExplorerUrl(chain, row.client)}
          target="_blank"
          rel="noopener noreferrer"
          className="address-mark mono"
        >
          <AddressIdenticon address={row.client} />
          {shortAddress(row.client)}
        </a>
      )}
      {row.index !== undefined ? (
        <small className="muted" title="Feedback index of this reviewer on this agent">
          {' '}
          #{row.index}
        </small>
      ) : null}
    </td>
  );
}
