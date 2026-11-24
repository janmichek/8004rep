import { chainById, networkNames } from '../../../shared/lib/explorer';
import { ChainIcon } from '../../../shared/ui';

type Props = {
  chainIds: number[];
};

export function OwnerNetworksCell({ chainIds }: Props) {
  return (
    <td title={networkNames(chainIds)}>
      {chainIds.map((id) => {
        const chain = chainById(id);

        return (
          <span key={id} className="chain-cell">
            <ChainIcon chainId={id} name={chain?.name ?? String(id)} size={14} />
            <span className="chain-name">{chain?.shortName ?? id}</span>
          </span>
        );
      })}
    </td>
  );
}
