import { buildApp } from './app.js';
import { getConfig } from './config.js';
import { runMigrations } from './db/migrate.js';

async function main() {
  const config = getConfig();

  await runMigrations();

  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: '::' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
