import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { hashPassword, verifyPassword } from './password.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../../utils/errors.js';
import { sendVerificationEmail } from '../email/email.service.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

function generateDiscriminator(): string {
  const num = Math.floor(Math.random() * 9999) + 1; // 1 to 9999
  return num.toString().padStart(4, '0');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function userToResponse(user: typeof schema.users.$inferSelect) {
  return {
    id: user.id.toString(),
    username: user.username,
    discriminator: user.discriminator,
    email: user.email,
    avatarUrl: user.avatarUrl,
    aboutMe: user.aboutMe,
    status: user.status,
    customStatus: user.customStatus,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function generateTokenPair(
  app: FastifyInstance,
  user: { id: bigint; username: string }
) {
  const accessToken = app.jwt.sign(
    { userId: user.id.toString(), username: user.username },
    { expiresIn: '15m' }
  );

  const refreshToken = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(refreshToken);

  const db = getDb();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(schema.refreshTokens).values({
    id: generateId(),
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
}

async function createVerificationToken(userId: bigint): Promise<string> {
  const db = getDb();
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(schema.emailVerificationTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function register(_app: FastifyInstance, input: RegisterInput) {
  const db = getDb();

  // Check email uniqueness
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (existing) {
    throw new ConflictError('Email already in use');
  }

  const passwordHash = await hashPassword(input.password);
  const discriminator = generateDiscriminator();
  const id = generateId();

  const [user] = await db.insert(schema.users).values({
    id,
    username: input.username,
    discriminator,
    email: input.email,
    passwordHash,
  }).returning();

  // Generate verification token and send email
  const token = await createVerificationToken(user.id);
  await sendVerificationEmail(input.email, token);

  return {
    message: 'Verification email sent. Please check your inbox.',
    email: input.email,
  };
}

export async function login(app: FastifyInstance, input: LoginInput) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, input.email),
  });

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (!user.emailVerified) {
    throw new ValidationError('Please verify your email before logging in');
  }

  const { accessToken, refreshToken } = await generateTokenPair(app, user);

  return {
    user: userToResponse(user),
    accessToken,
    refreshToken,
  };
}

export async function verifyEmail(app: FastifyInstance, token: string) {
  const db = getDb();
  const tokenHash = hashToken(token);

  const storedToken = await db.query.emailVerificationTokens.findFirst({
    where: eq(schema.emailVerificationTokens.tokenHash, tokenHash),
  });

  if (!storedToken) {
    throw new ValidationError('Invalid or expired verification link');
  }

  if (storedToken.expiresAt < new Date()) {
    // Clean up expired token
    await db
      .delete(schema.emailVerificationTokens)
      .where(eq(schema.emailVerificationTokens.id, storedToken.id));
    throw new ValidationError('Verification link has expired. Please request a new one.');
  }

  // Mark user as verified
  await db
    .update(schema.users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(schema.users.id, storedToken.userId));

  // Delete all verification tokens for this user
  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, storedToken.userId));

  // Find the user and generate tokens (log them in)
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, storedToken.userId),
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  const { accessToken, refreshToken } = await generateTokenPair(app, user);

  return {
    user: userToResponse(user),
    accessToken,
    refreshToken,
  };
}

export async function resendVerification(email: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.email, email),
      eq(schema.users.emailVerified, false),
    ),
  });

  if (!user) {
    // Return success even if not found to prevent email enumeration
    return { message: 'If an unverified account exists with that email, a new verification link has been sent.' };
  }

  // Delete old verification tokens for this user
  await db
    .delete(schema.emailVerificationTokens)
    .where(eq(schema.emailVerificationTokens.userId, user.id));

  // Generate new token and send email
  const token = await createVerificationToken(user.id);
  await sendVerificationEmail(email, token);

  return { message: 'If an unverified account exists with that email, a new verification link has been sent.' };
}

export async function refresh(app: FastifyInstance, refreshToken: string) {
  const db = getDb();
  const tokenHash = hashToken(refreshToken);

  const storedToken = await db.query.refreshTokens.findFirst({
    where: and(
      eq(schema.refreshTokens.tokenHash, tokenHash),
      eq(schema.refreshTokens.revoked, false),
    ),
  });

  if (!storedToken) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token expired');
  }

  // Revoke old token (rotation)
  await db
    .update(schema.refreshTokens)
    .set({ revoked: true })
    .where(eq(schema.refreshTokens.id, storedToken.id));

  // Find the user
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, storedToken.userId),
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Generate new token pair
  const tokens = await generateTokenPair(app, user);

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function logout(refreshToken: string) {
  const db = getDb();
  const tokenHash = hashToken(refreshToken);

  await db
    .update(schema.refreshTokens)
    .set({ revoked: true })
    .where(eq(schema.refreshTokens.tokenHash, tokenHash));
}

export async function getCurrentUser(userId: string) {
  const db = getDb();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, BigInt(userId)),
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  return userToResponse(user);
}
