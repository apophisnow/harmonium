import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getConfig } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const config = getConfig();
  const sql = postgres(config.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  const migrationsFolder = path.join(__dirname, 'migrations');

  console.log('Running database migrations...');
  await migrate(db, { migrationsFolder });
  console.log('Migrations complete.');

  await sql.end();
}
