import { TileBox } from './TileBox';
import type { Tile } from './tileTypes';

export function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="tiles">
      {tiles.map((tile) => (
        <TileBox key={tile.label} tile={tile} />
      ))}
    </div>
  );
}
