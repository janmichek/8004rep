import { Skeleton } from './Skeleton';

export function TilesSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="tiles" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="tile">
          <Skeleton width="62%" height="0.7em" />
          <Skeleton width="46%" height="1.35em" />
          <Skeleton width="74%" height="0.7em" />
        </div>
      ))}
    </div>
  );
}
