import type { FastifyInstance } from 'fastify';
import {
  serverParamsSchema,
  emojiParamsSchema,
  createEmojiSchema,
  renameEmojiSchema,
} from './emojis.schemas.js';
import * as emojisService from './emojis.service.js';
import { ValidationError } from '../../utils/errors.js';
import { Permission } from '@harmonium/shared';
import { requirePermission } from '../../utils/permissions.js';

const ALLOWED_MIME_TYPES = ['image/png', 'image/gif', 'image/webp'];
const MAX_EMOJI_SIZE = 256 * 1024; // 256KB

/**
 * Emoji routes: /api/servers/:serverId/emojis
 * All routes require authentication.
 * Create/delete/rename require MANAGE_SERVER permission.
 */
export async function emojiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  // GET /api/servers/:serverId/emojis - List server emojis
  app.get('/api/servers/:serverId/emojis', async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const emojis = await emojisService.getServerEmojis(paramsParsed.data.serverId);
    return reply.send(emojis);
  });

  // GET /api/servers/:serverId/emojis/:emojiId - Get single emoji
  app.get('/api/servers/:serverId/emojis/:emojiId', async (request, reply) => {
    const paramsParsed = emojiParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const emoji = await emojisService.getEmoji(
      paramsParsed.data.serverId,
      paramsParsed.data.emojiId,
    );
    return reply.send(emoji);
  });

  // POST /api/servers/:serverId/emojis - Upload custom emoji (requires MANAGE_SERVER)
  app.post('/api/servers/:serverId/emojis', {
    preHandler: requirePermission(Permission.MANAGE_SERVER),
  }, async (request, reply) => {
    const paramsParsed = serverParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const { serverId } = paramsParsed.data;

    const file = await request.file();
    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    // Validate the name field from multipart
    const nameField = file.fields['name'];
    let nameValue: string | undefined;
    if (nameField && 'value' in nameField) {
      nameValue = nameField.value as string;
    }

    const nameParsed = createEmojiSchema.safeParse({ name: nameValue });
    if (!nameParsed.success) {
      throw new ValidationError(nameParsed.error.errors[0].message);
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new ValidationError('Emoji must be a PNG, GIF, or WebP image');
    }

    // Read file data
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Check if truncated
    if (file.file.truncated) {
      throw new ValidationError('File too large. Maximum emoji size is 256KB');
    }

    // Check size
    if (fileBuffer.length > MAX_EMOJI_SIZE) {
      throw new ValidationError('File too large. Maximum emoji size is 256KB');
    }

    const animated = file.mimetype === 'image/gif';

    // Determine file extension
    const ext = file.mimetype === 'image/gif' ? 'gif' : file.mimetype === 'image/webp' ? 'webp' : 'png';
    const emojiFileName = `emojis/${serverId}/${Date.now()}_${nameParsed.data.name}.${ext}`;

    // Save via storage provider
    const imageUrl = await app.storage.save(emojiFileName, fileBuffer, file.mimetype);

    const emoji = await emojisService.createEmoji(
      serverId,
      request.user.userId,
      nameParsed.data.name,
      imageUrl,
      animated,
    );

    return reply.status(201).send(emoji);
  });

  // PATCH /api/servers/:serverId/emojis/:emojiId - Rename emoji (requires MANAGE_SERVER)
  app.patch('/api/servers/:serverId/emojis/:emojiId', {
    preHandler: requirePermission(Permission.MANAGE_SERVER),
  }, async (request, reply) => {
    const paramsParsed = emojiParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const bodyParsed = renameEmojiSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      throw new ValidationError(bodyParsed.error.errors[0].message);
    }

    const emoji = await emojisService.renameEmoji(
      paramsParsed.data.serverId,
      paramsParsed.data.emojiId,
      bodyParsed.data.name,
    );

    return reply.send(emoji);
  });

  // DELETE /api/servers/:serverId/emojis/:emojiId - Delete emoji (requires MANAGE_SERVER)
  app.delete('/api/servers/:serverId/emojis/:emojiId', {
    preHandler: requirePermission(Permission.MANAGE_SERVER),
  }, async (request, reply) => {
    const paramsParsed = emojiParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    await emojisService.deleteEmoji(
      paramsParsed.data.serverId,
      paramsParsed.data.emojiId,
    );

    return reply.status(204).send();
  });
}
