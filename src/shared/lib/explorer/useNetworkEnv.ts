import { useSyncExternalStore } from 'react';
import { getNetworkEnv, setNetworkEnv, subscribeNetworkEnv, type NetworkEnv } from './env';

export function useNetworkEnv(): [NetworkEnv, (value: NetworkEnv) => void] {
  const env = useSyncExternalStore(
    subscribeNetworkEnv,
    getNetworkEnv,
    () => 'mainnet' as NetworkEnv
  );
  return [env, setNetworkEnv];
}
