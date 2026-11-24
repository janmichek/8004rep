import { Link } from '@tanstack/react-router';
import { ownerSearchFor, type OwnerOrder, type OwnerSort } from './ownerSearch';

type Props = {
  slug: string;
  address: string;
  page: number;
  hasMore: boolean;
  sort: OwnerSort | null;
  order: OwnerOrder;
  activeSort: OwnerSort | null;
};

function pageSearch(page: number, sort: OwnerSort | null, order: OwnerOrder) {
  return ownerSearchFor({ currentSort: sort, currentOrder: order, page });
}

export function OwnerPager({ slug, address, page, hasMore, sort, order, activeSort }: Props) {
  if (page <= 0 && !hasMore) return null;

  const newer = activeSort ? '← Previous' : '← Newer';
  const older = activeSort ? 'Next →' : 'Older →';

  return (
    <nav className="pager" aria-label="Pagination">
      {page > 0 ? (
        <Link
          to="/owners/$slug/$address"
          params={{ slug, address }}
          search={pageSearch(page - 1, sort, order)}
        >
          {newer}
        </Link>
      ) : (
        <span className="muted">{newer}</span>
      )}
      <span>Page {page + 1}</span>
      {hasMore ? (
        <Link
          to="/owners/$slug/$address"
          params={{ slug, address }}
          search={pageSearch(page + 1, sort, order)}
        >
          {older}
        </Link>
      ) : (
        <span className="muted">{older}</span>
      )}
    </nav>
  );
}
