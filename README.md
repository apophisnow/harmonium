# Harmonium

A self-hosted chat platform with text chat, voice channels, and real-time features. Built with TypeScript end-to-end.

## Features

- **Text Chat** -- Real-time messaging with cursor-based pagination, message editing, soft-delete, and typing indicators
- **Voice Chat** -- WebRTC voice channels powered by mediasoup SFU with speaking detection, mute/deafen controls
- **Servers & Channels** -- Create servers, organize text and voice channels by category
- **Roles & Permissions** -- Discord-style bitfield permissions with channel-level overrides
- **File Uploads** -- Avatar uploads (auto-resized to WebP), message attachments with type validation
- **Invites** -- Shareable invite links with optional expiry and usage limits
- **Presence** -- Real-time online/idle/DND/offline status tracking
- **WebSocket Gateway** -- JSON-based protocol with heartbeat, reconnection, and Redis pub/sub for horizontal scaling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify, TypeScript, Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache/PubSub | Redis 7 |
| Frontend | React 19, TypeScript, Vite, TailwindCSS |
| State | Zustand |
| Voice | mediasoup (SFU), mediasoup-client |
| Infrastructure | Docker Compose, Nginx |

## Quick Start (Docker)

The fastest way to get running. Requires [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

```bash
# Clone the repository
git clone <repo-url>
cd harmonium

# Create your environment file
cp .env.example .env
```

Edit `.env` and set secure secrets:

```env
JWT_SECRET=your-random-secret-at-least-16-chars
JWT_REFRESH_SECRET=another-random-secret-at-least-16
MEDIASOUP_ANNOUNCED_IP=127.0.0.1   # Your server's public IP for voice
```

Then start everything:

```bash
docker compose up -d
```

The app will be available at **http://localhost**. The first time may take a few minutes while mediasoup's native dependencies compile.

### Running database migrations

After starting the containers for the first time (or after schema changes):

```bash
docker compose exec server npx drizzle-kit migrate
```

## Development

For local development with hot reloading:

```bash
npm install
cp .env.example .env    # Edit secrets as needed
npm run db:push
npm run dev
```

`npm run dev` starts PostgreSQL and Redis via Docker, builds the shared package, then watches all workspaces in parallel with hot reloading. See [DEVELOPMENT.md](DEVELOPMENT.md) for the full guide.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://harmonium:harmonium@localhost:5432/harmonium` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | -- | Secret for signing access tokens (min 16 chars) |
| `JWT_REFRESH_SECRET` | -- | Secret for signing refresh tokens (min 16 chars) |
| `PORT` | `3001` | Server HTTP port |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL (for CORS) |
| `MEDIASOUP_ANNOUNCED_IP` | `127.0.0.1` | Public IP for WebRTC (must be reachable by clients) |
| `UPLOAD_DIR` | `./uploads` | Directory for file uploads |
| `MAX_UPLOAD_SIZE` | `10485760` | Max upload size in bytes (default 10MB) |
| `DEFAULT_THEME` | `harmonium` | Default them if no server or user theme preference |
| `DEFAULT_MODE` | `dark` | Default mode light/dark |
| `DOMAIN` | `example.com`  | Domain used for  | ACME_EMAIL=admin@YOUR_DOMAIN
# SMTP (optional — if not set, verification URLs are logged to console)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@harmonium.app

## Project Structure

```
harmonium/
├── packages/shared/          # Shared types, permissions, WS event definitions
├── server/                   # Fastify backend
│   └── src/
│       ├── db/schema/        # Drizzle table definitions
│       ├── plugins/          # Fastify plugins (auth, cors, redis, websocket, uploads)
│       ├── modules/          # Route modules (auth, users, servers, channels,
│       │                     #   messages, roles, invites, voice)
│       ├── ws/               # WebSocket gateway + handlers + Redis pub/sub
│       ├── voice/            # mediasoup worker pool + room management
│       ├── storage/          # File storage abstraction (local filesystem)
│       └── utils/            # Snowflake IDs, permission engine, error classes
├── client/                   # React frontend
│   └── src/
│       ├── api/              # HTTP + voice API client functions
│       ├── stores/           # Zustand stores (server, channel, message, member,
│       │                     #   presence, voice, ui, toast, auth)
│       ├── hooks/            # useWebSocket, useVoice, usePermissions,
│       │                     #   useInfiniteMessages, useTypingIndicator
│       ├── components/       # Layout, auth, server, channel, chat, voice,
│       │                     #   user, shared components
│       └── pages/            # Login, Register, App, Invite, NotFound
├── nginx/                    # Reverse proxy config
├── docker-compose.yml
└── .env.example
```

## Architecture Highlights

- **Snowflake IDs** -- 64-bit sortable IDs with embedded timestamps (custom epoch Jan 1 2024), serialized as strings in JSON
- **Bitfield Permissions** -- Single BIGINT column per role, Discord-identical model with channel overrides
- **Cursor Pagination** -- Messages use `?before=<snowflakeId>&limit=50`, no OFFSET scanning
- **Redis Pub/Sub** -- All WebSocket events published through Redis, enabling horizontal scaling across multiple server instances
- **mediasoup SFU** -- Audio packets forwarded without mixing, round-robin worker pool (up to 4 OS threads)

## Ports

| Port | Service |
|------|---------|
| 80 | Nginx (main entry point in Docker) |
| 3001 | API server |
| 5173 | Vite dev server (development only) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 40000-40100/udp | mediasoup WebRTC media |

## License

MIT
