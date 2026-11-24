import { Link } from '@tanstack/react-router';
import { chainById, type OwnerEntry } from '../../../shared/lib/explorer';
import { ChainIcon } from '../../../shared/ui';

type Props = {
  latest: OwnerEntry['latest'];
  slug: string;
  showNetworks: boolean;
};

export function OwnerLatestCell({ latest, slug, showNetworks }: Props) {
  const chain = chainById(latest.chainId);

  return (
    <td className="num">
      <Link
        to="/agents/$slug/$id"
        params={{ slug, id: latest.tokenId.toString() }}
        onClick={(event) => event.stopPropagation()}
      >
        #{latest.tokenId.toString()}
      </Link>
      {showNetworks ? (
        <span className="chain-cell">
          ·{' '}
          <ChainIcon
            chainId={latest.chainId}
            name={chain?.name ?? String(latest.chainId)}
            size={14}
          />
          <span className="chain-name">{chain?.shortName}</span>
        </span>
      ) : null}
    </td>
  );
}
