# Build stage
FROM node:22-alpine AS builder

# mediasoup needs these for native compilation
RUN apk add --no-cache python3 py3-pip py3-setuptools make g++ linux-headers

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

# Install all dependencies (single compilation of native modules)
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY server/ ./server/

# Build shared package first, then server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=server

# Prune dev dependencies in-place (reuses already-compiled native modules)
RUN npm prune --omit=dev

# Production stage
FROM node:22-alpine

# mediasoup needs native libs at runtime
RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app

# Copy pruned node_modules from builder (no recompilation)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

# Copy package files (needed for workspace resolution)
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

# Copy compiled output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations

WORKDIR /app/server

EXPOSE 3001
EXPOSE 40000-40100/udp
EXPOSE 40000-40100/tcp

CMD ["node", "dist/index.js"]
