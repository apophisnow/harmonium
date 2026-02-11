import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { safeText, safeLine, snowflakeId, isValidSnowflake } from '../validation.js';

describe('safeText', () => {
  const schema = safeText(z.string().max(100));

  it('passes through normal text', () => {
    expect(schema.parse('Hello, world!')).toBe('Hello, world!');
  });

  it('preserves newlines and tabs', () => {
    expect(schema.parse('line1\nline2\ttab')).toBe('line1\nline2\ttab');
  });

  it('strips null bytes', () => {
    expect(schema.parse('hello\x00world')).toBe('helloworld');
  });

  it('strips backspace characters', () => {
    expect(schema.parse('hello\x08world')).toBe('helloworld');
  });

  it('strips escape characters', () => {
    expect(schema.parse('hello\x1Bworld')).toBe('helloworld');
  });

  it('strips form feed and vertical tab', () => {
    expect(schema.parse('a\x0Bb\x0Cc')).toBe('abc');
  });

  it('strips DEL character (0x7F)', () => {
    expect(schema.parse('hello\x7Fworld')).toBe('helloworld');
  });

  it('trims leading and trailing whitespace', () => {
    expect(schema.parse('  hello  ')).toBe('hello');
  });

  it('strips control chars and trims in combination', () => {
    expect(schema.parse('  \x00hello\x08  ')).toBe('hello');
  });

  it('preserves unicode text', () => {
    expect(schema.parse('こんにちは 🎉')).toBe('こんにちは 🎉');
  });
});

describe('safeLine', () => {
  const schema = safeLine(z.string().max(100));

  it('passes through normal text', () => {
    expect(schema.parse('Hello, world!')).toBe('Hello, world!');
  });

  it('strips newlines', () => {
    expect(schema.parse('line1\nline2')).toBe('line1line2');
  });

  it('strips carriage returns', () => {
    expect(schema.parse('line1\rline2')).toBe('line1line2');
  });

  it('strips tabs', () => {
    expect(schema.parse('col1\tcol2')).toBe('col1col2');
  });

  it('strips all control characters', () => {
    expect(schema.parse('\x00\x01\x1F\x7F')).toBe('');
  });

  it('trims whitespace', () => {
    expect(schema.parse('  hello  ')).toBe('hello');
  });

  it('preserves unicode text', () => {
    expect(schema.parse('café résumé')).toBe('café résumé');
  });
});

describe('snowflakeId', () => {
  it('accepts valid numeric strings', () => {
    expect(snowflakeId.parse('123456789012345678')).toBe('123456789012345678');
  });

  it('accepts single digit', () => {
    expect(snowflakeId.parse('0')).toBe('0');
  });

  it('rejects empty string', () => {
    expect(() => snowflakeId.parse('')).toThrow();
  });

  it('rejects non-numeric strings', () => {
    expect(() => snowflakeId.parse('abc')).toThrow();
  });

  it('rejects strings with spaces', () => {
    expect(() => snowflakeId.parse('123 456')).toThrow();
  });

  it('rejects strings with special characters', () => {
    expect(() => snowflakeId.parse('123-456')).toThrow();
  });

  it('rejects strings with leading letters', () => {
    expect(() => snowflakeId.parse('a123')).toThrow();
  });
});

describe('isValidSnowflake', () => {
  it('returns true for valid numeric strings', () => {
    expect(isValidSnowflake('123456789012345678')).toBe(true);
  });

  it('returns false for non-string values', () => {
    expect(isValidSnowflake(123)).toBe(false);
    expect(isValidSnowflake(null)).toBe(false);
    expect(isValidSnowflake(undefined)).toBe(false);
  });

  it('returns false for non-numeric strings', () => {
    expect(isValidSnowflake('abc')).toBe(false);
    expect(isValidSnowflake('')).toBe(false);
  });
});
