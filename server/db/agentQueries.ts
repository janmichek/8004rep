import { catalogChainsOfEnv } from '../../shared/chains';
import type { AgentsQuery } from '../../shared/schemas';
import type { QueryParam } from './client';

export type IdPair = { chainId: number; tokenId: string };

/** Parses `chainId:tokenId` pairs; malformed entries are ignored. */
export function parseIds(raw: string | undefined): IdPair[] {
  if (!raw) return [];

  return raw.split(',').flatMap((part) => {
    const [chain, token] = part.trim().split(':');

    if (!chain || !token || !/^\d+$/.test(chain) || !/^\d+$/.test(token)) return [];

    return [{ chainId: Number(chain), tokenId: token }];
  });
}

export type Where = { clauses: string[]; params: QueryParam[] };

export function listFilters(query: AgentsQuery): Where {
  const clauses: string[] = [];
  const params: QueryParam[] = [];

  if (query.env) {
    const ids = catalogChainsOfEnv(query.env === 'testnet').map((chain) => chain.chainId);

    if (ids.length) {
      const placeholders = ids.map((_, index) => `$${params.length + index + 1}`).join(', ');
      clauses.push(`a.chain_id IN (${placeholders})`);
      params.push(...ids);
    }
  }

  if (query.chain !== undefined) {
    clauses.push(`a.chain_id = $${params.length + 1}`);
    params.push(query.chain);
  }

  if (query.q) {
    const at = params.length + 1;
    clauses.push(
      `(a.token_id::text = $${at} OR a.search_tsv @@ plainto_tsquery('simple', $${at + 1}) OR a.name ILIKE $${at + 2})`
    );
    params.push(query.q, query.q, `${query.q}%`);
  }

  if (query.ratedOnly) clauses.push('COALESCE(s.feedback_count, 0) > 0');

  const ids = parseIds(query.ids);

  if (ids.length) {
    const placeholders = ids
      .map((_, index) => `($${params.length + index * 2 + 1}, $${params.length + index * 2 + 2})`)
      .join(', ');

    clauses.push(`(a.chain_id, a.token_id) IN (${placeholders})`);
    params.push(...ids.flatMap((id) => [id.chainId, id.tokenId]));
  }

  return { clauses, params };
}

const ORDER_COLUMNS: Record<NonNullable<AgentsQuery['sort']>, string> = {
  registered: 'a.registered_at',
  score: 's.score',
  feedback: 'COALESCE(s.feedback_count, 0)',
  tokenId: 'a.token_id',
};

export function orderBy(query: AgentsQuery): string {
  const column = ORDER_COLUMNS[query.sort ?? 'registered'];
  const direction = query.order === 'asc' ? 'ASC' : 'DESC';

  return `${column} ${direction} NULLS LAST, a.token_id DESC`;
}

export function whereClause(where: Where): string {
  return where.clauses.length ? `WHERE ${where.clauses.join(' AND ')}` : '';
}
