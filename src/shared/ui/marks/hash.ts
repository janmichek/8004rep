export function hashText(text: string): number {
  let h = 2166136261;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);

  return h >>> 0;
}

export function nextHash(state: number): number {
  let next = state;

  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;

  return next >>> 0;
}

type PickedColor = {
  color: string;
  state: number;
};

export function pickColor(palette: readonly string[], state: number): PickedColor {
  const next = nextHash(state);
  const color = palette[next % palette.length] ?? palette[0] ?? '#888';

  return { color, state: next } satisfies PickedColor;
}
