# Task 5: Auth Module (Register, Login, JWT, Refresh Tokens)

## Objective
Implement the complete authentication system: user registration with validation, login, JWT access tokens (15min), refresh tokens (7 days, stored hashed in DB), token refresh rotation, and logout. Also set up the Fastify app factory with initial plugins.

## Dependencies
- Task 2 (database schema) - Must be complete (users table, refreshTokens table, snowflake generator)

## Pre-existing Files to Read
- `server/src/app.ts` - Fastify app factory (skeleton, needs plugins registered)
- `server/src/index.ts` - Entry point
- `server/src/config.ts` - Environment config
- `server/src/db/index.ts` - Database connection
- `server/src/db/schema/users.ts` - Users and refreshTokens table schemas
- `server/src/utils/snowflake.ts` - ID generator
- `packages/shared/src/types/user.ts` - User types
- `packages/shared/src/permissions.ts` - DEFAULT_PERMISSIONS for creating @everyone role later

## Files to Create

### 1. `server/src/plugins/cors.ts` - CORS Plugin
```typescript
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { getConfig } from '../config.js';

export default fp(async (app) => {
  const config = getConfig();
  await app.register(cors, {
    origin: config.CLIENT_URL,
    credentials: true,
  });
});
```
Note: Add `fastify-plugin` to server/package.json dependencies if not present.

### 2. `server/src/plugins/auth.ts` - JWT Auth Plugin
Register @fastify/jwt with the app. Create a `authenticate` decorator/hook that:
- Extracts Bearer token from Authorization header
- Verifies JWT using JWT_SECRET
- Sets `request.user` with `{ userId: string, username: string }`
- Returns 401 if token missing/invalid/expired

Export a preHandler hook function that routes can use: `app.addHook('onRequest', authenticate)`

Decorate the Fastify instance so TypeScript knows about `request.user`:
```typescript
declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; username: string };
  }
}
```

### 3. `server/src/plugins/redis.ts` - Redis Plugin
Connect ioredis client, decorate fastify instance with `app.redis`:
```typescript
declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}
```

### 4. `server/src/utils/errors.ts` - Error Classes
```typescript
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, message);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(400, message);
  }
}
```

Set up a Fastify error handler that catches AppError instances and returns proper JSON:
```typescript
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ error: error.message });
  }
  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({ error: error.message });
  }
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error' });
});
```

### 5. `server/src/modules/auth/password.ts` - Password Hashing
```typescript
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}
```

### 6. `server/src/modules/auth/auth.schemas.ts` - Validation Schemas
Using Zod:
```typescript
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
```

### 7. `server/src/modules/auth/auth.service.ts` - Auth Business Logic
Functions:
- `register(input: RegisterInput)`:
  - Check if email already exists -> ConflictError
  - Generate random 4-digit discriminator (check uniqueness with username)
  - Hash password with argon2
  - Generate snowflake ID
  - Insert user into DB
  - Generate token pair
  - Return { user, accessToken, refreshToken }

- `login(input: LoginInput)`:
  - Find user by email -> UnauthorizedError if not found
  - Verify password -> UnauthorizedError if wrong
  - Generate token pair
  - Return { user, accessToken, refreshToken }

- `refresh(refreshToken: string)`:
  - Hash the refresh token (using crypto.createHash('sha256'))
  - Find in DB by tokenHash where not revoked and not expired
  - If not found -> UnauthorizedError
  - Revoke the old token (set revoked = true)
  - Generate new token pair
  - Return { user, accessToken, refreshToken }

- `logout(refreshToken: string)`:
  - Hash and revoke the token in DB

- `generateTokenPair(user)`:
  - Access token: JWT with { userId, username }, expires 15 minutes, signed with JWT_SECRET
  - Refresh token: random 64-byte hex string
  - Store hash of refresh token in refreshTokens table with 7-day expiry
  - Return both tokens

### 8. `server/src/modules/auth/auth.routes.ts` - Auth Routes
Register as Fastify plugin with prefix `/api/auth`:
- `POST /api/auth/register` - validate body with registerSchema, call authService.register
- `POST /api/auth/login` - validate body with loginSchema, call authService.login
- `POST /api/auth/refresh` - validate body with refreshSchema, call authService.refresh
- `POST /api/auth/logout` - requires auth, validate body with refreshSchema, call authService.logout
- `GET /api/auth/me` - requires auth, return current user from DB

All responses follow: `{ user, accessToken, refreshToken }` for auth endpoints, or `{ user }` for /me.

### 9. Update `server/src/app.ts`
Register all created plugins and the auth routes module:
```typescript
// Register plugins
await app.register(corsPlugin);
await app.register(redisPlugin);
await app.register(authPlugin);

// Register error handler

// Register route modules
await app.register(authRoutes);
```

## Important Implementation Notes
- Use `crypto.randomBytes(64).toString('hex')` for refresh tokens
- Use `crypto.createHash('sha256').update(token).digest('hex')` to hash refresh tokens before storage
- JWT signing: use @fastify/jwt's `app.jwt.sign()` and `app.jwt.verify()`
- All bigint IDs should be converted to strings when sending in JSON responses
- The discriminator is a random 4-digit string "0001" to "9999", padded with zeros

## Acceptance Criteria
- [ ] `POST /api/auth/register` creates user, returns tokens
- [ ] `POST /api/auth/login` authenticates, returns tokens
- [ ] `POST /api/auth/refresh` rotates refresh token, returns new pair
- [ ] `POST /api/auth/logout` revokes refresh token
- [ ] `GET /api/auth/me` returns authenticated user
- [ ] Passwords hashed with argon2 (never stored plain)
- [ ] Refresh tokens stored as SHA-256 hashes in DB
- [ ] JWT access tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days
- [ ] Duplicate email returns 409 Conflict
- [ ] Invalid credentials return 401 Unauthorized
- [ ] Input validation returns 400 with descriptive errors
- [ ] All files compile with `npx tsc --noEmit`
