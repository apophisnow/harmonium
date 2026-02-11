import { z } from 'zod';
import { safeLine } from '../../utils/validation.js';

export const registerSchema = z.object({
  username: safeLine(
    z
      .string()
      .min(2, 'Username must be at least 2 characters')
      .max(32, 'Username must be at most 32 characters'),
  ).pipe(
    z.string().regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores only'),
  ),
  email: safeLine(z.string().email('Invalid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export const loginSchema = z.object({
  email: safeLine(z.string().email('Invalid email address')),
  password: z.string(),
});

export const refreshSchema = z.object({
  refreshToken: z.string(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
