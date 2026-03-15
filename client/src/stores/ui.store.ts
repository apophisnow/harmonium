import { create } from 'zustand';

type ModalType =
  | 'createServer'
  | 'createChannel'
  | 'invite'
  | 'editProfile'
  | 'userSettings'
  | 'serverSettings'
  | null;

interface UIState {
  showMemberSidebar: boolean;
  showMobileSidebar: boolean;
  showPinnedMessages: boolean;
  activeModal: ModalType;
  initialSettingsTab: string | null;

  toggleMemberSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  togglePinnedMessages: () => void;
  closePinnedMessages: () => void;
  openModal: (modal: NonNullable<ModalType>, options?: { settingsTab?: string }) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  showMemberSidebar: true,
  showMobileSidebar: false,
  showPinnedMessages: false,
  activeModal: null,
  initialSettingsTab: null,

  toggleMemberSidebar: () => {
    set({ showMemberSidebar: !get().showMemberSidebar });
  },

  toggleMobileSidebar: () => {
    set({ showMobileSidebar: !get().showMobileSidebar });
  },

  closeMobileSidebar: () => {
    set({ showMobileSidebar: false });
  },

  togglePinnedMessages: () => {
    set({ showPinnedMessages: !get().showPinnedMessages });
  },

  closePinnedMessages: () => {
    set({ showPinnedMessages: false });
  },

  openModal: (modal, options) => {
    set({ activeModal: modal, initialSettingsTab: options?.settingsTab ?? null });
  },

  closeModal: () => {
    set({ activeModal: null, initialSettingsTab: null });
  },
}));
