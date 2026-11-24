import { useMemo } from 'react';
import { useParams } from '@tanstack/react-router';
import { isAddress } from 'viem';
import { findChainBySlug } from '../../../shared/lib/explorer';
import { buildReviewerProfile } from '../../../shared/lib/explorer';
import { UnknownNetworkState } from '../../../shared/ui';
import { ReviewerContent } from './ReviewerContent';
import { ReviewerHead } from './ReviewerHead';
import { useReviewerFeed } from './useReviewerFeed';
import { useReviewerWallet } from './useReviewerWallet';

export function ReviewerPage() {
  const { slug, address: addressParam } = useParams({ from: '/reviewers/$slug/$address' });
  const chain = findChainBySlug(slug);
  const address = isAddress(addressParam, { strict: false }) ? addressParam : undefined;
  const { feed, feedError, loadingFeed, loadFeed } = useReviewerFeed(chain, address);
  const wallet = useReviewerWallet(chain, address);

  const profile = useMemo(
    () => (address && feed ? buildReviewerProfile(address, feed.items) : undefined),
    [address, feed]
  );

  if (!address) {
    return (
      <section className="state">
        <h1>Not an address</h1>
        <p className="muted">“{addressParam}” is not a 0x address.</p>
      </section>
    );
  }

  if (!chain) return <UnknownNetworkState />;

  return (
    <>
      <ReviewerHead chain={chain} address={address} />
      <ReviewerContent
        chain={chain}
        profile={profile}
        feed={feed}
        feedError={feedError}
        loadingFeed={loadingFeed}
        wallet={wallet.data}
        walletLoading={wallet.loading}
        onRetry={() => void loadFeed()}
        onLoadOlder={() => void loadFeed(true)}
      />
    </>
  );
}
