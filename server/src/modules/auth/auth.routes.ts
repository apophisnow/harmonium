import type { FastifyInstance } from 'fastify';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/api/auth/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const result = await authService.register(app, parsed.data);
    return reply.status(201).send(result);
  });

  // POST /api/auth/login
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const result = await authService.login(app, parsed.data);
    return reply.send(result);
  });

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const result = await authService.refresh(app, parsed.data.refreshToken);
    return reply.send(result);
  });

  // POST /api/auth/logout (requires auth)
  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    await authService.logout(parsed.data.refreshToken);
    return reply.status(204).send();
  });

  // GET /api/auth/me (requires auth)
  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await authService.getCurrentUser(request.user.userId);
    return reply.send(user);
  });
}
