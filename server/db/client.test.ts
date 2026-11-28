import { describe, expect, it } from 'vitest';
import {
  SERVERLESS_POOL,
  WORKER_POOL,
  createSql,
  type PostgresFactory,
  type QueryParam,
} from './client';

type Call = { query: string; params: readonly QueryParam[] };

type State = {
  calls: Call[];
  url: string;
  max: number | null;
};

function makeFactory(state: State): PostgresFactory {
  return (url, options) => {
    state.url = url;
    state.max = options.max;

    const raw: ReturnType<PostgresFactory> = {
      async unsafe(query: string, params?: QueryParam[]) {
        state.calls.push({ query, params: params ?? [] });

        return [];
      },
      async begin<T>(run: (tx: ReturnType<PostgresFactory>) => T | Promise<T>) {
        return run(raw);
      },
      async end() {
        state.calls.push({ query: 'END', params: [] });
      },
    };

    return raw;
  };
}

function throwingFactory(cause: Error | string): PostgresFactory {
  return () => {
    const raw: ReturnType<PostgresFactory> = {
      async unsafe() {
        throw cause;
      },
      async begin<T>(run: (tx: ReturnType<PostgresFactory>) => T | Promise<T>) {
        return run(raw);
      },
      async end() {},
    };

    return raw;
  };
}

describe('createSql', () => {
  it('adapts parameterized queries and closes the pool', async () => {
    const state: State = { calls: [], url: '', max: null };
    const sql = createSql('postgres://rep:rep@db/rep', 3, makeFactory(state));

    await expect(sql.query('SELECT $1', ['a', 1, 2n, true, null])).resolves.toEqual([]);
    await sql.close();

    expect(state.calls[0]).toEqual({
      query: 'SELECT $1',
      params: ['a', 1, 2n, true, null],
    });
    expect(state.calls.at(-1)?.query).toBe('END');
    expect(state.url).toBe('postgres://rep:rep@db/rep');
    expect(state.max).toBe(3);
  });

  it('runs a callback inside the root transaction', async () => {
    const state: State = { calls: [], url: '', max: null };
    const sql = createSql('postgres://db', 1, makeFactory(state));

    const result = await sql.transaction(async (tx) => {
      await tx.query('DELETE FROM feedbacks', []);

      return 'done';
    });

    expect(result).toBe('done');
    expect(state.calls[0]?.query).toBe('DELETE FROM feedbacks');
  });

  it('names the failing SQL statement', async () => {
    const sql = createSql('postgres://db', 1, throwingFactory(new Error('boom')));

    await expect(sql.query('SELECT $1')).rejects.toThrow('SQL failed (boom): SELECT $1');
    await expect(
      createSql('postgres://db', 1, throwingFactory('plain boom')).query('SELECT $1')
    ).rejects.toThrow('SQL failed (query failed): SELECT $1');
  });

  it('exposes the pool sizes', () => {
    expect(SERVERLESS_POOL).toBe(1);
    expect(WORKER_POOL).toBe(5);
  });

  it('constructs the real driver lazily and closes it', async () => {
    const sql = createSql('postgres://user:pass@127.0.0.1:1/rep');

    await expect(sql.close()).resolves.toBeUndefined();
  });
});
