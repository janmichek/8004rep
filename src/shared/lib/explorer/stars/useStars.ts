import { useSyncExternalStore } from 'react';
import {
  getStarCount,
  getStarred,
  isStarred,
  subscribeStars,
  type Star,
  type StarKind,
} from './index';

export function useStarCount(): number {
  return useSyncExternalStore(subscribeStars, getStarCount, () => 0);
}

export function useStarred(): Star[] {
  return useSyncExternalStore(subscribeStars, getStarred, () => []);
}

export function useIsStarred(kind: StarKind, chainId: number, id: string | bigint): boolean {
  return useSyncExternalStore(
    subscribeStars,
    () => isStarred(kind, chainId, id),
    () => false
  );
}
