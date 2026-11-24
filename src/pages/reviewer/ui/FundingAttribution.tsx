import {
  addressExplorerUrl,
  formatDate,
  shortAddress,
  txExplorerUrl,
  type ChainInfo,
} from '../../../shared/lib/explorer';
import { AddressIdenticon } from '../../../shared/ui';
import type { ReviewerWallet } from './useReviewerWallet';

type Funding = NonNullable<ReviewerWallet['funding']>;

type Props = { chain: ChainInfo; funding: Funding };

export function FundingAttribution({ chain, funding }: Props) {
  return (
    <>
      First funded by{' '}
      <a
        href={addressExplorerUrl(chain, funding.funder)}
        target="_blank"
        rel="noopener noreferrer"
        className="address-mark mono"
      >
        <AddressIdenticon address={funding.funder} />
        {shortAddress(funding.funder)}
      </a>
      {funding.timestamp ? <> on {formatDate(funding.timestamp)}</> : null}
      {' ('}
      <a href={txExplorerUrl(chain, funding.txHash)} target="_blank" rel="noopener noreferrer">
        tx ↗
      </a>
      ). Other reviewers funded by the same address show up as a shared funder on an agent's
      Reviewers tab.
    </>
  );
}
