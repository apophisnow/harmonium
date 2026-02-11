import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictError, UnauthorizedError } from '../../../utils/errors.js';

// Use vi.hoisted to define mock functions that will be available during vi.mock hoisting
const {
  mockHashPassword,
  mockVerifyPassword,
  mockGenerateId,
  mockReturning,
  mockValues,
  mockInsertFn,
  mockWhere,
  mockSet,
  mockUpdate,
  mockDb,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsertFn = vi.fn(() => ({ values: mockValues }));
  const mockWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));

  const mockDb = {
    query: {
      users: { findFirst: vi.fn() },
      refreshTokens: { findFirst: vi.fn() },
    },
    insert: mockInsertFn,
    update: mockUpdate,
  };

  return {
    mockHashPassword: vi.fn(async () => 'hashed_password'),
    mockVerifyPassword: vi.fn(async () => true),
    mockGenerateId: vi.fn(() => 12345n),
    mockReturning,
    mockValues,
    mockInsertFn,
    mockWhere,
    mockSet,
    mockUpdate,
    mockDb,
  };
});

// Mock drizzle-orm
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => args),
}));

// Mock DB
vi.mock('../../../db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    users: { id: 'users.id', email: 'users.email' },
    refreshTokens: {
      id: 'refreshTokens.id',
      tokenHash: 'refreshTokens.tokenHash',
      revoked: 'refreshTokens.revoked',
    },
  },
}));

// Mock snowflake
vi.mock('../../../utils/snowflake.js', () => ({
  generateId: mockGenerateId,
}));

// Mock password utilities
vi.mock('../password.js', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));

import { register, login, refresh, logout, getCurrentUser } from '../auth.service.js';
import { generateId } from '../../../utils/snowflake.js';

// Helper to create a mock user row as returned from DB
function createMockUser(overrides: any = {}) {
  return {
    id: 12345n,
    username: 'testuser',
    discriminator: '0001',
    email: 'test@example.com',
    passwordHash: 'hashed_password',
    avatarUrl: null,
    aboutMe: null,
    status: 'offline',
    customStatus: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

const mockApp = {
  jwt: {
    sign: vi.fn(() => 'mock_access_token'),
  },
} as any;

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: insert().values().returning() returns a mock user for register flow
    mockReturning.mockResolvedValue([createMockUser()]);

    // Default: insert for refresh token generation succeeds
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsertFn.mockReturnValue({ values: mockValues });

    // Default: update succeeds
    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    // Reset password mocks to defaults
    mockHashPassword.mockResolvedValue('hashed_password');
    mockVerifyPassword.mockResolvedValue(true);

    // Reset JWT sign mock
    mockApp.jwt.sign.mockReturnValue('mock_access_token');
  });

  describe('register', () => {
    it('returns user and tokens for valid input', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(undefined); // no existing user

      const result = await register(mockApp, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.username).toBe('testuser');
      expect(result.accessToken).toBe('mock_access_token');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('throws ConflictError if email already exists', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());

      await expect(
        register(mockApp, {
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('calls hashPassword with the input password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(undefined);

      await register(mockApp, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'mySecurePass',
      });

      expect(mockHashPassword).toHaveBeenCalledWith('mySecurePass');
    });

    it('generates a snowflake ID', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(undefined);

      await register(mockApp, {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(generateId).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns user and tokens for valid credentials', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());
      mockVerifyPassword.mockResolvedValue(true);

      const result = await login(mockApp, {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws UnauthorizedError for non-existent email', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(undefined);

      await expect(
        login(mockApp, { email: 'nonexistent@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());
      mockVerifyPassword.mockResolvedValue(false);

      await expect(
        login(mockApp, { email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refresh', () => {
    it('returns new tokens for valid refresh token', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 1n,
        userId: 12345n,
        tokenHash: 'some_hash',
        expiresAt: futureDate,
        revoked: false,
      });
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());

      const result = await refresh(mockApp, 'valid_refresh_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).toBe('mock_access_token');
    });

    it('throws UnauthorizedError for invalid token (not found)', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue(undefined);

      await expect(refresh(mockApp, 'invalid_token')).rejects.toThrow(UnauthorizedError);
      await expect(refresh(mockApp, 'invalid_token')).rejects.toThrow('Invalid refresh token');
    });

    it('throws UnauthorizedError for expired token', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 1n,
        userId: 12345n,
        tokenHash: 'some_hash',
        expiresAt: pastDate,
        revoked: false,
      });

      await expect(refresh(mockApp, 'expired_token')).rejects.toThrow(UnauthorizedError);
      await expect(refresh(mockApp, 'expired_token')).rejects.toThrow('Refresh token expired');
    });

    it('revokes old token (rotation)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 1n,
        userId: 12345n,
        tokenHash: 'some_hash',
        expiresAt: futureDate,
        revoked: false,
      });
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());

      await refresh(mockApp, 'valid_refresh_token');

      // Verify update was called to revoke old token
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ revoked: true });
    });
  });

  describe('logout', () => {
    it('marks token as revoked', async () => {
      await logout('some_refresh_token');

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ revoked: true });
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('returns user response for valid userId', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(createMockUser());

      const result = await getCurrentUser('12345');

      expect(result).toHaveProperty('id', '12345');
      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('discriminator', '0001');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      // Should not include passwordHash
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('throws UnauthorizedError if user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(undefined);

      await expect(getCurrentUser('99999')).rejects.toThrow(UnauthorizedError);
      await expect(getCurrentUser('99999')).rejects.toThrow('User not found');
    });
  });
});
