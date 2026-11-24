import { shortAddress, type Star } from '../../../shared/lib/explorer';

export function starName(star: Star): string {
  if (star.kind === 'agent') return star.label || `Agent #${star.id}`;

  return star.label || shortAddress(star.id);
}
