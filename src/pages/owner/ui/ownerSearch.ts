export type OwnerSort = 'created' | 'id';

export type OwnerOrder = 'asc' | 'desc';

export type OwnerSearch = {
  page?: number;
  sort?: string;
  order?: OwnerOrder;
};

type SearchInput = {
  currentSort: OwnerSort | null;
  currentOrder: OwnerOrder;
  page?: number | undefined;
  sort?: OwnerSort | null | undefined;
  order?: OwnerOrder | undefined;
};

export function parseOwnerSort(value: string | undefined): OwnerSort | null {
  if (value === 'created') return 'created';

  if (value === 'id') return 'id';

  return null;
}

export function parseOwnerOrder(value: string | undefined): OwnerOrder {
  return value === 'asc' ? 'asc' : 'desc';
}

/** URL pages are one-based; the source pages from zero. */
export function ownerPage(value: number | undefined): number {
  return Math.max(0, Math.trunc(Number(value) || 1) - 1);
}

/** Query for a page/sort change: omits defaults, so URLs stay short. */
export function ownerSearchFor(input: SearchInput): OwnerSearch {
  const sortValue = input.sort === undefined ? input.currentSort : input.sort;
  const orderValue = input.order ?? input.currentOrder;
  const target = input.page ?? 0;
  const search: OwnerSearch = {};

  if (sortValue) {
    search.sort = sortValue;

    if (orderValue === 'asc') search.order = 'asc';
  }

  if (target > 0) search.page = target + 1;

  return search;
}
