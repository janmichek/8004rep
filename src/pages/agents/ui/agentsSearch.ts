export type AgentsSearchParams = {
  q?: string;
  chain?: number;
  rated?: true;
  page?: number;
  sort?: 'registered' | 'score' | 'feedback';
  order?: 'asc' | 'desc';
};

export function buildAgentsSearch(args: {
  q: string;
  chain: number | undefined;
  rated: boolean;
  page: number;
  sort?: 'registered' | 'score' | 'feedback' | null | undefined;
  order?: 'asc' | 'desc' | undefined;
}): AgentsSearchParams {
  const out: AgentsSearchParams = {};
  const rated = args.rated;

  if (args.q) out.q = args.q;

  if (args.chain !== undefined) out.chain = args.chain;

  if (rated) out.rated = true;

  if (!rated && args.sort) {
    out.sort = args.sort;

    if (args.order === 'asc') out.order = 'asc';
  }

  if (args.page > 0) out.page = args.page + 1;

  return out;
}
