import { Skeleton } from './Skeleton';

export function AgentHeadSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <section aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading agent</span>
      <div className="agent-head">
        <Skeleton width="64px" height="64px" radius="14px" />
        <div className="skeleton-stack">
          <Skeleton width="14em" height="1.35em" />
          <Skeleton width="22em" height="0.8em" />
        </div>
      </div>
      {tabs ? (
        <div className="tabbar" aria-hidden="true">
          {['details', 'identity', 'feedback', 'history'].map((slot) => (
            <Skeleton key={slot} width="6.5em" height="1.35em" />
          ))}
        </div>
      ) : null}
    </section>
  );
}
