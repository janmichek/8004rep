import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { QueryParam, Sql } from './client';
import { applyMigrations, loadMigrations, migrateFromDisk, type Migration } from './migrations';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function tempMigrations(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), '8004rep-migrations-'));
  tempDirs.push(dir);
  await Promise.all(
    Object.entries(files).map(([name, sql]) => writeFile(join(dir, name), sql, 'utf8'))
  );

  return dir;
}

type FakeState = {
  applied: string[];
  queries: { query: string; params: readonly QueryParam[] }[];
  transactions: number;
  failInsert?: boolean;
};

function fakeSql(state: FakeState): Sql {
  async function run(query: string, params: readonly QueryParam[] = []) {
    state.queries.push({ query, params });

    if (query.startsWith('INSERT INTO schema_migrations')) {
      const version = params.at(0);

      if (state.failInsert) throw new Error('insert failed');

      if (version !== undefined) state.applied.push(String(version));
    }

    if (query.startsWith('SELECT version')) {
      return state.applied.map((version) => ({ version }));
    }

    return [];
  }

  const db: Sql = {
    query: run,
    async transaction<T>(callback: (inner: Sql) => Promise<T>) {
      state.transactions++;

      return callback(db);
    },
    async close() {},
  };

  return db;
}

describe('loadMigrations', () => {
  it('reads the shipped migration', async () => {
    const migrations = await loadMigrations();
    expect(migrations[0]?.version).toBe('0001_initial.sql');
    expect(migrations[0]?.sql).toContain('CREATE TABLE IF NOT EXISTS agents');
  });

  it('sorts by version and ignores non-SQL files', async () => {
    const dir = await tempMigrations({
      '0002_second.sql': 'SELECT 2;',
      '0001_first.sql': 'SELECT 1;',
      'README.md': '# not a migration',
    });

    const migrations = await loadMigrations(dir);
    expect(migrations.map((migration) => migration.version)).toEqual([
      '0001_first.sql',
      '0002_second.sql',
    ]);
  });
});

describe('applyMigrations', () => {
  const migrations: Migration[] = [
    { version: '0001_first.sql', sql: 'CREATE TABLE a (id int);' },
    { version: '0002_second.sql', sql: 'CREATE TABLE b (id int);' },
  ];

  it('applies every pending migration inside a transaction', async () => {
    const state: FakeState = { applied: [], queries: [], transactions: 0 };
    const applied = await applyMigrations(fakeSql(state), migrations);

    expect(applied).toEqual(['0001_first.sql', '0002_second.sql']);
    expect(state.transactions).toBe(2);
    expect(state.queries.some((query) => query.query === migrations[0]?.sql)).toBe(true);
    expect(state.applied).toEqual(['0001_first.sql', '0002_second.sql']);
  });

  it('is idempotent', async () => {
    const state: FakeState = { applied: ['0001_first.sql'], queries: [], transactions: 0 };
    const applied = await applyMigrations(fakeSql(state), migrations);

    expect(applied).toEqual(['0002_second.sql']);
    expect(state.transactions).toBe(1);
  });

  it('rolls back the bookkeeping row when a migration fails', async () => {
    const state: FakeState = { applied: [], queries: [], transactions: 0, failInsert: true };
    await expect(applyMigrations(fakeSql(state), migrations)).rejects.toThrow('insert failed');
    expect(state.applied).toEqual([]);
  });

  it('loads and applies the disk migrations', async () => {
    const dir = await tempMigrations({ '0001_only.sql': 'SELECT 1;' });
    const state: FakeState = { applied: [], queries: [], transactions: 0 };
    await expect(migrateFromDisk(fakeSql(state), dir)).resolves.toEqual(['0001_only.sql']);
  });
});
