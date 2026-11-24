import { useMemo } from 'react';
import { hashText, nextHash, pickColor } from './hash';

const PALETTE = [
  '#c45c26',
  '#b0892e',
  '#6b7c3a',
  '#3d6b6b',
  '#8b4a5c',
  '#5c4a3a',
  '#2f4a6b',
  '#a05a3c',
] as const;

type Props = {
  address: string;
  size?: number | undefined;
};

type Blob = {
  key: number;
  fill: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
};

type IdenticonArt = {
  bg: string;
  blobs: Blob[];
};

function buildArt(address: string): IdenticonArt {
  let state = hashText(`addr:${address.trim().toLowerCase()}`) || 1;
  const bgPick = pickColor(PALETTE, state);

  state = bgPick.state;

  const blobs: Blob[] = [];

  for (let i = 0; i < 3; i++) {
    const fillPick = pickColor(PALETTE, state);

    state = fillPick.state;

    const angle = (state % 360) * (Math.PI / 180);

    state = nextHash(state);

    const dist = 4 + (state % 12);

    state = nextHash(state);

    const rx = 14 + (state % 14);

    state = nextHash(state);

    const ry = 10 + (state % 12);

    state = nextHash(state);

    blobs.push({
      key: i,
      fill: fillPick.color,
      cx: 32 + Math.cos(angle) * dist,
      cy: 32 + Math.sin(angle) * dist,
      rx,
      ry,
      rot: state % 360,
    });
  }

  return { bg: bgPick.color, blobs };
}

export function AddressIdenticon({ address, size = 16 }: Props) {
  const art = useMemo(() => buildArt(address), [address]);

  return (
    <span className="addr-identicon" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64">
        <rect width="64" height="64" fill={art.bg} />
        {art.blobs.map((blob) => (
          <ellipse
            key={blob.key}
            cx={blob.cx}
            cy={blob.cy}
            rx={blob.rx}
            ry={blob.ry}
            fill={blob.fill}
            transform={`rotate(${blob.rot} ${blob.cx} ${blob.cy})`}
            opacity={0.92}
          />
        ))}
      </svg>
    </span>
  );
}
