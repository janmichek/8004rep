export type NetworkEnv = 'mainnet' | 'testnet';

const KEY = '8004rep:env';

function stored(): NetworkEnv {
  try {
    return localStorage.getItem(KEY) === 'testnet' ? 'testnet' : 'mainnet';
  } catch {
    return 'mainnet';
  }
}

type Listener = () => void;

let current: NetworkEnv = typeof window === 'undefined' ? 'mainnet' : stored();
const listeners = new Set<Listener>();

export function getNetworkEnv(): NetworkEnv {
  return current;
}

export function setNetworkEnv(value: NetworkEnv): void {
  if (value === current) return;
  current = value;
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Private mode: the switch still holds for this session.
  }
  listeners.forEach((l) => l());
}

export function subscribeNetworkEnv(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
