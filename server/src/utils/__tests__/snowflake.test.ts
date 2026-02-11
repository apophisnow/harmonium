import { describe, it, expect } from 'vitest';
import { generateId, snowflakeToTimestamp } from '../snowflake.js';

describe('snowflake', () => {
  describe('generateId', () => {
    it('returns a bigint', () => {
      const id = generateId();
      expect(typeof id).toBe('bigint');
    });

    it('returns different IDs for consecutive calls', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('returns monotonically increasing IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();
      expect(id2).toBeGreaterThan(id1);
      expect(id3).toBeGreaterThan(id2);
    });

    it('generates positive IDs', () => {
      const id = generateId();
      expect(id).toBeGreaterThan(0n);
    });

    it('generates unique IDs when called rapidly', () => {
      const ids = new Set<bigint>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(1000);
    });
  });

  describe('snowflakeToTimestamp', () => {
    it('returns a Date object', () => {
      const id = generateId();
      const date = snowflakeToTimestamp(id);
      expect(date).toBeInstanceOf(Date);
    });

    it('extracts a reasonable timestamp (within last few seconds)', () => {
      const id = generateId();
      const date = snowflakeToTimestamp(id);
      const now = Date.now();
      const diff = Math.abs(now - date.getTime());
      // Should be within 5 seconds
      expect(diff).toBeLessThan(5000);
    });

    it('round-trip: snowflakeToTimestamp(generateId()) is close to Date.now()', () => {
      const before = Date.now();
      const id = generateId();
      const after = Date.now();
      const extracted = snowflakeToTimestamp(id).getTime();

      expect(extracted).toBeGreaterThanOrEqual(before);
      expect(extracted).toBeLessThanOrEqual(after);
    });
  });
});
