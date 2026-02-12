import { useEffect, useState, type ReactNode } from 'react';
import { useToastStore, type Toast as ToastType, type ToastType as ToastVariant } from '../../stores/toast.store.js';

const iconsByType: Record<ToastVariant, ReactNode> = {
  success: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const colorsByType: Record<ToastVariant, string> = {
  success: 'border-th-green text-th-green',
  error: 'border-th-red text-th-red',
  warning: 'border-th-yellow text-th-yellow',
  info: 'border-th-brand text-th-brand',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const timer = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border-l-4 bg-th-bg-secondary px-4 py-3 shadow-lg transition-all duration-200 ${
        colorsByType[toast.type]
      } ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="flex-shrink-0">{iconsByType[toast.type]}</div>
      <p className="flex-1 text-sm text-th-text-primary">{toast.message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-th-text-secondary transition-colors hover:text-th-text-primary"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-0 top-0 z-50 flex flex-col gap-2 p-4">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-80">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
