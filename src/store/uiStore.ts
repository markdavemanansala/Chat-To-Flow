/**
 * @fileoverview UI store - Manages UI state (mode, panels, selection, etc.)
 */

import { create } from 'zustand';

export type ViewMode = 'simple' | 'flow';
export type LeftTab = 'chat' | 'catalog' | 'canvas';

interface Toast {
  id: string;
  type: 'ok' | 'warn' | 'error';
  text: string;
}

interface UIStore {
  // State
  mode: ViewMode;
  leftTab: LeftTab;
  selectedNodeId?: string;
  zoom: number;
  pan: { x: number; y: number };
  toasts: Toast[];

  // Actions
  setMode: (mode: ViewMode) => void;
  setLeftTab: (tab: LeftTab) => void;
  setSelectedNodeId: (id?: string) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  mode: 'simple',
  leftTab: 'chat',
  selectedNodeId: undefined,
  zoom: 1,
  pan: { x: 0, y: 0 },
  toasts: [],

  // Actions
  setMode: (mode) => set({ mode }),
  setLeftTab: (tab) => set({ leftTab: tab }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setZoom: (zoom) => set({ zoom }),
  setPan: (pan) => set({ pan }),

  // Toast management
  addToast: (toast) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));

    // Auto-remove after 3 seconds (or 6 for errors)
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, toast.type === 'error' ? 6000 : 3000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Convenience hooks
export const useViewMode = () => useUIStore((state) => state.mode);
export const useLeftTab = () => useUIStore((state) => state.leftTab);
export const useSelectedNodeId = () => useUIStore((state) => state.selectedNodeId);
export const useZoom = () => useUIStore((state) => state.zoom);
export const usePan = () => useUIStore((state) => state.pan);
export const useToasts = () => useUIStore((state) => state.toasts);
export const useSetMode = () => useUIStore((state) => state.setMode);
export const useSetLeftTab = () => useUIStore((state) => state.setLeftTab);
export const useSetSelectedNodeId = () => useUIStore((state) => state.setSelectedNodeId);
export const useSetZoom = () => useUIStore((state) => state.setZoom);
export const useSetPan = () => useUIStore((state) => state.setPan);
export const useAddToast = () => useUIStore((state) => state.addToast);
export const useRemoveToast = () => useUIStore((state) => state.removeToast);

