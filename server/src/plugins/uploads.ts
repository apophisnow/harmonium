import { resolve } from 'node:path';
import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { getConfig } from '../config.js';
import { LocalStorageProvider } from '../storage/local.js';
import type { StorageProvider } from '../storage/local.js';

declare module 'fastify' {
  interface FastifyInstance {
    storage: StorageProvider;
  }
}

export default fp(async (app) => {
  const config = getConfig();
  const uploadDir = resolve(config.UPLOAD_DIR);

  // Register multipart support for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_UPLOAD_SIZE,
    },
  });

  // Register static file serving for /uploads/*
  await app.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Create and decorate storage provider
  const storage = new LocalStorageProvider(uploadDir);
  app.decorate('storage', storage);
}, { name: 'uploads' });
