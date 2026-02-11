import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config.js';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

function createDb() {
  const config = getConfig();
  const client = postgres(config.DATABASE_URL);
  return drizzle(client, { schema });
}

let db: Database | undefined;

export function getDb(): Database {
  if (!db) {
    db = createDb();
  }
  return db;
}

export { schema };
