import { Hint } from './Hint';
import { TileHint } from './TileHint';
import { TileMeterView } from './TileMeterView';
import { TileValue } from './TileValue';
import type { Tile } from './tileTypes';

function tileClass(tile: Tile): string {
  let name = 'tile';

  if (tile.tone) name += ` tone-${tile.tone}`;

  if (tile.meter) name += ' has-meter';

  return name;
}

export function TileBox({ tile }: { tile: Tile }) {
  const box = (
    <div className={tileClass(tile)} tabIndex={tile.title ? 0 : undefined}>
      <div className="tile-label">{tile.label}</div>
      <TileValue tile={tile} />
      <TileHint tile={tile} />
      {tile.meter && !tile.loading ? (
        <div className="tile-meter" aria-hidden="true">
          <TileMeterView meter={tile.meter} />
        </div>
      ) : null}
    </div>
  );

  return tile.title ? <Hint text={tile.title}>{box}</Hint> : box;
}
