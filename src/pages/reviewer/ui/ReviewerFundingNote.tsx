import type { ReactNode } from 'react';
import type { ChainInfo } from '../../../shared/lib/explorer';
import { ChainName, Skeleton } from '../../../shared/ui';
import { FundingAttribution } from './FundingAttribution';
import type { ReviewerWallet } from './useReviewerWallet';

type Props = { chain: ChainInfo; wallet: ReviewerWallet | null | undefined; loading: boolean };

export function ReviewerFundingNote({ chain, wallet, loading }: Props) {
  let body: ReactNode = null;
  const funding = wallet?.funding;

  if (funding) {
    body = <FundingAttribution chain={chain} funding={funding} />;
  } else if (loading) {
    body = <Skeleton width="18em" />;
  } else if (!chain.explorerApiUrl) {
    body = (
      <span className="muted">
        Funding cannot be traced on <ChainName chainId={chain.chainId} name={chain.name} /> (no
        explorer API that allows browser calls).
      </span>
    );
  } else if (wallet?.fundingError) {
    body = <span className="muted">Funding lookup failed: {wallet.fundingError}</span>;
  } else if (wallet?.funding === null) {
    body = <span className="muted">No incoming transfer among its first transactions.</span>;
  }

  return <p className="note">{body}</p>;
}
