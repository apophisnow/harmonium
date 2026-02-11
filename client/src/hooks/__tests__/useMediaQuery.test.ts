import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile, useIsTablet } from '../useMediaQuery.js';

function createMatchMedia(matches: boolean) {
  const listeners: Array<(e: any) => void> = [];
  const mql = {
    matches,
    media: '',
    addEventListener: vi.fn((event: string, fn: any) => {
      listeners.push(fn);
    }),
    removeEventListener: vi.fn((event: string, fn: any) => {
      const idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    _listeners: listeners,
    _trigger(newMatches: boolean) {
      mql.matches = newMatches;
      for (const fn of listeners) fn({ matches: newMatches });
    },
  };
  return mql;
}

describe('useMediaQuery', () => {
  let mockMql: ReturnType<typeof createMatchMedia>;

  beforeEach(() => {
    mockMql = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mockMql));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when matchMedia matches', () => {
    mockMql = createMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mockMql));

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when matchMedia does not match', () => {
    mockMql = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mockMql));

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('responds to change events', () => {
    mockMql = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mockMql));

    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      mockMql._trigger(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      mockMql._trigger(false);
    });
    expect(result.current).toBe(false);
  });

  it('useIsMobile uses correct breakpoint query (max-width: 768px)', () => {
    const matchMediaSpy = vi.fn(() => mockMql);
    vi.stubGlobal('matchMedia', matchMediaSpy);

    renderHook(() => useIsMobile());

    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 768px)');
  });

  it('useIsTablet uses correct breakpoint query (max-width: 1024px)', () => {
    const matchMediaSpy = vi.fn(() => mockMql);
    vi.stubGlobal('matchMedia', matchMediaSpy);

    renderHook(() => useIsTablet());

    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 1024px)');
  });
});
