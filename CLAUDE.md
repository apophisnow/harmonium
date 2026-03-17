# CLAUDE.md

## Quick Start

```bash
npm install                    # all workspaces
cp .env.example .env           # configure env
npm run dev                    # starts postgres, redis, shared, server, client
```

See DEVELOPMENT.md for full setup details.

## Project Structure

npm workspaces monorepo: `packages/shared` (types), `server` (Fastify), `client` (React/Vite).

## Critical Rules

### Database Migrations — Single File

We are in early development. All schema changes go into the **single existing migration file** (`server/src/db/migrations/0000_flimsy_exiles.sql`). Do NOT create new migration files. The workflow:

1. Edit schema in `server/src/db/schema/*.ts`
2. Run `npm run db:push` to sync locally (direct schema push, no migration files)
3. When the migration file needs updating, regenerate: delete the existing migration + meta dir, then `npm run db:generate`
4. The single migration runs automatically on server startup via `server/src/db/migrate.ts`

**Why:** Multiple migration files add complexity we don't need yet. One file keeps the schema easy to reason about until we reach production stability.

### tsc Does Not Copy Non-TypeScript Files

`tsc` only compiles `.ts` → `.js`. SQL migration files, JSON metadata, and other assets in `src/` are NOT copied to `dist/`. The Dockerfiles handle this with explicit COPY steps. If you run the server from `dist/` outside Docker (e.g., in CI), you must manually copy migrations:

```bash
cp -r server/src/db/migrations server/dist/db/migrations
```

## Testing Requirements

### When Adding a Feature

Every new feature must include:

1. **Unit tests** — Test business logic in isolation. Place in `server/src/modules/<name>/__tests__/<name>.service.test.ts` or the equivalent client path. Mock external dependencies (DB, Redis, other services).

2. **Integration tests** — Add test cases to `server/src/__tests__/integration.test.ts`. These run against a live server with real Postgres and Redis. Use the `ApiClient` helper class from `api-client.ts` which provides:
   - `register()`, `login()` — auth
   - `createServer()`, `getChannels()`, `createInvite()`, `acceptInvite()` — server ops
   - `sendMessage()`, `getMessages()` — messaging
   - `get()`, `post()`, `patch()`, `delete()` — raw HTTP with auth
   - Factory helpers: `registerUser()`, `setupServerWithOwner()`, `addMemberToServer()`

3. **Client tests** — For new stores or API modules, add tests in `client/src/stores/__tests__/` or `client/src/api/__tests__/`.

### Running Tests

```bash
npm test                                            # unit tests (all workspaces)
npm test --workspace=server                         # server unit tests only
npm test --workspace=client                         # client unit tests only

# Integration tests (requires running server + DB + Redis)
cd server && npx vitest run --config vitest.integration.config.ts
```

Unit tests use `server/vitest.config.ts` (excludes `integration.test.ts`).
Integration tests use `server/vitest.integration.config.ts` (includes only `integration.test.ts`).

## Module Pattern

Server features follow: `server/src/modules/<name>/`
- `<name>.schemas.ts` — Zod validation schemas
- `<name>.service.ts` — Business logic
- `<name>.routes.ts` — Fastify route handlers

Register new routes in `server/src/app.ts`.

## Shared Types

All shared TypeScript types live in `packages/shared/src/types/`. Export new types from `packages/shared/src/index.ts`. Both server and client import from `@harmonium/shared`.

Build shared before server/client: `npm run build --workspace=packages/shared`

## Client Conventions

- **State**: Zustand stores in `client/src/stores/`
- **API**: Axios-based modules in `client/src/api/` (auto token refresh)
- **UI components**: shadcn/ui primitives in `client/src/components/ui/`, add via `npx shadcn@latest add <component>`
- **Styling**: Tailwind CSS with custom Harmonium theme tokens (CSS variables prefixed `th-`)
- **Routing**: React Router v7 in `client/src/App.tsx`

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
1. **Typecheck** — builds shared, then typechecks server + client
2. **Test** — starts Postgres + Redis services, builds, runs unit tests, starts server, runs integration tests

Docker images pushed to GHCR on main/tags (`.github/workflows/docker.yml`).

## Common Gotchas

- **`NODE_ENV=test` is required for integration tests** — disables rate limiting. The server must be started with `NODE_ENV=test` or integration tests will hit rate limits and fail.
- IDs are snowflake BigInts stored as strings in JSON — use `string` type, not `number`
- Privacy settings on users affect friend requests and DMs — integration tests for social features may need to enable `friendRequestFromEveryone` on test users
- Email service mocks are needed in unit tests to avoid `process.exit(1)` from missing SMTP config
- The client dev server proxies `/api`, `/ws`, `/uploads` to `localhost:3001` — no CORS issues in dev
