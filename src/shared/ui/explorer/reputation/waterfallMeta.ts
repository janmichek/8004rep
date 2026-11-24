import type { LadderId } from '../../../lib/explorer/data/trustReport';

export const STEP_DOCS = new Map<string, string>([
  ['all', 'raw-onchain'],
  ['revoked', 'revoked'],
  ['ratings', 'rating-only'],
  ['self', 'rating-only'],
  ['units', 'rating-unit'],
  ['cap', 'wallet-vote'],
  ['prior', 'prior'],
]);

export const LADDER_COLOR: Record<LadderId, string> = {
  bare: '#5b6472',
  context: '#3987e5',
  file: '#0ca30c',
};

export function barWidth(value: number | null): string {
  if (value === null) return '0%';

  return `${Math.max(0, Math.min(100, value))}%`;
}

export function deltaClass(delta: number | null | undefined): string {
  if ((delta ?? 0) < -0.05) return 'bar-delta down';

  if ((delta ?? 0) > 0.05) return 'bar-delta up';

  return 'bar-delta';
}
