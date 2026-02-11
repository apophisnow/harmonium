import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../ui.store.js';

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      showMemberSidebar: true,
      showMobileSidebar: false,
      activeModal: null,
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.showMemberSidebar).toBe(true);
    expect(state.showMobileSidebar).toBe(false);
    expect(state.activeModal).toBeNull();
  });

  it('toggleMemberSidebar toggles the member sidebar visibility', () => {
    useUIStore.getState().toggleMemberSidebar();
    expect(useUIStore.getState().showMemberSidebar).toBe(false);

    useUIStore.getState().toggleMemberSidebar();
    expect(useUIStore.getState().showMemberSidebar).toBe(true);
  });

  it('toggleMobileSidebar toggles the mobile sidebar visibility', () => {
    useUIStore.getState().toggleMobileSidebar();
    expect(useUIStore.getState().showMobileSidebar).toBe(true);

    useUIStore.getState().toggleMobileSidebar();
    expect(useUIStore.getState().showMobileSidebar).toBe(false);
  });

  it('closeMobileSidebar sets showMobileSidebar to false', () => {
    useUIStore.setState({ showMobileSidebar: true });
    useUIStore.getState().closeMobileSidebar();
    expect(useUIStore.getState().showMobileSidebar).toBe(false);
  });

  it('openModal sets the active modal', () => {
    useUIStore.getState().openModal('createServer');
    expect(useUIStore.getState().activeModal).toBe('createServer');

    useUIStore.getState().openModal('invite');
    expect(useUIStore.getState().activeModal).toBe('invite');
  });

  it('closeModal sets activeModal to null', () => {
    useUIStore.setState({ activeModal: 'editProfile' });
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
