import { defineConfig } from 'drizzle-kit';

// Polyfill: drizzle-kit uses JSON.stringify internally which can't serialize BigInt defaults
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export default defineConfig({
  schema: './src/db/schema/*.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
