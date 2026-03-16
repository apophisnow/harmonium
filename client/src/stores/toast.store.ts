import { create } from 'zustand';
import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  /** @deprecated kept for compat — toasts are now managed by Sonner */
  toasts: Toast[];

  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>(() => ({
  toasts: [],

  addToast: (type, message, duration = 5000) => {
    const opts = { duration };
    switch (type) {
      case 'success': toast.success(message, opts); break;
      case 'error':   toast.error(message, opts);   break;
      case 'warning': toast.warning(message, opts); break;
      case 'info':    toast.info(message, opts);     break;
    }
  },

  removeToast: () => {
    // No-op — Sonner manages its own dismissals
  },
}));
