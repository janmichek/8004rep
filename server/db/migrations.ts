import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Sql } from './client';

export type Migration = { version: string; sql: string };

const DEFAULT_DIR = join(process.cwd(), 'server/db/migrations');

const appliedVersions = z
  .array(z.object({ version: z.string() }))
  .transform((rows) => rows.map((row) => row.version));

const SCHEMA_MIGRATIONS = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

/** Reads `NNNN_name.sql` files in lexical order; the version is the file name. */
export async function loadMigrations(dir: string = DEFAULT_DIR): Promise<Migration[]> {
  const names = (await readdir(dir)).filter((name) => name.endsWith('.sql')).toSorted();

  return Promise.all(
    names.map(async (version) => ({ version, sql: await readFile(join(dir, version), 'utf8') }))
  );
}

/**
 * Applies pending migrations once each, in version order, inside a
 * transaction together with its bookkeeping row. Re-running is a no-op.
 */
export async function applyMigrations(
  db: Sql,
  migrations: readonly Migration[]
): Promise<string[]> {
  await db.query(SCHEMA_MIGRATIONS);
  const rows = await db.query('SELECT version FROM schema_migrations');
  const done = new Set(appliedVersions.parse(rows));
  const applied: string[] = [];

  for (const migration of migrations) {
    if (done.has(migration.version)) continue;

    await db.transaction(async (tx) => {
      await tx.query(migration.sql);
      await tx.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
    });
    applied.push(migration.version);
  }

  return applied;
}

export async function migrateFromDisk(db: Sql, dir: string = DEFAULT_DIR): Promise<string[]> {
  return applyMigrations(db, await loadMigrations(dir));
}
