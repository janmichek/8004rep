import { describe, expect, it } from 'vitest';
import { listFilters, orderBy, parseIds, whereClause } from './agentQueries';

describe('parseIds', () => {
  it('reads chain:token pairs and drops malformed entries', () => {
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds('8453:1, 1:2,bad,3:x,:4,5:')).toEqual([
      { chainId: 8453, tokenId: '1' },
      { chainId: 1, tokenId: '2' },
    ]);
  });
});

describe('listFilters', () => {
  it('adds an environment chain list', () => {
    const where = listFilters({ env: 'mainnet' });
    expect(where.clauses[1]).toContain('a.chain_id IN');
    expect(where.params.length).toBeGreaterThan(0);
  });

  it('combines chain, search, rated-only and ids filters', () => {
    const where = listFilters({
      chain: 8453,
      q: 'atlas',
      ratedOnly: true,
      ids: '8453:1,8453:2',
    });

    expect(where.clauses).toHaveLength(5);
    expect(where.params).toEqual([8453, 'atlas', 'atlas', 'atlas%', 8453, '1', 8453, '2']);
    expect(whereClause(where)).toContain('WHERE');
  });

  it('escapes ILIKE wildcards in the prefix fallback', () => {
    expect(listFilters({ q: '100%_x' }).params[2]).toBe('100\\%\\_x%');
  });

  it('keeps burned agents out of the list by default', () => {
    expect(whereClause(listFilters({}))).toBe('WHERE a.burned = FALSE');
  });
});

describe('orderBy', () => {
  it('maps every sort column and direction', () => {
    expect(orderBy({ sort: 'registered', order: 'asc' })).toContain('a.registered_at ASC');
    expect(orderBy({ sort: 'score' })).toContain('s.score DESC');
    expect(orderBy({ sort: 'feedback' })).toContain('COALESCE(s.feedback_count, 0)');
    expect(orderBy({ sort: 'tokenId' })).toContain('a.token_id');
    expect(orderBy({})).toContain('a.registered_at');
  });
});
