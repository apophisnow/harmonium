import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MEDIASOUP_ANNOUNCED_IP: z.string().default('127.0.0.1'),
  MEDIASOUP_PREFER_TCP: z.coerce.boolean().default(false),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_SIZE: z.coerce.number().default(10_485_760), // 10MB
  DEFAULT_THEME: z.string().default('harmonium'),
  DEFAULT_MODE: z.string().default('dark'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@harmonium.app'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config;

export function getConfig(): Config {
  if (!config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
      process.exit(1);
    }
    config = result.data;
  }
  return config;
}
