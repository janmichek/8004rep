import { Link } from '@tanstack/react-router';
import { CHAINS, type Star } from '../../../shared/lib/explorer';
import { starName } from './starName';

export function StarLink({ star }: { star: Star }) {
  const chain = CHAINS.find((item) => item.chainId === star.chainId);
  const label = starName(star);

  if (star.kind === 'agent') {
    if (!chain) {
      return (
        <Link
          className="starred-name"
          to="/scan/$chainId/$id"
          params={{ chainId: String(star.chainId), id: star.id }}
        >
          {label}
        </Link>
      );
    }

    return (
      <Link
        className="starred-name"
        to="/agents/$slug/$id"
        params={{ slug: chain.slug, id: star.id }}
      >
        {label}
      </Link>
    );
  }

  if (!chain) return <span className="starred-name">{label}</span>;

  if (star.kind === 'owner') {
    return (
      <Link
        className="starred-name"
        to="/owners/$slug/$address"
        params={{ slug: chain.slug, address: star.id }}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      className="starred-name"
      to="/reviewers/$slug/$address"
      params={{ slug: chain.slug, address: star.id }}
    >
      {label}
    </Link>
  );
}
