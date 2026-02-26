import type { FastifyInstance } from 'fastify';
import { Permission } from '@harmonium/shared';
import { requireChannelPermission } from '../../utils/permissions.js';
import { ValidationError } from '../../utils/errors.js';
import {
  createMessageSchema,
  updateMessageSchema,
  messagesQuerySchema,
  channelParamsSchema,
  messageParamsSchema,
} from './messages.schemas.js';
import * as messagesService from './messages.service.js';
import type { AttachmentInput } from './messages.service.js';

export async function messageRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate);

  // POST /api/channels/:channelId/messages - Send a message
  app.post(
    '/api/channels/:channelId/messages',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '5 seconds',
        },
      },
      preHandler: [
        requireChannelPermission(Permission.READ_MESSAGES),
        requireChannelPermission(Permission.SEND_MESSAGES),
      ],
    },
    async (request, reply) => {
      const paramsParsed = channelParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      let content: string | undefined;
      let replyToId: string | undefined;
      const files: AttachmentInput[] = [];

      // Check if the request is multipart
      if (request.isMultipart()) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'field') {
            if (part.fieldname === 'content' && typeof part.value === 'string') {
              content = part.value;
            } else if (part.fieldname === 'replyToId' && typeof part.value === 'string') {
              replyToId = part.value;
            }
          } else if (part.type === 'file') {
            const buffer = await part.toBuffer();
            files.push({
              filename: part.filename,
              buffer,
              contentType: part.mimetype,
              sizeBytes: buffer.length,
            });
          }
        }
      } else {
        // JSON body
        const bodyParsed = createMessageSchema.safeParse(request.body);
        if (!bodyParsed.success) {
          throw new ValidationError(bodyParsed.error.errors[0].message);
        }
        content = bodyParsed.data.content;
        replyToId = bodyParsed.data.replyToId;
      }

      // Validate: at least one of content or files must be present
      if (!content?.trim() && files.length === 0) {
        throw new ValidationError('Message must have content or at least one attachment');
      }

      // Validate content through schema if provided
      if (content !== undefined) {
        const contentParsed = createMessageSchema.safeParse({ content });
        if (!contentParsed.success) {
          throw new ValidationError(contentParsed.error.errors[0].message);
        }
      }

      const message = await messagesService.createMessage(
        paramsParsed.data.channelId,
        request.user.userId,
        { content, replyToId },
        files,
        app.storage,
      );

      return reply.status(201).send(message);
    },
  );

  // GET /api/channels/:channelId/messages - Get message history
  app.get(
    '/api/channels/:channelId/messages',
    {
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = channelParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const queryParsed = messagesQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        throw new ValidationError(queryParsed.error.errors[0].message);
      }

      const messages = await messagesService.getMessages(
        paramsParsed.data.channelId,
        queryParsed.data,
      );

      return reply.send(messages);
    },
  );

  // PATCH /api/channels/:channelId/messages/:messageId - Edit a message (author only)
  app.patch(
    '/api/channels/:channelId/messages/:messageId',
    {
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = messageParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      const bodyParsed = updateMessageSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        throw new ValidationError(bodyParsed.error.errors[0].message);
      }

      const message = await messagesService.updateMessage(
        paramsParsed.data.messageId,
        request.user.userId,
        bodyParsed.data,
      );

      return reply.send(message);
    },
  );

  // DELETE /api/channels/:channelId/messages/:messageId - Delete a message (author or MANAGE_MESSAGES)
  app.delete(
    '/api/channels/:channelId/messages/:messageId',
    {
      preHandler: [requireChannelPermission(Permission.READ_MESSAGES)],
    },
    async (request, reply) => {
      const paramsParsed = messageParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        throw new ValidationError(paramsParsed.error.errors[0].message);
      }

      await messagesService.deleteMessage(
        paramsParsed.data.messageId,
        paramsParsed.data.channelId,
        request.user.userId,
      );

      return reply.status(204).send();
    },
  );
}
