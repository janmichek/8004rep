import type { Network } from '@shared/schemas';

export function NetworkMark({ symbol, color }: { symbol: string; color: Network['color'] }) {
  return (
    <span aria-hidden="true" className={`network-mark network-mark--${color}`}>
      {symbol}
    </span>
  );
}
