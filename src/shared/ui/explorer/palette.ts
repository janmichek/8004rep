/** Chart series shape; mirrors the old Vue palette module. */
export type Series = { key: string; label: string; color: string };

/**
 * Chart colors. Weight classes are ordered states, so they take the status
 * steps (good → warning → critical) plus a neutral for revoked; a legend and
 * per-column tooltips always carry the meaning alongside the color.
 */
export const WEIGHT_SERIES: Series[] = [
  { key: 'clean', label: 'full weight', color: '#0ca30c' },
  { key: 'discounted', label: 'discounted', color: '#fab219' },
  { key: 'zero', label: 'weight 0', color: '#d03b3b' },
  { key: 'revoked', label: 'revoked', color: '#5b6472' },
];

/** Single-series magnitude (distributions, volumes). */
export const COUNT_SERIES: Series[] = [{ key: 'count', label: 'reviews', color: '#3987e5' }];

export type WeightClass = 'clean' | 'discounted' | 'zero' | 'revoked';

export function weightClass(revoked: boolean, weight: number): WeightClass {
  if (revoked) return 'revoked';

  if (weight === 0) return 'zero';

  if (weight < 1) return 'discounted';

  return 'clean';
}

export const WEIGHT_LABELS: Record<string, string> = Object.fromEntries(
  WEIGHT_SERIES.map((series) => [series.key, series.label])
);
