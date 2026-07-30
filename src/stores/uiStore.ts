// Shared UI state that used to be scattered across window CustomEvents —
// toolbar dock state (producer: ComponentToolbar, consumers: Toolbar/Canvas),
// the command palette open flag, and which top-level dialog (if any) is open.

import { create } from 'zustand';

export type DialogName = 'save' | 'export' | 'about' | 'help' | 'changelog' | 'settings' | 'templates';

interface UIState {
  toolbarDocked: boolean;
  setToolbarDocked: (docked: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  activeDialog: DialogName | null;
  openDialog: (name: DialogName) => void;
  closeDialog: () => void;
}

const savedDocked =
  typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('toolbar-docked') || 'false') : false;

export const useUIStore = create<UIState>((set) => ({
  toolbarDocked: savedDocked,
  setToolbarDocked: (docked) => {
    localStorage.setItem('toolbar-docked', JSON.stringify(docked));
    set({ toolbarDocked: docked });
  },

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  activeDialog: null,
  openDialog: (name) => set({ activeDialog: name }),
  closeDialog: () => set({ activeDialog: null }),
}));
