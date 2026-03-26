import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '../config.js';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDb>;

/**
 * A type representing either the main database instance or a transaction.
 * Both share the same query interface, so functions that accept this type
 * can be used inside or outside a transaction.
 */
export type DbOrTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

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
