import { useMemo, useState } from 'react';
import { hashText, pickColor } from './hash';
import { toDisplayUrl } from '../../lib/explorer/data/metadata';

const CELLS = [
  '#0f9d8a',
  '#0d8f9c',
  '#2b7fd9',
  '#3d6fdb',
  '#4a63d9',
  '#17327a',
  '#0d4a6b',
  '#12295f',
] as const;

type Props = {
  image?: string | undefined;
  label: string;
  pending?: boolean | undefined;
  seed?: string | undefined;
  large?: boolean | undefined;
};

type Cell = { key: number; x: number; y: number; fill: string };

function matrixCells(seed: string): Cell[] {
  let state = hashText(`${seed}#matrix`) || 1;
  const paletteSize = 2 + (state % 2);
  const palette: string[] = [];

  for (let i = 0; i < paletteSize; i++) {
    const picked = pickColor(CELLS, state);

    palette.push(picked.color);
    state = picked.state;
  }

  const out: Cell[] = [];

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const picked = pickColor(palette, state);

      state = picked.state;

      const xs = col === 2 ? [col] : [col, 4 - col];

      for (const x of xs)
        out.push({ key: row * 5 + x, x: x * 10, y: row * 10, fill: picked.color });
    }
  }

  return out;
}

export function AgentAvatar({ image, label, pending, seed, large }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>(undefined);
  const cells = useMemo(() => matrixCells(seed ?? label), [seed, label]);
  const src = toDisplayUrl(image);
  const showImage = Boolean(src) && src !== failedSrc;

  if (pending) return <span className="avatar skeleton" aria-hidden="true" />;

  const classes = ['avatar'];

  if (large) classes.push('large');

  if (!showImage) classes.push('letter');

  return (
    <span className={classes.join(' ')}>
      {showImage && src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailedSrc(src);
          }}
        />
      ) : (
        <>
          <svg className="pattern" viewBox="0 0 50 50" aria-hidden="true">
            {cells.map((cell) => (
              <rect key={cell.key} x={cell.x} y={cell.y} width={10} height={10} fill={cell.fill} />
            ))}
          </svg>
          <span className="glyph">{label.trim().charAt(0).toUpperCase() || '#'}</span>
        </>
      )}
    </span>
  );
}
