# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root package files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY client/package.json ./client/

# Install dependencies
RUN npm install

# Copy source
COPY packages/shared/ ./packages/shared/
COPY client/ ./client/

# Build shared package first, then client
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=client

# Production stage
FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
