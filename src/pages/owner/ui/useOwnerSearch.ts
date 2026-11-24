import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  ownerPage,
  ownerSearchFor,
  parseOwnerOrder,
  parseOwnerSort,
  type OwnerSort,
} from './ownerSearch';

export function useOwnerSearch() {
  const search = useSearch({ from: '/owners/$slug/$address' });
  const navigate = useNavigate({ from: '/owners/$slug/$address' });
  const page = ownerPage(search.page);
  const sort = parseOwnerSort(search.sort);
  const order = parseOwnerOrder(search.order);

  function toggleSort(next: OwnerSort): void {
    const nextOrder = sort === next && order === 'desc' ? 'asc' : 'desc';

    void navigate({
      search: ownerSearchFor({
        currentSort: sort,
        currentOrder: order,
        sort: next,
        order: nextOrder,
      }),
    });
  }

  return { page, sort, order, toggleSort };
}
