import { ChartSkeleton, TilesSkeleton } from '../../../shared/ui';

export function NetworkLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <h2 className="stat-heading">
        Loaded window <small>computed here</small>
      </h2>
      <span className="sr-only">Loading the latest feedback</span>
      <TilesSkeleton count={6} />
      <div className="chart-grid">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
