import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../utils/errors.js';
import {
  joinSchema,
  connectTransportSchema,
  produceSchema,
  consumeSchema,
  leaveSchema,
  serverParamsSchema,
} from './voice.schemas.js';
import * as voiceService from './voice.service.js';

export async function voiceRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/voice/join - Join a voice channel
  app.post('/api/voice/join', async (request, reply) => {
    const bodyParsed = joinSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const result = await voiceService.joinVoice(
      request.user.userId,
      bodyParsed.data.channelId,
    );

    return reply.send(result);
  });

  // POST /api/voice/connect-transport - Connect a WebRTC transport
  app.post('/api/voice/connect-transport', async (request, reply) => {
    const bodyParsed = connectTransportSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    await voiceService.connectTransport(
      request.user.userId,
      bodyParsed.data.channelId,
      bodyParsed.data.transportId,
      bodyParsed.data.dtlsParameters as Parameters<typeof voiceService.connectTransport>[3],
    );

    return reply.send({ ok: true });
  });

  // POST /api/voice/produce - Start producing audio/video
  app.post('/api/voice/produce', async (request, reply) => {
    const bodyParsed = produceSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const result = await voiceService.produce(
      request.user.userId,
      bodyParsed.data.channelId,
      bodyParsed.data.transportId,
      bodyParsed.data.kind,
      bodyParsed.data.rtpParameters as Parameters<typeof voiceService.produce>[4],
      bodyParsed.data.producerType,
    );

    return reply.send(result);
  });

  // POST /api/voice/consume - Start consuming a producer
  app.post('/api/voice/consume', async (request, reply) => {
    const bodyParsed = consumeSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const result = await voiceService.consume(
      request.user.userId,
      bodyParsed.data.channelId,
      bodyParsed.data.producerId,
      bodyParsed.data.rtpCapabilities as Parameters<typeof voiceService.consume>[3],
    );

    return reply.send(result);
  });

  // POST /api/voice/leave - Leave a voice channel
  app.post('/api/voice/leave', async (request, reply) => {
    const bodyParsed = leaveSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    await voiceService.leaveVoice(request.user.userId);

    return reply.status(204).send();
  });

  // POST /api/voice/stop-screen-share - Stop screen sharing
  app.post('/api/voice/stop-screen-share', async (request, reply) => {
    await voiceService.stopScreenShare(request.user.userId);
    return reply.send({ ok: true });
  });

  // GET /api/voice/state/:serverId - Get voice states for a server
  app.get('/api/voice/state/:serverId', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const states = await voiceService.getVoiceStates(paramsParsed.data.serverId);

    return reply.send(states);
  });
}
