import { describe, expect, test } from 'vitest';
import { buildAgentsSearch } from './agentsSearch';

describe('buildAgentsSearch', () => {
  test('omits empty defaults', () => {
    expect(buildAgentsSearch({ q: '', chain: undefined, rated: false, page: 0 })).toEqual({});
  });

  test('keeps query filters and converts page to one-based', () => {
    expect(buildAgentsSearch({ q: 'prime', chain: 8453, rated: true, page: 2 })).toEqual({
      q: 'prime',
      chain: 8453,
      rated: true,
      page: 3,
    });
  });

  test('keeps a column sort and writes the non-default order', () => {
    expect(
      buildAgentsSearch({
        q: '',
        chain: undefined,
        rated: false,
        page: 0,
        sort: 'score',
        order: 'asc',
      })
    ).toEqual({ sort: 'score', order: 'asc' });

    expect(
      buildAgentsSearch({
        q: '',
        chain: undefined,
        rated: false,
        page: 0,
        sort: 'feedback',
        order: 'desc',
      })
    ).toEqual({ sort: 'feedback' });
  });

  test('rated mode drops a column sort', () => {
    expect(
      buildAgentsSearch({
        q: '',
        chain: undefined,
        rated: true,
        page: 0,
        sort: 'score',
        order: 'asc',
      })
    ).toEqual({ rated: true });
  });
});
