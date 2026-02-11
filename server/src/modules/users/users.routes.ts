import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { changePasswordSchema, updateUserSchema, userParamsSchema } from './users.schemas.js';
import * as usersService from './users.service.js';
import { ValidationError } from '../../utils/errors.js';

export async function userRoutes(app: FastifyInstance) {
  // All routes in this plugin require authentication
  app.addHook('preHandler', app.authenticate);

  // GET /api/users/@me - Get current user
  app.get('/api/users/@me', async (request, reply) => {
    const user = await usersService.getCurrentUser(request.user.userId);
    return reply.send(user);
  });

  // PATCH /api/users/@me - Update profile
  app.patch('/api/users/@me', async (request, reply) => {
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    const user = await usersService.updateUser(request.user.userId, parsed.data);
    return reply.send(user);
  });

  // POST /api/users/@me/password - Change password
  app.post('/api/users/@me/password', async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0].message);
    }

    await usersService.changePassword(
      request.user.userId,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );
    return reply.status(204).send();
  });

  // PUT /api/users/@me/avatar - Upload avatar
  app.put('/api/users/@me/avatar', async (request, reply) => {
    const file = await request.file();

    if (!file) {
      throw new ValidationError('No file uploaded');
    }

    // Validate MIME type - must be an image
    if (!file.mimetype.startsWith('image/')) {
      throw new ValidationError('File must be an image (image/* content type)');
    }

    // Read file data into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Check if the file was truncated (exceeded size limit)
    if (file.file.truncated) {
      throw new ValidationError('File too large. Maximum size is 8MB');
    }

    // Validate max 8MB for avatars specifically
    const MAX_AVATAR_SIZE = 8 * 1024 * 1024; // 8MB
    if (fileBuffer.length > MAX_AVATAR_SIZE) {
      throw new ValidationError('File too large. Maximum size is 8MB');
    }

    // Resize to 256x256 and convert to WebP
    const processedImage = await sharp(fileBuffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    const userId = request.user.userId;
    const avatarPath = `avatars/${userId}.webp`;

    // Delete old avatar if exists
    const oldUser = await usersService.getCurrentUser(userId);
    if (oldUser.avatarUrl) {
      // Extract relative path from URL (remove /uploads/ prefix)
      const oldRelativePath = oldUser.avatarUrl.replace(/^\/uploads\//, '');
      await app.storage.delete(oldRelativePath);
    }

    // Save new avatar
    const avatarUrl = await app.storage.save(avatarPath, processedImage, 'image/webp');

    // Update user record in DB
    const updatedUser = await usersService.updateUserAvatar(userId, avatarUrl);
    return reply.send(updatedUser);
  });

  // GET /api/users/:userId - Get public user profile
  app.get('/api/users/:userId', async (request, reply) => {
    const paramsParsed = userParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      throw new ValidationError(paramsParsed.error.errors[0].message);
    }

    const user = await usersService.getUserById(paramsParsed.data.userId);
    return reply.send(user);
  });
}
