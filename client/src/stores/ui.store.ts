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
  activeModal: ModalType;

  toggleMemberSidebar: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  openModal: (modal: NonNullable<ModalType>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  showMemberSidebar: true,
  showMobileSidebar: false,
  activeModal: null,

  toggleMemberSidebar: () => {
    set({ showMemberSidebar: !get().showMemberSidebar });
  },

  toggleMobileSidebar: () => {
    set({ showMobileSidebar: !get().showMobileSidebar });
  },

  closeMobileSidebar: () => {
    set({ showMobileSidebar: false });
  },

  openModal: (modal) => {
    set({ activeModal: modal });
  },

  closeModal: () => {
    set({ activeModal: null });
  },
}));
