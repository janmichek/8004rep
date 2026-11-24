import { Skeleton } from './Skeleton';

export function TxDetailSkeleton() {
  return (
    <div className="tx-detail-state" aria-busy="true" aria-live="polite">
      <span className="sr-only">Reading the transaction, the feedback file and the reviewer</span>
      <Skeleton width="42%" height="0.9em" />
      <div className="tx-groups">
        {['tx', 'file', 'payment', 'reviewer'].map((group) => (
          <div key={group} className="tx-group">
            <Skeleton width="7em" height="0.7em" />
            <div className="skeleton-stack">
              {['one', 'two', 'three'].map((line) => (
                <Skeleton
                  key={line}
                  block
                  height="0.85em"
                  width={line === 'two' ? '78%' : '100%'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
