/**
 * @fileoverview Compatibility layer for app.js
 * This file provides backward compatibility for components still using app.js
 * All functionality has been migrated to graphStore.ts, aiStore.ts, and uiStore.ts
 * 
 * @deprecated Use graphStore.ts, aiStore.ts, and uiStore.ts directly
 */

// Re-export from new stores for backward compatibility
export { 
  useNodes, 
  useEdges, 
  useSetFlow, 
  useSetEdges, 
  useResetFlow, 
  useApplyPatch,
  useUndo,
  useRedo,
  useCanUndo,
  useCanRedo,
  useUpsertNode,
  useValidateGraph,
  useOnGraphChange,
  useOnPatchApplied,
  useOnPatchFailed,
  useGraphStore,
} from './graphStore';

export {
  useCurrentSummary as useAiContext,
  useSetSummary,
  useSetAIState,
  useUpdateSummaryFromGraph,
} from './aiStore';

// Legacy exports for components that still reference these
export const useAppStore = {
  getState: () => {
    // Return a compatibility object
    const graphStore = require('./graphStore').useGraphStore.getState();
    const aiStore = require('./aiStore').useAIStore.getState();
    return {
      nodes: graphStore.nodes,
      edges: graphStore.edges,
      aiContext: {
        currentSummary: aiStore.currentSummary,
      },
      undo: graphStore.undo,
      redo: graphStore.redo,
    };
  },
};

// Legacy hooks that map to new stores
export const useWorkflowSummary = () => undefined; // Deprecated
export const useSetWorkflow = () => () => {}; // Deprecated
export const useSelectedTemplate = () => undefined; // Deprecated
export const useSetTemplate = () => () => {}; // Deprecated
export const useResetAll = () => {
  const { useResetFlow } = require('./graphStore');
  return useResetFlow();
};
