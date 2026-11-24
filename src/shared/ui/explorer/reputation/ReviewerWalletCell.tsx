import { formatDate, shortAddress, txExplorerUrl } from '../../../lib/explorer';
import type { ChainInfo } from '../../../lib/explorer';
import { MIN_NONCE } from '../../../lib/explorer/data/txChecks';
import type { ReviewerInsight } from '../../../lib/explorer/data/reviewerInsights';
import { AddressIdenticon } from '../../marks/AddressIdenticon';
import { Skeleton } from '../Skeleton';

type Props = {
  chain: ChainInfo;
  insight: ReviewerInsight | undefined;
  lookupPending: boolean;
};

function nonceChip(nonce: number) {
  if (nonce >= MIN_NONCE) return <span>{nonce} tx</span>;

  return (
    <span className="chip warn" title={`Transactions sent; under ${MIN_NONCE} is a fresh wallet`}>
      {nonce} tx
    </span>
  );
}

function fundingLink(chain: ChainInfo, insight: ReviewerInsight) {
  const funding = insight.funding;

  if (!funding) {
    return insight.funding === null ? <span className="muted"> · funder not found</span> : null;
  }

  return (
    <>
      {' · from '}
      <a
        href={txExplorerUrl(chain, funding.txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="address-mark mono"
        title={`First funded ${funding.timestamp ? formatDate(funding.timestamp) : ''} by ${funding.funder}`}
      >
        <AddressIdenticon address={funding.funder} />
        {shortAddress(funding.funder)}
      </a>
    </>
  );
}

export function ReviewerWalletCell({ chain, insight, lookupPending }: Props) {
  if (!insight) {
    return <td>{lookupPending ? <Skeleton width="6em" /> : null}</td>;
  }

  return (
    <td className="nowrap">
      {insight.nonce !== undefined ? nonceChip(insight.nonce) : null}
      {fundingLink(chain, insight)}
    </td>
  );
}
