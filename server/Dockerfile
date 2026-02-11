# Build stage
FROM node:22-alpine AS builder

# mediasoup needs these for native compilation
RUN apk add --no-cache python3 py3-pip py3-setuptools make g++ linux-headers

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

# Install all dependencies
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY server/ ./server/

# Build shared package first, then server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=server

# Production stage
FROM node:22-alpine

RUN apk add --no-cache python3 py3-pip py3-setuptools make g++ linux-headers

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY server/package.json ./server/

RUN npm install --omit=dev

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations

WORKDIR /app/server

EXPOSE 3001
EXPOSE 40000-40100/udp

CMD ["node", "dist/index.js"]
