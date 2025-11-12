/**
 * @fileoverview AI store - Manages AI context and state
 */

import { create } from 'zustand';
import { debounce } from '../lib/debounce';
import { summarizeGraph } from '../workflow/summarize';
import type { Node, Edge } from 'reactflow';
import type { RfNodeData } from '../types/graph';

interface AIStore {
  // State
  currentSummary: string;
  lastAIMessage?: string;
  isThinking: boolean;

  // Actions
  setSummary: (summary: string) => void;
  setAIState: (state: { lastAIMessage?: string; isThinking?: boolean }) => void;
  updateSummaryFromGraph: (nodes: Node<RfNodeData>[], edges: Edge[]) => void;
}

// Debounced summary updater
let debouncedUpdate: ((nodes: Node<RfNodeData>[], edges: Edge[]) => void) | null = null;

export const useAIStore = create<AIStore>((set, get) => {
  // Initialize debounced updater
  if (!debouncedUpdate) {
    debouncedUpdate = debounce((nodes: Node<RfNodeData>[], edges: Edge[]) => {
      const summary = summarizeGraph(nodes, edges);
      set({ currentSummary: summary });
    }, 300);
  }

  return {
    // Initial state
    currentSummary: 'Empty workflow (no nodes)',
    lastAIMessage: undefined,
    isThinking: false,

    // Set summary directly
    setSummary: (summary: string) => {
      set({ currentSummary: summary });
    },

    // Set AI state
    setAIState: (state) => {
      set({
        lastAIMessage: state.lastAIMessage ?? get().lastAIMessage,
        isThinking: state.isThinking ?? get().isThinking,
      });
    },

    // Update summary from graph (debounced)
    updateSummaryFromGraph: (nodes, edges) => {
      if (debouncedUpdate) {
        debouncedUpdate(nodes, edges);
      }
    },
  };
});

// Convenience hooks
export const useCurrentSummary = () => useAIStore((state) => state.currentSummary);
export const useLastAIMessage = () => useAIStore((state) => state.lastAIMessage);
export const useIsThinking = () => useAIStore((state) => state.isThinking);
export const useSetSummary = () => useAIStore((state) => state.setSummary);
export const useSetAIState = () => useAIStore((state) => state.setAIState);
export const useUpdateSummaryFromGraph = () => useAIStore((state) => state.updateSummaryFromGraph);

