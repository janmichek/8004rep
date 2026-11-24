import { CountUp } from './CountUp';
import { Skeleton } from './Skeleton';
import type { Tile } from './tileTypes';

export function TileValue({ tile }: { tile: Tile }) {
  const classes = tile.word && !tile.loading ? 'tile-value word' : 'tile-value';

  const style = tile.tone
    ? { color: 'color-mix(in srgb, var(--tile-tone) 72%, var(--text))' }
    : undefined;

  return (
    <div className={classes} style={style}>
      {tile.loading ? <Skeleton width="3.2em" height="1.25em" /> : <CountUp value={tile.value} />}
    </div>
  );
}
