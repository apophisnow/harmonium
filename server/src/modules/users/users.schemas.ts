import { z } from 'zod';
import { safeLine, safeText, snowflakeId } from '../../utils/validation.js';

export const updateUserSchema = z.object({
  username: safeLine(
    z
      .string()
      .min(2, 'Username must be at least 2 characters')
      .max(32, 'Username must be at most 32 characters'),
  )
    .pipe(
      z.string().regex(/^[a-zA-Z0-9_]+$/, 'Username must be alphanumeric with underscores only'),
    )
    .optional(),
  aboutMe: safeText(z.string().max(2000, 'About me must be at most 2000 characters')).nullable().optional(),
  customStatus: safeLine(z.string().max(128, 'Custom status must be at most 128 characters')).nullable().optional(),
});

export const userParamsSchema = z.object({
  userId: snowflakeId,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
