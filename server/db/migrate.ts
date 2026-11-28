import { createSql } from './client';
import { migrateFromDisk } from './migrations';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const db = createSql(databaseUrl, 2);
const applied = await migrateFromDisk(db);

console.log(applied.length ? `Applied ${applied.join(', ')}` : 'No pending migrations');

await db.close();
