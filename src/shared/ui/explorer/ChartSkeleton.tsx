import { Skeleton } from './Skeleton';

const BARS = [42, 78, 55, 96, 34, 63, 48, 84, 40, 70];

export function ChartSkeleton() {
  return (
    <figure className="chart" aria-hidden="true">
      <figcaption className="chart-title">
        <Skeleton width="9em" height="0.9em" />
      </figcaption>
      <div className="chart-skel">
        {BARS.map((height) => (
          <Skeleton key={height} height={`${height}px`} />
        ))}
      </div>
    </figure>
  );
}
