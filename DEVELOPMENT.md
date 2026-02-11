# Development Guide

This guide covers local development setup, project conventions, and how to work on each part of the codebase.

## Prerequisites

- **Node.js 22+** (LTS recommended)
- **npm 10+** (comes with Node.js 22)
- **PostgreSQL 16** (or use Docker)
- **Redis 7** (or use Docker)
- **Python 3, make, g++** (required by mediasoup native compilation)

On macOS, the native build tools come with Xcode Command Line Tools:

```bash
xcode-select --install
```

## Local Development Setup

### 1. Start databases with Docker

The easiest way to get PostgreSQL and Redis running:

```bash
docker compose up postgres redis -d
```

This starts just the databases without building the full app containers.

### 2. Install dependencies

From the project root:

```bash
npm install
```

This installs all three workspaces (`packages/shared`, `server`, `client`) in one command. mediasoup will compile its native worker during install -- this takes a minute on the first run.

### 3. Build the shared package

The shared types package must be built before the server or client can import from it:

```bash
npm run build --workspace=packages/shared
```

For ongoing development, run it in watch mode in a separate terminal:

```bash
npm run dev --workspace=packages/shared
```

### 4. Configure environment

```bash
cp .env.example .env
```

The defaults work for local development with the Docker databases. Make sure `JWT_SECRET` and `JWT_REFRESH_SECRET` are at least 16 characters.

### 5. Run database migrations

Generate and apply the Drizzle schema:

```bash
cd server
npx drizzle-kit generate
npx drizzle-kit migrate
```

To inspect the database visually:

```bash
npx drizzle-kit studio
```

### 6. Start the dev servers

In separate terminals:

```bash
# Terminal 1: Server (auto-restarts on changes)
npm run dev --workspace=server

# Terminal 2: Client (Vite HMR)
npm run dev --workspace=client
```

The server runs on **http://localhost:3001** and the client on **http://localhost:5173**.

## Workspace Structure

This is an npm workspaces monorepo with three packages:

| Workspace | Path | Description |
|-----------|------|-------------|
| `@harmonium/shared` | `packages/shared/` | TypeScript types, permission bitflags, WS event definitions |
| `@harmonium/server` | `server/` | Fastify API server |
| `@harmonium/client` | `client/` | React frontend |

Run scripts in a specific workspace:

```bash
npm run <script> --workspace=server
npm run <script> --workspace=client
npm run <script> --workspace=packages/shared
```

## Server Architecture

### Module Pattern

Each feature is a module in `server/src/modules/<name>/` with three files:

- **`<name>.schemas.ts`** -- Zod validation schemas
- **`<name>.service.ts`** -- Business logic (database queries, pub/sub)
- **`<name>.routes.ts`** -- Fastify route handlers (HTTP endpoints)

Routes are registered as Fastify plugins in `server/src/app.ts`.

### Database

- **ORM**: Drizzle with the `postgres` driver
- **Schema**: Defined in `server/src/db/schema/` using Drizzle's table builder
- **Connection**: Singleton via `getDb()` in `server/src/db/index.ts`
- **IDs**: Custom snowflake generator in `server/src/utils/snowflake.ts` -- 64-bit sortable IDs stored as BIGINT, serialized as strings in JSON

### Authentication

- JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry)
- Access tokens verified via `@fastify/jwt` decorator (`request.jwtVerify()`)
- Refresh tokens stored as SHA-256 hashes in the `refresh_tokens` table
- Token rotation: each refresh issues a new token pair and revokes the old one

### Permissions

Discord-style bitfield system:

- Each role has a `permissions` BIGINT column
- Server permissions = OR of all member role permissions
- Channel overrides: per-role allow/deny bitmasks applied on top
- Engine in `server/src/utils/permissions.ts`: `computeServerPermissions()`, `computeChannelPermissions()`, `requirePermission()`, `requireChannelPermission()`
- Flags defined in `packages/shared/src/permissions.ts`

### WebSocket Gateway

JSON protocol at `/ws/gateway`:

1. Server sends `HELLO` with heartbeat interval
2. Client sends `IDENTIFY` with JWT token
3. Server sends `READY` with initial data
4. Heartbeat ping/pong to detect stale connections

Events are published via Redis pub/sub (`server/src/ws/pubsub.ts`) so they reach clients connected to any server instance.

### Voice (mediasoup)

- Worker pool in `server/src/voice/voice-server.ts` (round-robin, max 4 workers)
- Each voice channel gets a `VoiceRoom` with its own router
- REST endpoints for the WebRTC signaling handshake:
  - `POST /api/voice/join` -- Get RTP capabilities + transport options
  - `POST /api/voice/connect-transport` -- DTLS handshake
  - `POST /api/voice/produce` -- Start sending audio
  - `POST /api/voice/consume` -- Receive another user's audio
  - `POST /api/voice/leave` -- Disconnect and clean up

### File Uploads

- `StorageProvider` interface in `server/src/storage/local.ts` (swappable for S3, etc.)
- Avatars: resized to 256x256 WebP via `sharp`
- Attachments: validated by MIME type, executables blocked
- Served via `@fastify/static` at `/uploads/`

## Client Architecture

### State Management

Zustand stores in `client/src/stores/`:

| Store | Purpose |
|-------|---------|
| `auth.store` | JWT tokens, current user, login/logout |
| `server.store` | Server list, current server selection |
| `channel.store` | Channels per server, current channel |
| `message.store` | Messages per channel, pagination state |
| `member.store` | Members per server |
| `presence.store` | User online/offline status |
| `voice.store` | Voice connection state, participants |
| `ui.store` | Sidebar toggles, active modals |
| `toast.store` | Toast notifications |

### Key Hooks

- **`useWebSocket`** -- Manages the WS connection lifecycle, dispatches events to stores, handles reconnection with exponential backoff
- **`useVoice`** -- mediasoup-client integration (Device, transports, producers/consumers, speaking detection via AudioContext)
- **`useInfiniteMessages`** -- Cursor-based message loading with `loadMore()`
- **`usePermissions`** -- Computes effective permissions for the current user
- **`useTypingIndicator`** -- Tracks typing users, debounces outgoing typing events

### API Layer

All API calls go through the axios instance in `client/src/api/client.ts`, which handles:

- JWT token injection via interceptor
- Automatic token refresh on 401 responses
- Request queuing during refresh

### Routing

React Router v7 in `client/src/App.tsx`:

- `/login`, `/register` -- Auth pages
- `/channels/:serverId/:channelId?` -- Main app (behind AuthGuard)
- `/invite/:code` -- Invite acceptance page

## Type Checking

Run TypeScript compilation checks:

```bash
# All packages
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p server/tsconfig.json
npx tsc --noEmit -p client/tsconfig.json
```

## Database Schema

Tables defined in `server/src/db/schema/`:

| Table | Description |
|-------|-------------|
| `users` | User accounts (username, discriminator, email, avatar, status) |
| `refresh_tokens` | Hashed JWT refresh tokens |
| `servers` | Discord servers (name, icon, owner) |
| `server_members` | Server membership (user + server + nickname + join date) |
| `roles` | Roles with name, color, position, permission bitfield |
| `member_roles` | Many-to-many: members to roles |
| `channel_categories` | Channel grouping categories |
| `channels` | Text and voice channels (name, type, topic, position) |
| `channel_permission_overrides` | Per-role channel permission overrides (allow/deny bitmasks) |
| `messages` | Chat messages (content, author, edited, soft-delete) |
| `attachments` | File attachments on messages |
| `invites` | Invite links (code, expiry, max uses, use count) |
| `voice_states` | Current voice channel connections (user, channel, mute/deaf) |

## Adding a New Module

1. Create schema file: `server/src/db/schema/<name>.ts`
2. Export from `server/src/db/schema/index.ts`
3. Create module directory: `server/src/modules/<name>/`
4. Add `<name>.schemas.ts` (Zod), `<name>.service.ts`, `<name>.routes.ts`
5. Register routes in `server/src/app.ts`
6. Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` for schema changes
7. Add corresponding API functions in `client/src/api/`
8. Add Zustand store if needed in `client/src/stores/`

## Docker Production Build

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f server

# Run migrations
docker compose exec server npx drizzle-kit migrate

# Stop everything
docker compose down
```

For production, make sure to:

- Set strong, unique values for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- Set `MEDIASOUP_ANNOUNCED_IP` to your server's public IP address
- Set `CLIENT_URL` to your actual domain
- Consider adding TLS termination at the Nginx layer
