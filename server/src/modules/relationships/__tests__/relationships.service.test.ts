import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationError, ForbiddenError, NotFoundError, ConflictError } from '../../../utils/errors.js';

const {
  mockFindFirst,
  mockDelete,
  mockInsert,
  mockDeleteWhere,
  mockDb,
  mockPublishToUser,
} = vi.hoisted(() => {
  const mockDeleteWhere = vi.fn();
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
  const mockValues = vi.fn();
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockFindFirst = vi.fn();
  const mockPublishToUser = vi.fn();

  const mockDb = {
    query: {
      relationships: { findFirst: mockFindFirst },
      users: { findFirst: vi.fn() },
    },
    delete: mockDelete,
    insert: mockInsert,
  };

  return {
    mockFindFirst,
    mockDelete,
    mockInsert,
    mockDeleteWhere,
    mockDb,
    mockPublishToUser,
  };
});

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: any, b: any) => ({ field: a, value: b })),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
}));

vi.mock('../../../db/index.js', () => ({
  getDb: vi.fn(() => mockDb),
  schema: {
    relationships: {
      userId: 'relationships.userId',
      targetId: 'relationships.targetId',
      type: 'relationships.type',
    },
    users: { id: 'users.id' },
  },
}));

vi.mock('../../../ws/pubsub.js', () => ({
  getPubSubManager: vi.fn(() => ({
    publishToUser: mockPublishToUser,
  })),
}));

const { ignoreUser, unignoreUser, isIgnored } = await import('../relationships.service.js');

describe('relationships.service — ignore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ignoreUser', () => {
    it('throws ValidationError when ignoring self', async () => {
      await expect(ignoreUser('123', '123')).rejects.toThrow(ValidationError);
    });

    it('throws ForbiddenError when target is blocked', async () => {
      mockFindFirst.mockResolvedValueOnce({
        userId: 123n,
        targetId: 456n,
        type: 'blocked',
      });

      await expect(ignoreUser('123', '456')).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when target is already ignored', async () => {
      // First call: block check — not blocked
      mockFindFirst.mockResolvedValueOnce(null);
      // Second call: already ignored check
      mockFindFirst.mockResolvedValueOnce({
        userId: 123n,
        targetId: 456n,
        type: 'ignored',
      });

      await expect(ignoreUser('123', '456')).rejects.toThrow(ConflictError);
    });

    it('creates an ignore relationship for users with no prior relationship', async () => {
      // Block check — not blocked
      mockFindFirst.mockResolvedValueOnce(null);
      // Already ignored check — not ignored
      mockFindFirst.mockResolvedValueOnce(null);
      // Existing relationship check — none
      mockFindFirst.mockResolvedValueOnce(null);
      // User lookup for WS event
      mockDb.query.users.findFirst.mockResolvedValueOnce({
        id: 456n,
        username: 'target',
        discriminator: '0001',
        avatarUrl: null,
        aboutMe: null,
        status: 'online',
        customStatus: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await ignoreUser('123', '456');

      expect(mockInsert).toHaveBeenCalled();
      expect(mockPublishToUser).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          op: 'RELATIONSHIP_UPDATE',
          d: expect.objectContaining({
            relationship: expect.objectContaining({ type: 'ignored' }),
          }),
        }),
      );
    });
  });

  describe('unignoreUser', () => {
    it('throws NotFoundError when not ignored', async () => {
      mockFindFirst.mockResolvedValueOnce(null);
      await expect(unignoreUser('123', '456')).rejects.toThrow(NotFoundError);
    });

    it('removes the ignore relationship', async () => {
      mockFindFirst.mockResolvedValueOnce({
        userId: 123n,
        targetId: 456n,
        type: 'ignored',
      });

      await unignoreUser('123', '456');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockPublishToUser).toHaveBeenCalledWith(
        '123',
        expect.objectContaining({
          op: 'RELATIONSHIP_REMOVE',
          d: { userId: '456' },
        }),
      );
    });
  });

  describe('isIgnored', () => {
    it('returns true when ignored relationship exists', async () => {
      mockFindFirst.mockResolvedValueOnce({
        userId: 123n,
        targetId: 456n,
        type: 'ignored',
      });

      const result = await isIgnored('123', '456');
      expect(result).toBe(true);
    });

    it('returns false when no ignored relationship', async () => {
      mockFindFirst.mockResolvedValueOnce(null);

      const result = await isIgnored('123', '456');
      expect(result).toBe(false);
    });
  });
});
