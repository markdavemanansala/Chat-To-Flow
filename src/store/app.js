import { create } from 'zustand';
import { applyPatch as applyGraphPatch, validateGraph } from '../workflow/graphPatch.js';
import { summarizeGraph } from '../workflow/graphSummary.js';
import { getNodeRole } from '../workflow/graphTypes.js';

/**
 * @typedef {import('reactflow').Node} ReactFlowNode
 * @typedef {import('reactflow').Edge} ReactFlowEdge
 * @typedef {import('../workflow/graphTypes').GraphPatch} GraphPatch
 * @typedef {import('../workflow/graphTypes').RfNodeData} RfNodeData
 */

// Simple event bus
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

const eventBus = new EventBus();

// History management
function createHistory() {
  const history = [];
  let currentIndex = -1;

  return {
    push(state) {
      // Remove any future states if we're not at the end
      if (currentIndex < history.length - 1) {
        history.splice(currentIndex + 1);
      }
      history.push(JSON.parse(JSON.stringify(state)));
      currentIndex = history.length - 1;
      
      // Limit history size
      if (history.length > 50) {
        history.shift();
        currentIndex--;
      }
    },
    undo() {
      if (currentIndex > 0) {
        currentIndex--;
        return JSON.parse(JSON.stringify(history[currentIndex]));
      }
      return null;
    },
    redo() {
      if (currentIndex < history.length - 1) {
        currentIndex++;
        return JSON.parse(JSON.stringify(history[currentIndex]));
      }
      return null;
    },
    canUndo() {
      return currentIndex > 0;
    },
    canRedo() {
      return currentIndex < history.length - 1;
    },
    getCurrent() {
      return currentIndex >= 0 ? JSON.parse(JSON.stringify(history[currentIndex])) : null;
    }
  };
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * @typedef {Object} AppState
 */
export const useAppStore = create((set, get) => {
  const historyRef = { current: createHistory() };
  let summaryUpdateTimer = null;

  // Debounced summary update
  const updateSummary = debounce(() => {
    const state = get();
    const summary = summarizeGraph(state.nodes, state.edges);
    set({ aiContext: { ...state.aiContext, currentSummary: summary } });
  }, 300);

  return {
    // Existing state
    selectedTemplate: undefined,
    workflowSummary: undefined,

    // Flow state (React Flow) - Single Source of Truth
    nodes: [],
    edges: [],

    // AI Context
    aiContext: {
      currentSummary: 'Empty workflow (no nodes)',
    },

    // History
    historyRef,

    // Existing actions
    setTemplate: (template) => set({ selectedTemplate: template }),
    setWorkflow: (workflow) => set({ workflowSummary: workflow }),
    resetAll: () => {
      historyRef.current = createHistory();
      set({ 
        selectedTemplate: undefined, 
        workflowSummary: undefined,
        nodes: [],
        edges: [],
        aiContext: { currentSummary: 'Empty workflow (no nodes)' },
      });
      eventBus.emit('graph-changed', { nodes: [], edges: [] });
    },

  /**
   * Update the workflow flow (nodes and edges)
   * This is the single source of truth for the workflow graph
   * Handles change detection to prevent unnecessary updates
   * 
   * @param {Array} nodes - React Flow nodes array
   * @param {Array} edges - React Flow edges array
   */
  setFlow: (nodes, edges) => {
    const state = get();
    
    // Compare node IDs and positions to detect real changes
    const nodeIdsChanged = JSON.stringify(state.nodes.map(n => n.id)) !== JSON.stringify(nodes.map(n => n.id));
    const nodePositionsChanged = JSON.stringify(state.nodes.map(n => ({ id: n.id, position: n.position }))) !== 
                                  JSON.stringify(nodes.map(n => ({ id: n.id, position: n.position })));
    const edgesChanged = JSON.stringify(state.edges.map(e => e.id)) !== JSON.stringify(edges.map(e => e.id));
    
    // Update if structure changed (add/remove) or positions changed (drag)
    if (nodeIdsChanged || nodePositionsChanged || edgesChanged) {
      set({ nodes, edges });
      historyRef.current.push({ nodes, edges });
      updateSummary();
      eventBus.emit('graph-changed', { nodes, edges });
    }
  },

    upsertNode: (node) => {
      set((state) => {
        const existingIndex = state.nodes.findIndex(n => n.id === node.id);
        let newNodes;
        if (existingIndex >= 0) {
          newNodes = [...state.nodes];
          newNodes[existingIndex] = node;
        } else {
          newNodes = [...state.nodes, node];
        }
        
        // Ensure role is set
        if (!newNodes[newNodes.length - 1].data?.role && newNodes[newNodes.length - 1].data?.kind) {
          newNodes[newNodes.length - 1].data.role = getNodeRole(newNodes[newNodes.length - 1].data.kind);
        }
        
        const newState = { nodes: newNodes };
        historyRef.current.push({ nodes: newNodes, edges: state.edges });
        updateSummary();
        eventBus.emit('graph-changed', { nodes: newNodes, edges: state.edges });
        return newState;
      });
    },

    setEdges: (edges) => {
      set((state) => {
        const newState = { edges };
        historyRef.current.push({ nodes: state.nodes, edges });
        updateSummary();
        eventBus.emit('graph-changed', { nodes: state.nodes, edges });
        return newState;
      });
    },

    resetFlow: () => {
      set({ nodes: [], edges: [] });
      historyRef.current.push({ nodes: [], edges: [] });
      updateSummary();
      eventBus.emit('graph-changed', { nodes: [], edges: [] });
    },

    // Patch operations
    applyPatch: (patch) => {
      const state = get();
      console.log('📦 Store applyPatch:', patch.op, patch.id || 'N/A', `(${state.nodes.length} nodes)`);
      console.log('📦 Current node IDs:', state.nodes.map(n => n.id));
      
      const result = applyGraphPatch(patch, state.nodes, state.edges);
      
      if (result.ok) {
        const nodeCountBefore = state.nodes.length;
        const nodeCountAfter = result.nodes.length;
        console.log(`✅ Patch applied: ${nodeCountBefore} → ${nodeCountAfter} nodes`);
        console.log('📦 New node IDs:', result.nodes.map(n => n.id));
        
        // Validate nodes before creating new arrays
        const validResultNodes = (result.nodes || []).filter(n => {
          if (!n) {
            console.warn('⚠️ Filtering out null/undefined node');
            return false;
          }
          if (!n.id) {
            console.warn('⚠️ Filtering out node without id:', n);
            return false;
          }
          if (!n.data) {
            console.warn('⚠️ Filtering out node without data:', n.id);
            return false;
          }
          return true;
        });
        
        console.log('📦 Validating result nodes:', {
          originalCount: result.nodes?.length || 0,
          validCount: validResultNodes.length,
          validNodeIds: validResultNodes.map(n => n.id)
        });
        
        // Create completely new arrays with new references for each node/edge
        const newNodes = validResultNodes.map(n => ({ ...n, data: { ...n.data } }));
        const newEdges = (result.edges || []).map(e => ({ ...e }));
        
        // CRITICAL: Create completely new array references
        // Zustand uses shallow equality - new array reference = re-render trigger
        const finalNodes = [...newNodes.map(n => ({ 
          ...n, 
          data: { ...n.data },
          position: { ...n.position }
        }))];
        const finalEdges = [...newEdges.map(e => ({ ...e }))];
        
        console.log('📦 Setting store with new arrays:', {
          nodesCount: finalNodes.length,
          edgesCount: finalEdges.length,
          nodeIds: finalNodes.map(n => n.id),
          edgeIds: finalEdges.map(e => e.id)
        });
        
        // Use set to trigger Zustand subscribers
        // This MUST create a new array reference for Zustand to detect the change
        set({ 
          nodes: finalNodes, 
          edges: finalEdges
        });
        
        // Verify the update immediately
        const verifyState = get();
        console.log('📦 Verification - Store nodes count:', verifyState.nodes.length);
        console.log('📦 Verification - Store node IDs:', verifyState.nodes.map(n => n.id));
        
        if (verifyState.nodes.length !== nodeCountAfter) {
          console.error('⚠️ State update mismatch! Expected', nodeCountAfter, 'got', verifyState.nodes.length);
        } else {
          console.log('✅ Store state verified correctly - React Flow will sync automatically');
        }
        
        historyRef.current.push({ nodes: newNodes, edges: newEdges });
        updateSummary();
        
        // Emit events immediately to trigger React Flow updates
        eventBus.emit('graph-changed', { nodes: newNodes, edges: newEdges });
        eventBus.emit('patch-applied', { patch, result });
      } else {
        console.error('❌ Patch failed:', result.issues);
        eventBus.emit('patch-failed', { patch, result });
      }
      
      return result;
    },

    // Undo/Redo
    undo: () => {
      const previous = historyRef.current.undo();
      if (previous) {
        set({ nodes: previous.nodes, edges: previous.edges });
        updateSummary();
        eventBus.emit('graph-changed', { nodes: previous.nodes, edges: previous.edges });
        return true;
      }
      return false;
    },

    redo: () => {
      const next = historyRef.current.redo();
      if (next) {
        set({ nodes: next.nodes, edges: next.edges });
        updateSummary();
        eventBus.emit('graph-changed', { nodes: next.nodes, edges: next.edges });
        return true;
      }
      return false;
    },

    canUndo: () => historyRef.current.canUndo(),
    canRedo: () => historyRef.current.canRedo(),

    // Validation
    validateGraph: () => {
      const state = get();
      return validateGraph(state.nodes, state.edges);
    },

    // Event bus access
    onGraphChange: (callback) => {
      eventBus.on('graph-changed', callback);
      return () => eventBus.off('graph-changed', callback);
    },
    onPatchApplied: (callback) => {
      eventBus.on('patch-applied', callback);
      return () => eventBus.off('patch-applied', callback);
    },
    onPatchFailed: (callback) => {
      eventBus.on('patch-failed', callback);
      return () => eventBus.off('patch-failed', callback);
    },
  };
});

// Convenience hooks for reading existing state
export const useSelectedTemplate = () => useAppStore((state) => state.selectedTemplate);
export const useWorkflowSummary = () => useAppStore((state) => state.workflowSummary);
export const useAiContext = () => useAppStore((state) => state.aiContext);

// Convenience hooks for existing actions
export const useSetTemplate = () => useAppStore((state) => state.setTemplate);
export const useSetWorkflow = () => useAppStore((state) => state.setWorkflow);
export const useResetAll = () => useAppStore((state) => state.resetAll);

/**
 * Convenience hooks for flow state
 * These hooks subscribe to store changes and trigger re-renders
 * Zustand uses shallow equality by default, which detects array reference changes
 * We rely on Zustand's default behavior - it will trigger re-renders when the array reference changes
 */
export const useNodes = () => useAppStore((state) => state.nodes);
export const useEdges = () => useAppStore((state) => state.edges);

// Convenience hooks for flow actions
export const useSetFlow = () => useAppStore((state) => state.setFlow);
export const useUpsertNode = () => useAppStore((state) => state.upsertNode);
export const useSetEdges = () => useAppStore((state) => state.setEdges);
export const useResetFlow = () => useAppStore((state) => state.resetFlow);

// Convenience hooks for patch operations
export const useApplyPatch = () => useAppStore((state) => state.applyPatch);
export const useUndo = () => useAppStore((state) => state.undo);
export const useRedo = () => useAppStore((state) => state.redo);
export const useCanUndo = () => useAppStore((state) => state.canUndo());
export const useCanRedo = () => useAppStore((state) => state.canRedo());
export const useValidateGraph = () => useAppStore((state) => state.validateGraph);

// Event bus hooks
export const useOnGraphChange = () => useAppStore((state) => state.onGraphChange);
export const useOnPatchApplied = () => useAppStore((state) => state.onPatchApplied);
export const useOnPatchFailed = () => useAppStore((state) => state.onPatchFailed);
