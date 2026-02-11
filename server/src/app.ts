import Fastify from 'fastify';
import type { FastifyInstance, FastifyError } from 'fastify';
import { getConfig } from './config.js';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import redisPlugin from './plugins/redis.js';
import websocketPlugin from './plugins/websocket.js';
import uploadsPlugin from './plugins/uploads.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { serverRoutes } from './modules/servers/servers.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { roleRoutes } from './modules/roles/roles.routes.js';
import { serverInviteRoutes, inviteRoutes } from './modules/invites/invites.routes.js';
import { channelRoutes } from './modules/channels/channels.routes.js';
import { messageRoutes } from './modules/messages/messages.routes.js';
import { registerGateway } from './ws/gateway.js';
import { voiceRoutes } from './modules/voice/voice.routes.js';
import { getVoiceServer } from './voice/voice-server.js';
import { AppError } from './utils/errors.js';

export async function buildApp(): Promise<FastifyInstance> {
  const config = getConfig();

  const isProd = process.env.NODE_ENV === 'production';

  const app = Fastify({
    logger: {
      level: 'info',
      ...(!isProd && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
  });

  // Error handler for AppError instances
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.name,
        message: error.message,
        statusCode: error.statusCode,
      });
    }

    // Fastify validation errors
    if ('validation' in error && error.validation) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: error.message,
        statusCode: 400,
      });
    }

    // Fastify built-in errors (JSON parse, content-type, etc.)
    if ('statusCode' in error && error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.code ?? error.name,
        message: error.message,
        statusCode: error.statusCode,
      });
    }

    // Unexpected errors
    request.log.error(error);
    return reply.status(500).send({
      error: 'InternalServerError',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  });

  // Register plugins
  await app.register(corsPlugin);
  await app.register(authPlugin);
  await app.register(redisPlugin);
  await app.register(rateLimitPlugin);
  await app.register(websocketPlugin);
  await app.register(uploadsPlugin);

  // Health check
  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));

  // Register route modules
  await app.register(authRoutes);
  await app.register(serverRoutes);
  await app.register(userRoutes);
  await app.register(roleRoutes);
  await app.register(serverInviteRoutes);
  await app.register(inviteRoutes);
  await app.register(channelRoutes);
  await app.register(messageRoutes);

  // Register WebSocket gateway
  await registerGateway(app);

  // Register voice routes
  await app.register(voiceRoutes);

  // Initialize mediasoup voice server
  const voiceServer = getVoiceServer();
  await voiceServer.initialize();

  // Shut down voice server on close
  app.addHook('onClose', async () => {
    await voiceServer.shutdown();
  });

  return app;
}
