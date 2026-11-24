import { agentScanUrl, type ChainInfo } from '../../../lib/explorer';
import type { ScanScore } from '../../../lib/explorer/data/scan';
import type { Feedback } from '../../../lib/explorer/data/types';
import { Skeleton } from '../Skeleton';
import { CompareDetails } from './CompareDetails';
import { CompareSummary } from './CompareSummary';

type Props = {
  chain: ChainInfo;
  tokenId: bigint;
  feedback: Feedback[];
  raw: number | null;
  trusted: number | null;
  scan?: ScanScore | null | undefined;
  loading: boolean;
  error?: string | undefined;
};

function loadingState() {
  return (
    <div className="compare-head" aria-busy="true" aria-live="polite">
      <span className="sr-only">Asking 8004scan</span>
      {['one', 'two', 'three', 'four'].map((slot) => (
        <div key={slot} className="skeleton-stack">
          <Skeleton width="8em" height="0.7em" />
          <Skeleton width="3.2em" height="1.5em" />
          <Skeleton width="9em" height="0.7em" />
        </div>
      ))}
    </div>
  );
}

export function CompareTab({
  chain,
  tokenId,
  feedback,
  raw,
  trusted,
  scan,
  loading,
  error,
}: Props) {
  if (loading) return loadingState();

  if (error) return <p className="notice">8004scan could not be reached: {error}</p>;

  if (!scan) {
    return (
      <p className="muted">
        8004scan has not scored this agent.{' '}
        <a href={agentScanUrl(chain, tokenId)} target="_blank" rel="noopener noreferrer">
          Open it there ↗
        </a>
      </p>
    );
  }

  return (
    <>
      <CompareSummary scan={scan} feedback={feedback} raw={raw} trusted={trusted} />
      <CompareDetails chain={chain} tokenId={tokenId} feedback={feedback} raw={raw} scan={scan} />
    </>
  );
}
