import { StateCreator } from 'zustand';

export interface UISlice {
  isRightDrawerOpen: boolean;
  searchQuery: string;
  isNewChatOpen: boolean;
  isNewGroupOpen: boolean;
  isPersonaModalOpen: boolean;
  isMobileSidebarOpen: boolean;
  isAndroidModalOpen: boolean;

  toggleRightDrawer: () => void;
  toggleMobileSidebar: () => void;
  setSearchQuery: (query: string) => void;
  setNewChatOpen: (open: boolean) => void;
  setNewGroupOpen: (open: boolean) => void;
  setPersonaModalOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setAndroidModalOpen: (open: boolean) => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  isRightDrawerOpen: false,
  searchQuery: '',
  isNewChatOpen: false,
  isNewGroupOpen: false,
  isPersonaModalOpen: false,
  isMobileSidebarOpen: false,
  isAndroidModalOpen: false,

  toggleRightDrawer: () => set((state) => ({ isRightDrawerOpen: !state.isRightDrawerOpen })),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setNewChatOpen: (open) => set({ isNewChatOpen: open }),
  setNewGroupOpen: (open) => set({ isNewGroupOpen: open }),
  setPersonaModalOpen: (open) => set({ isPersonaModalOpen: open }),
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  setAndroidModalOpen: (open) => set({ isAndroidModalOpen: open }),
});
