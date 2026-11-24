import { ChainIcon } from '../marks/ChainIcon';

type Props = { chainId?: number | undefined; name: string; size?: number };

export function ChainName({ chainId, name, size = 16 }: Props) {
  return (
    <span className="chain-label">
      <ChainIcon chainId={chainId} name={name} size={size} />
      <span className="chain-label-text">{name}</span>
    </span>
  );
}
