import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToastStore } from '../toast.store.js';

// Mock Sonner's toast module
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

describe('useToastStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addToast delegates to Sonner toast.success', () => {
    useToastStore.getState().addToast('success', 'Well done!');
    expect(toast.success).toHaveBeenCalledWith('Well done!', { duration: 5000 });
  });

  it('addToast delegates to Sonner toast.error', () => {
    useToastStore.getState().addToast('error', 'Something broke');
    expect(toast.error).toHaveBeenCalledWith('Something broke', { duration: 5000 });
  });

  it('addToast delegates to Sonner toast.warning', () => {
    useToastStore.getState().addToast('warning', 'Watch out', 3000);
    expect(toast.warning).toHaveBeenCalledWith('Watch out', { duration: 3000 });
  });

  it('addToast delegates to Sonner toast.info', () => {
    useToastStore.getState().addToast('info', 'FYI', 7000);
    expect(toast.info).toHaveBeenCalledWith('FYI', { duration: 7000 });
  });

  it('addToast uses default duration of 5000ms', () => {
    useToastStore.getState().addToast('success', 'Default');
    expect(toast.success).toHaveBeenCalledWith('Default', { duration: 5000 });
  });

  it('removeToast is a no-op (Sonner manages dismissals)', () => {
    // Should not throw
    useToastStore.getState().removeToast('any-id');
  });
});
