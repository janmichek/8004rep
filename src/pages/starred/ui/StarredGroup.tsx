import { CHAINS, starKey, toggleStar, type Star } from '../../../shared/lib/explorer';
import { AddressIdenticon, AgentAvatar, ChainName } from '../../../shared/ui';
import { StarLink } from './StarLink';
import { starName } from './starName';

type Props = {
  title: string;
  rows: Star[];
  stats: Record<string, string>;
};

export function StarredGroup({ title, rows, stats }: Props) {
  return (
    <section className="starred-group">
      <h2>
        {title} <small className="muted">{rows.length}</small>
      </h2>
      <ul className="starred-list">
        {rows.map((star) => {
          const chain = CHAINS.find((item) => item.chainId === star.chainId);
          const key = starKey(star.kind, star.chainId, star.id);

          return (
            <li key={`${star.kind}:${star.chainId}:${star.id}`}>
              <span className="starred-icon">
                {star.kind === 'agent' ? (
                  <AgentAvatar
                    image={star.image}
                    label={starName(star)}
                    seed={`${star.chainId}:${star.id}`}
                  />
                ) : (
                  <AddressIdenticon address={star.id} size={28} />
                )}
              </span>
              <StarLink star={star} />
              <span className="starred-chain">
                {chain ? (
                  <ChainName chainId={star.chainId} name={chain.name} />
                ) : (
                  <span className="mono">{star.chainId}</span>
                )}
              </span>
              {star.kind !== 'reviewer' ? (
                <span className="starred-stat">{stats[key] ?? '…'}</span>
              ) : null}
              <button type="button" className="filter-toggle" onClick={() => toggleStar(star)}>
                Remove
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
