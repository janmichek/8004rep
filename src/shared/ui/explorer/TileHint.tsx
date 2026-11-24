import { Skeleton } from './Skeleton';
import type { Tile } from './tileTypes';

export function TileHint({ tile }: { tile: Tile }) {
  if (tile.loading) {
    return (
      <div className="tile-hint">
        <Skeleton width="72%" height="0.7em" />
      </div>
    );
  }

  if (tile.hint) return <div className="tile-hint">{tile.hint}</div>;

  return null;
}
