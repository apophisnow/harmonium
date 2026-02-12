import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../../stores/ui.store.js';
import { UserSettingsSidebar } from './UserSettingsSidebar.js';
import type { UserSettingsTab } from './UserSettingsSidebar.js';
import { MyAccountTab } from './MyAccountTab.js';
import { AppearanceTab } from './AppearanceTab.js';

export function UserSettingsLayout() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const isOpen = activeModal === 'userSettings';
  const [activeTab, setActiveTab] = useState<UserSettingsTab>('account');

  const handleClose = useCallback(() => {
    closeModal();
  }, [closeModal]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleEscape]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('account');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      {/* Left half - sidebar background */}
      <div className="flex flex-1 justify-end bg-th-bg-secondary">
        <div className="w-[220px] overflow-y-auto px-2 py-[60px]">
          <UserSettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Right half - content */}
      <div className="flex flex-[1.5] bg-th-bg-primary">
        <div className="w-[740px] max-w-full overflow-y-auto px-10 py-[60px]">
          {activeTab === 'account' && <MyAccountTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
        </div>

        {/* ESC close button */}
        <div className="py-[60px] px-4">
          <button
            onClick={handleClose}
            className="group flex flex-col items-center gap-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-th-text-muted text-th-text-muted transition-colors group-hover:border-th-text-primary group-hover:text-th-text-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-th-text-muted group-hover:text-th-text-primary">
              ESC
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
