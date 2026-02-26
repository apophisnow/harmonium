import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(__dirname, 'migrations');

  if (!fs.existsSync(path.join(migrationsFolder, 'meta', '_journal.json'))) {
    console.log('No migrations found, skipping.');
    return;
  }

  const config = getConfig();
  const sql = postgres(config.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');

  await sql.end();
}
