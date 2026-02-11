import { z } from 'zod';

/**
 * Strips ASCII control characters (0x00-0x1F except \n \t, plus 0x7F DEL),
 * then trims leading/trailing whitespace. For multi-line text fields
 * (message content, aboutMe, channel topic).
 */
export function safeText(schema: z.ZodString) {
  return schema.transform((s) =>
    s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim(),
  );
}

/**
 * Strips ALL ASCII control characters (0x00-0x1F, 0x7F) including newlines,
 * then trims. For single-line fields (names, statuses, emails).
 */
export function safeLine(schema: z.ZodString) {
  return schema.transform((s) =>
    s.replace(/[\x00-\x1F\x7F]/g, '').trim(),
  );
}

/**
 * Validates that a string is a valid snowflake ID (numeric string).
 */
export const snowflakeId = z
  .string()
  .regex(/^\d+$/, 'Invalid ID format');

/**
 * Validates that a string is a numeric snowflake ID.
 * Reusable predicate for WebSocket payload validation.
 */
export function isValidSnowflake(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value);
}
