import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from '../toast.store.js';

describe('useToastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addToast creates a toast with incrementing id', () => {
    useToastStore.getState().addToast('success', 'First toast');
    useToastStore.getState().addToast('error', 'Second toast');

    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(2);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].message).toBe('First toast');
    expect(toasts[1].type).toBe('error');
    expect(toasts[1].message).toBe('Second toast');
    // IDs should be different and follow the toast-N pattern
    expect(toasts[0].id).toMatch(/^toast-\d+$/);
    expect(toasts[1].id).toMatch(/^toast-\d+$/);
    expect(toasts[0].id).not.toBe(toasts[1].id);
  });

  it('removeToast removes a toast by id', () => {
    useToastStore.getState().addToast('info', 'Toast to keep');
    useToastStore.getState().addToast('warning', 'Toast to remove');

    const toasts = useToastStore.getState().toasts;
    const idToRemove = toasts[1].id;

    useToastStore.getState().removeToast(idToRemove);

    const remaining = useToastStore.getState().toasts;
    expect(remaining.length).toBe(1);
    expect(remaining[0].message).toBe('Toast to keep');
  });

  it('auto-removes toast after duration via setTimeout', () => {
    useToastStore.getState().addToast('success', 'Auto-remove me', 3000);

    expect(useToastStore.getState().toasts.length).toBe(1);

    vi.advanceTimersByTime(2999);
    expect(useToastStore.getState().toasts.length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('uses default duration of 5000ms', () => {
    useToastStore.getState().addToast('info', 'Default duration');

    expect(useToastStore.getState().toasts.length).toBe(1);

    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().toasts.length).toBe(1);

    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts.length).toBe(0);
  });
});
